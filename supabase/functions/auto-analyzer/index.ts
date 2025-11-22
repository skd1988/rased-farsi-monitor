import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Post {
  id: string;
  title: string;
  contents: string;
  source: string;
  language: string;
  published_at: string;
}

interface QueueItem {
  id: string;
  post_id: string;
  priority: number;
  posts: Post;
}

interface QuickAnalysisResult {
  is_psyop?: boolean | null;
  psyop_confidence?: number | null;
  threat_level?: string | null;
  psyop_risk_score?: number | null;
  stance_type?: string | null;
  psyop_category?: string | null;
  psyop_techniques?: unknown;
  primary_target?: string | null;
}

function normalizeQuickResult(raw: any): QuickAnalysisResult {
  const psyopRiskScore = typeof raw?.psyop_risk_score === "number"
    ? raw.psyop_risk_score
    : typeof raw?.riskScore === "number"
      ? raw.riskScore
      : null;

  const psyopConfidence = typeof raw?.psyop_confidence === "number"
    ? raw.psyop_confidence
    : typeof raw?.confidence === "number"
      ? raw.confidence
      : null;

  return {
    is_psyop: raw?.is_psyop ?? null,
    psyop_confidence: psyopConfidence,
    threat_level: raw?.threat_level ?? raw?.threatLevel ?? null,
    psyop_risk_score: psyopRiskScore,
    stance_type: raw?.stance_type ?? raw?.stanceType ?? null,
    psyop_category: raw?.psyop_category ?? raw?.psyopCategory ?? null,
    psyop_techniques: raw?.psyop_techniques ?? raw?.psyopTechniques,
    primary_target: raw?.primary_target ?? raw?.primaryTarget ?? null,
  };
}

function needsDeepAnalysis(
  post: QuickAnalysisResult & { postId: string }
): boolean {
  const threatLevel = post.threat_level;
  const psyopConfidence = post.psyop_confidence ?? 0;
  const psyopCategory = post.psyop_category;
  const isPsyop = post.is_psyop === true;

  const result = Boolean(
    isPsyop ||
    (threatLevel === "High" || threatLevel === "Critical") ||
    (threatLevel === "Medium" && psyopConfidence >= 70) ||
    (psyopCategory === "potential_psyop" || psyopCategory === "confirmed_psyop")
  );

  console.log("⚠️ [AutoAnalyzer] needsDeepAnalysis?", {
    postId: post.postId,
    is_psyop: post.is_psyop,
    threat_level: threatLevel,
    psyop_confidence: post.psyop_confidence,
    psyop_category: psyopCategory,
    result,
  });

  return result;
}

function shouldRunDeepest(
  post: QuickAnalysisResult & { postId: string }
): boolean {
  const threatLevel = post.threat_level;
  const psyopCategory = post.psyop_category;
  const stanceType = post.stance_type;
  const riskScore = post.psyop_risk_score ?? 0;
  const isPsyop = post.is_psyop === true;

  const meetsRiskThreshold = riskScore >= 80;
  const meetsThreatOrCategory =
    threatLevel === "High" ||
    threatLevel === "Critical" ||
    psyopCategory === "confirmed_psyop" ||
    psyopCategory === "suspected_psyop";

  const result = Boolean(
    isPsyop &&
    meetsRiskThreshold &&
    meetsThreatOrCategory &&
    stanceType === "hostile_propaganda"
  );

  console.log("⚠️ [AutoAnalyzer] shouldRunDeepest?", {
    postId: post.postId,
    is_psyop: post.is_psyop,
    threat_level: threatLevel,
    psyop_risk_score: post.psyop_risk_score,
    stance_type: stanceType,
    psyop_category: psyopCategory,
    result,
  });

  return result;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 Auto Analyzer started...');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');

    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if system is enabled
    const { data: configData } = await supabase
      .from('auto_analysis_config')
      .select('config_value')
      .eq('config_key', 'enabled')
      .single();

    if (configData?.config_value === false) {
      console.log('⏸️ Auto analysis is disabled');
      return new Response(
        JSON.stringify({ message: 'Auto analysis is disabled', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get batch size from config
    const { data: batchConfig } = await supabase
      .from('auto_analysis_config')
      .select('config_value')
      .eq('config_key', 'batch_size')
      .single();

    const batchSize = parseInt(batchConfig?.config_value || '20');

    // Get pending items from queue
    const { data: queueItems, error: queueError } = await supabase
      .from('analysis_queue')
      .select(`
        id,
        post_id,
        priority,
        posts (
          id,
          title,
          contents,
          source,
          language,
          published_at
        )
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (queueError) {
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('📭 No pending posts in queue');
      return new Response(
        JSON.stringify({ message: 'No pending posts', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Processing ${queueItems.length} posts from queue`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    // Process each item
    for (const item of queueItems as QueueItem[]) {
      try {
        // Mark as processing
        await supabase
          .from('analysis_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', item.id);

        console.log(`🔍 [AutoAnalyzer] Running QUICK analysis for post ${item.post_id}...`);

        // Call quick-psyop-detection first
        const quickResponse = await fetch(
          `${supabaseUrl}/functions/v1/quick-psyop-detection`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              title: item.posts.title,
              contents: item.posts.contents,
              source: item.posts.source,
              language: item.posts.language
            })
          }
        );

        if (!quickResponse.ok) {
          throw new Error(`Quick analysis failed: ${quickResponse.status}`);
        }

        const quickData = await quickResponse.json();
        const quick = normalizeQuickResult(quickData.result || quickData);

        console.log(`✅ [AutoAnalyzer] Quick analysis completed for post ${item.post_id}`);

        const quickUpdate = {
          is_psyop: quick.is_psyop,
          psyop_confidence: quick.psyop_confidence,
          threat_level: quick.threat_level ?? "Low",
          psyop_risk_score: quick.psyop_risk_score,
          stance_type: quick.stance_type,
          psyop_category: quick.psyop_category,
          psyop_techniques: quick.psyop_techniques,
          analysis_stage: 'quick',
          quick_analyzed_at: new Date().toISOString()
        } as const;

        await supabase
          .from('posts')
          .update(quickUpdate)
          .eq('id', item.post_id);

        const shouldRunDeep = needsDeepAnalysis({
          postId: item.post_id,
          ...quick,
        });

        const shouldDeepest = shouldRunDeepest({
          postId: item.post_id,
          ...quick,
        });

        if (shouldRunDeep) {
          console.log(`🧠 [AutoAnalyzer] Running DEEP analysis for post ${item.post_id}...`);

          const deepResponse = await fetch(
            `${supabaseUrl}/functions/v1/analyze-post-deepseek`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({
                postId: item.post_id,
                title: item.posts.title,
                contents: item.posts.contents,
                source: item.posts.source,
                language: item.posts.language,
                published_at: item.posts.published_at
              })
            }
          );

          if (!deepResponse.ok) {
            console.error(`❌ [AutoAnalyzer] Deep analysis failed for post ${item.post_id}: ${deepResponse.status}`);
          } else {
            await supabase
              .from('posts')
              .update({
                analysis_stage: 'deep',
                deep_analyzed_at: new Date().toISOString()
              })
              .eq('id', item.post_id);

            console.log(`✅ [AutoAnalyzer] Deep analysis completed for post ${item.post_id}`);
          }
        } else {
          console.log(
            `ℹ️ [AutoAnalyzer] Skipping deep analysis for post ${item.post_id} (low risk according to quick).`
          );
        }

        if (shouldDeepest) {
          console.log(`🧠 [AutoAnalyzer] Running DEEPEST analysis for post ${item.post_id}...`);

          const deepestResponse = await fetch(
            `${supabaseUrl}/functions/v1/analyze-post-deepest`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({
                postId: item.post_id,
                quickResult: quick,
              })
            }
          );

          if (!deepestResponse.ok) {
            console.error("❌ [AutoAnalyzer] Deepest analysis failed for post:", item.post_id, await deepestResponse.text());
          } else {
            console.log(`✅ [AutoAnalyzer] Deepest analysis completed for post ${item.post_id}`);
          }
        }

        // Mark queue item as completed
        await supabase
          .from('analysis_queue')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', item.id);

        succeeded++;
        processed++;

      } catch (error) {
        console.error(`❌ Error processing post ${item.post_id}:`, error);
        
        // Update queue with error
        const { data: currentItem } = await supabase
          .from('analysis_queue')
          .select('retry_count, max_retries')
          .eq('id', item.id)
          .single();

        const retryCount = (currentItem?.retry_count || 0) + 1;
        const maxRetries = currentItem?.max_retries || 3;

        if (retryCount >= maxRetries) {
          // Max retries reached, mark as failed
          await supabase
            .from('analysis_queue')
            .update({
              status: 'failed',
              error_message: error.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', item.id);
        } else {
          // Reset to pending for retry
          await supabase
            .from('analysis_queue')
            .update({
              status: 'pending',
              retry_count: retryCount,
              error_message: error.message
            })
            .eq('id', item.id);
        }

        failed++;
        processed++;
      }
    }

    // Update stats
    await supabase.rpc('increment_auto_analysis_stats', {
      p_date: new Date().toISOString().split('T')[0],
      p_analyzed: succeeded,
      p_failed: failed
    });

    console.log(`✅ Auto Analyzer completed: ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        succeeded,
        failed,
        message: `Processed ${processed} posts`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Auto Analyzer error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
