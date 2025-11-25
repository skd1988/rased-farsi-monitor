import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startJobRun, finishJobRun } from "../_shared/cronMonitor.ts";

// NOTE: posts.inoreader_timestamp_usec is the only Inoreader timestamp column.
// Do not use "inoreader_timestamp" — it does not exist in the schema.

// Helpful sanity queries for validating stage counts:
// SELECT count(*) FROM posts WHERE is_psyop = true;
// SELECT count(*) FROM posts WHERE is_psyop = true AND quick_analyzed_at IS NOT NULL AND deep_analyzed_at IS NULL AND deepest_analysis_completed_at IS NULL;
// SELECT count(*) FROM posts WHERE is_psyop = true AND deep_analyzed_at IS NOT NULL AND deepest_analysis_completed_at IS NULL;
// SELECT count(*) FROM posts WHERE is_psyop = true AND deepest_analysis_completed_at IS NOT NULL;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PostRow = {
  id: string;
  status: string | null;
  contents: string | null;
  is_psyop: boolean | null;
  quick_analyzed_at: string | null;
  deep_analyzed_at: string | null;
  deepest_analysis_completed_at: string | null;
  threat_level: string | null;
  psyop_risk_score: number | null;
};

const DEEP_BATCH_SIZE = 20;

function isValidForAnalysis(post: PostRow): boolean {
  // پست آرشیو شده یا بدون محتوا را کلاً وارد چرخه نکن
  if (!post) return false;
  if (post.status === "Archived") return false;
  if (post.contents === null || post.contents.trim() === "") return false;
  return true;
}

async function getQuickCandidates(supabase: any, batchSize: number) {
  return supabase
    .from('posts')
    .select('*')
    .is('is_psyop', null)
    .neq('status', 'Archived')
    .not('contents', 'is', null)
    .order('inoreader_timestamp_usec', { ascending: true })
    .limit(batchSize);
}

async function getDeepCandidates(supabase: any) {
  return supabase
    .from('posts')
    .select(
      'id, is_psyop, quick_analyzed_at, deep_analyzed_at, status, threat_level, psyop_risk_score',
    )
    // فقط پست‌های PsyOp
    .eq('is_psyop', true)
    // آرشیوها را کنار بگذار
    .neq('status', 'Archived')
    // هر پستی که هنوز deep نشده، حتی اگر quick_analyzed_at خالی باشد
    .is('deep_analyzed_at', null)
    .order('created_at', { ascending: true })   // اگر خواستی می‌توانی بر اساس زمان ساخت مرتب کنی
    .limit(DEEP_BATCH_SIZE);
}


async function getDeepestCandidates(supabase: any) {
  return supabase
    .from('posts')
    .select('*')
    .eq('is_psyop', true)
    .not('deep_analyzed_at', 'is', null)
    .is('deepest_analysis_completed_at', null)
    .neq('status', 'Archived')
    .not('contents', 'is', null)
    .order('deep_analyzed_at', { ascending: true })
    .limit(20);
}

async function callEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
) {
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

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
    const postId = (body as { postId?: string }).postId || "unknown";
    throw new Error(`${url} failed with status ${response.status}: ${text} (postId=${postId})`);
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

    let totalTasks = 0;
    let successTasks = 0;
    let failedTasks = 0;

    // --------------------
    // QUICK SCREENING
    // --------------------
    const { data: quickCandidates, error: quickError } = await getQuickCandidates(supabase, batchSize);

    if (quickError) throw quickError;

    const quickCandidatesSafe = (quickCandidates ?? []).filter(isValidForAnalysis);
    console.log(`🧭 Quick screening candidates: ${quickCandidatesSafe.length}`);

    for (const post of quickCandidatesSafe) {
      totalTasks++;

      try {
        console.log(`🔍 [AutoAnalyzer] Running QUICK analysis for post ${post.id}...`);
        await callEdgeFunction("quick-psyop-detection", { postId: post.id }, supabaseUrl, supabaseServiceKey);
        successTasks++;
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);

        if (msg.includes("Post not found") || msg.includes("404")) {
          console.warn("Skipping missing post");
          continue;
        }

        failedTasks++;
        console.error(
          `❌ Quick analysis failed for post ${post.id}:`,
          err,
        );
      }
    }

    // --------------------
    // DEEP ANALYSIS
    // --------------------
    const { data: deepCandidatesRaw, error: deepError } = await getDeepCandidates(supabase);

    if (deepError) throw deepError;

    const eligibleDeep = (deepCandidatesRaw || []).filter((post) =>
      post.is_psyop === true &&
      !post.deep_analyzed_at &&
      isValidForAnalysis(post)
    );

    console.log(
      `🔬 Deep analysis candidates (PsyOp-only): ${eligibleDeep.length}`,
    );

    for (const post of eligibleDeep) {
      totalTasks++;

      if (!isValidForAnalysis(post)) {
        continue;
      }

      try {
        console.log(`🧠 [AutoAnalyzer] Running DEEP analysis for post ${post.id}...`);
        await callEdgeFunction("analyze-post-deepseek", { postId: post.id }, supabaseUrl, supabaseServiceKey);
        successTasks++;
      } catch (err) {
        failedTasks++;
        console.error(
          `❌ Deep analysis failed for post ${post.id}:`,
          err,
        );
      }
    }

    // --------------------
    // DEEPEST ANALYSIS
    // --------------------
    const { data: deepestCandidatesRaw, error: deepestError } = await getDeepestCandidates(supabase);

    if (deepestError) throw deepestError;

    const deepestCandidates = (deepestCandidatesRaw ?? []).filter(isValidForAnalysis);
    console.log(`🧠 Deepest analysis candidates: ${deepestCandidates.length}`);

    for (const post of deepestCandidates) {
      totalTasks++;

      try {
        console.log(`🚨 [AutoAnalyzer] Running DEEPEST analysis for post ${post.id}...`);
        await callEdgeFunction("deepest-analysis", { postId: post.id }, supabaseUrl, supabaseServiceKey);
        successTasks++;
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);

        if (msg.includes("Post not ready for deepest analysis")) {
          console.warn(
            `⚠️ Skipping DEEPEST for post ${post.id}: not ready yet (${msg})`,
          );
          continue;
        }

        failedTasks++;
        console.error(
          `❌ Deepest analysis failed for post ${post.id}:`,
          err,
        );
      }
    }

    // Update stats
    await supabase.rpc('increment_auto_analysis_stats', {
      p_date: new Date().toISOString().split('T')[0],
      p_analyzed: successTasks,
      p_failed: failedTasks,
    });

    console.log(`✅ Auto Analyzer completed: ${successTasks} succeeded, ${failedTasks} failed`);

    const response = new Response(
      JSON.stringify({
        success: true,
        processed: totalTasks,
        succeeded: successTasks,
        failed: failedTasks,
        message: `Processed ${totalTasks} analyses across stages`,
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
