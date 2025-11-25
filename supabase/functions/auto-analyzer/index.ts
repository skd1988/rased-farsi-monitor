import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startJobRun, finishJobRun } from "../_shared/cronMonitor.ts";

// Helpful sanity queries for validating stage counts:
// SELECT count(*) FROM posts WHERE is_psyop = true;
// SELECT count(*) FROM posts WHERE is_psyop = true AND quick_analyzed_at IS NOT NULL AND deep_analyzed_at IS NULL AND deepest_analysis_completed_at IS NULL;
// SELECT count(*) FROM posts WHERE is_psyop = true AND deep_analyzed_at IS NOT NULL AND deepest_analysis_completed_at IS NULL;
// SELECT count(*) FROM posts WHERE is_psyop = true AND deepest_analysis_completed_at IS NOT NULL;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StageResult {
  processed: number;
  succeeded: number;
  failed: number;
}

interface PostCheckResult {
  exists: boolean;
  skipped: boolean;
}

function buildBaseCandidateQuery(supabase: any) {
  return supabase
    .from('posts')
    .select('id')
    .in('status', ['new', 'ready'])
    .not('title', 'is', null)
    .not('contents', 'is', null)
    .not('inoreader_timestamp', 'is', null);
}

async function getQuickCandidates(supabase: any, batchSize: number) {
  return supabase
    .from('posts')
    .select('id')
    .in('status', ['new', 'ready'])
    .not('title', 'is', null)
    .not('contents', 'is', null)
    .not('inoreader_timestamp', 'is', null)
    .is('quick_analyzed_at', null)
    .or('analysis_stage.is.null,analysis_stage.eq.quick')
    .order('created_at', { ascending: true })
    .limit(batchSize);
}

async function getDeepCandidates(supabase: any, batchSize: number) {
  return buildBaseCandidateQuery(supabase)
    .eq('is_psyop', true)
    .not('quick_analyzed_at', 'is', null)
    .is('deep_analyzed_at', null)
    .gte('psyop_risk_score', 60)
    .in('threat_level', ['Medium', 'High', 'Critical'])
    .or('analysis_stage.is.null,analysis_stage.eq.quick,analysis_stage.eq.deep')
    .order('created_at', { ascending: true })
    .limit(batchSize);
}

async function getDeepestCandidates(supabase: any, batchSize: number) {
  return buildBaseCandidateQuery(supabase)
    .eq('is_psyop', true)
    .not('deep_analyzed_at', 'is', null)
    .is('deepest_analysis_completed_at', null)
    .gte('psyop_risk_score', 80)
    .in('threat_level', ['High', 'Critical'])
    .or('analysis_stage.is.null,analysis_stage.eq.deep,analysis_stage.eq.deepest')
    .order('created_at', { ascending: true })
    .limit(batchSize);
}

async function ensurePostExists(
  supabase: any,
  postId: string,
): Promise<PostCheckResult> {
  const { data: post, error } = await supabase
    .from("posts")
    .select("id, title, contents, status, inoreader_timestamp")
    .eq("id", postId)
    .single();

  if (error || !post) {
    console.log(`⚠️ Skipped post ${postId} (not found in posts table) - Post disappeared, skipping`);
    return { exists: false, skipped: true };
  }

  if (
    !post.title ||
    !post.contents ||
    post.status === 'Archived' ||
    !post.inoreader_timestamp
  ) {
    console.log(`⚠️ Skipped post ${postId} (missing required fields)`);
    return { exists: false, skipped: true };
  }

  return { exists: true, skipped: false };
}

async function callEdgeFunction(url: string, body: Record<string, unknown>, serviceKey: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${url} failed with status ${response.status}: ${text}`);
  }

  return response;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const jobName = "auto-analyzer";
  let runId: string | null = null;
  let httpStatus = 200;

  try {
    runId = await startJobRun(jobName, req.headers.get("X-Job-Source") || "github_actions");

    console.log('🤖 Auto Analyzer started...');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if system is enabled
    const { data: configData } = await supabase
      .from('auto_analysis_config')
      .select('config_value')
      .eq('config_key', 'enabled')
      .single();

    if (configData?.config_value === false) {
      console.log('⏸️ Auto analysis is disabled');
      const response = new Response(
        JSON.stringify({ message: 'Auto analysis is disabled', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      httpStatus = response.status;
      await finishJobRun(runId, "success", httpStatus, undefined, { jobName });
      return response;
    }

    // Get batch size from config
    const { data: batchConfig } = await supabase
      .from('auto_analysis_config')
      .select('config_value')
      .eq('config_key', 'batch_size')
      .single();

    const batchSize = parseInt(batchConfig?.config_value || '20', 10);

    const totals: StageResult = { processed: 0, succeeded: 0, failed: 0 };

    // --------------------
    // QUICK SCREENING
    // --------------------
    const { data: quickCandidates, error: quickError } = await getQuickCandidates(supabase, batchSize);

    if (quickError) throw quickError;

    console.log(`🧭 Quick screening candidates: ${quickCandidates?.length || 0}`);

    for (const candidate of quickCandidates ?? []) {
      try {
        const { exists, skipped } = await ensurePostExists(supabase, candidate.id);
        if (!exists) {
          if (skipped) {
            totals.processed += 1;
            continue;
          }
          throw new Error(`Post ${candidate.id} could not be validated`);
        }

        await callEdgeFunction(
          `${supabaseUrl}/functions/v1/quick-psyop-detection`,
          { postId: candidate.id },
          supabaseServiceKey,
        );
        totals.succeeded += 1;
      } catch (error) {
        console.error(`❌ Quick analysis failed for post ${candidate.id}:`, error);
        totals.failed += 1;
      }
      totals.processed += 1;
    }

    // --------------------
    // DEEP ANALYSIS
    // --------------------
    const { data: deepCandidates, error: deepError } = await getDeepCandidates(supabase, batchSize);

    if (deepError) throw deepError;

    console.log(`🔬 Deep analysis candidates: ${deepCandidates?.length || 0}`);

    for (const candidate of deepCandidates ?? []) {
      try {
        const { exists, skipped } = await ensurePostExists(supabase, candidate.id);
        if (!exists) {
          if (skipped) {
            totals.processed += 1;
            continue;
          }
          throw new Error(`Post ${candidate.id} could not be validated`);
        }

        await callEdgeFunction(
          `${supabaseUrl}/functions/v1/analyze-post-deepseek`,
          { postId: candidate.id },
          supabaseServiceKey,
        );
        totals.succeeded += 1;
      } catch (error) {
        console.error(`❌ Deep analysis failed for post ${candidate.id}:`, error);
        totals.failed += 1;
      }
      totals.processed += 1;
    }

    // --------------------
    // DEEPEST ANALYSIS
    // --------------------
    const { data: deepestCandidates, error: deepestError } = await getDeepestCandidates(supabase, batchSize);

    if (deepestError) throw deepestError;

    console.log(`🧠 Deepest analysis candidates: ${deepestCandidates?.length || 0}`);

    for (const candidate of deepestCandidates ?? []) {
      try {
        const { exists, skipped } = await ensurePostExists(supabase, candidate.id);
        if (!exists) {
          if (skipped) {
            totals.processed += 1;
            continue;
          }
          throw new Error(`Post ${candidate.id} could not be validated`);
        }

        await callEdgeFunction(
          `${supabaseUrl}/functions/v1/deepest-analysis`,
          { postId: candidate.id },
          supabaseServiceKey,
        );
        totals.succeeded += 1;
      } catch (error) {
        console.error(`❌ Deepest analysis failed for post ${candidate.id}:`, error);
        totals.failed += 1;
      }
      totals.processed += 1;
    }

    // Update stats
    await supabase.rpc('increment_auto_analysis_stats', {
      p_date: new Date().toISOString().split('T')[0],
      p_analyzed: totals.succeeded,
      p_failed: totals.failed,
    });

    console.log(`✅ Auto Analyzer completed: ${totals.succeeded} succeeded, ${totals.failed} failed`);

    const response = new Response(
      JSON.stringify({
        success: true,
        processed: totals.processed,
        succeeded: totals.succeeded,
        failed: totals.failed,
        message: `Processed ${totals.processed} analyses across stages`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    httpStatus = response.status;
    await finishJobRun(runId, "success", httpStatus, undefined, { jobName });
    return response;

  } catch (error) {
    console.error('❌ Auto Analyzer error:', error);
    const response = new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    httpStatus = response.status;
    await finishJobRun(runId, "failed", httpStatus, (error as Error).message, { jobName });
    return response;
  }
});
