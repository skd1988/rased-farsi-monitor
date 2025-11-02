import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit, batchSize = 10 } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    // Fetch unanalyzed posts directly (no ID array needed)
    let query = supabase
      .from('posts')
      .select('id, title, contents, source, language, published_at')
      .is('analyzed_at', null)
      .order('published_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data: posts, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw new Error(`Failed to fetch posts: ${fetchError.message}`);
    }
    
    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          results: {
            total: 0,
            quick_only: 0,
            deep_analyzed: 0,
            failed: 0,
            alerts_created: 0,
            processing_time_ms: 0,
            estimated_old_time_ms: 0,
            time_saved_ms: 0,
            cost_saved_usd: 0,
            detailed_results: []
          }
        }),
        {
          status: 200,
          headers: { 
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }
    
    console.log(`Starting two-stage analysis for ${posts.length} posts`);
    
    const results = {
      total: posts.length,
      quick_only: 0,
      deep_analyzed: 0,
      failed: 0,
      alerts_created: 0,
      processing_time_ms: 0,
      estimated_old_time_ms: posts.length * 9000, // Old method: 9 sec/post
      time_saved_ms: 0,
      cost_saved_usd: 0,
      detailed_results: [] as any[]
    };
    
    const startTime = Date.now();
    
    // Process in batches
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(posts.length / batchSize)}...`);
      
      for (const post of batch) {
        const postStartTime = Date.now();
        
        try {
          // STAGE 1: Quick Detection
          console.log(`Post ${post.id}: Starting quick detection...`);
          const quickResult = await performQuickDetection(post);
          const quickTime = Date.now() - postStartTime;
          
          console.log(`Post ${post.id}: Quick result - PsyOp: ${quickResult.is_psyop}, Threat: ${quickResult.threat_level}, Time: ${quickTime}ms`);
          
          if (quickResult.needs_deep_analysis) {
            // STAGE 2: Deep Analysis
            console.log(`Post ${post.id}: Needs deep analysis, proceeding...`);
            
            const deepStartTime = Date.now();
            const deepResult = await performDeepAnalysis(post, quickResult);
            const deepTime = Date.now() - deepStartTime;
            
            console.log(`Post ${post.id}: Deep analysis complete in ${deepTime}ms`);
            
            // Save deep analysis result
            await saveAnalysisResult(supabase, post.id, deepResult, 'deep');
            
            // Create alert if needed
            if (deepResult.threat_level === 'Critical' || deepResult.threat_level === 'High') {
              await createAlert(supabase, post.id, deepResult);
              results.alerts_created++;
            }
            
            results.deep_analyzed++;
            results.detailed_results.push({
              post_id: post.id,
              stage: 'deep',
              is_psyop: deepResult.is_psyop === "Yes",
              threat_level: deepResult.threat_level,
              time_ms: Date.now() - postStartTime,
              status: 'success'
            });
            
          } else {
            // Save quick result only
            console.log(`Post ${post.id}: Not PsyOp, saving quick result only`);
            
            await saveAnalysisResult(supabase, post.id, quickResult, 'quick');
            
            results.quick_only++;
            results.detailed_results.push({
              post_id: post.id,
              stage: 'quick',
              is_psyop: quickResult.is_psyop,
              threat_level: quickResult.threat_level,
              time_ms: Date.now() - postStartTime,
              status: 'success'
            });
          }
          
        } catch (error) {
          console.error(`Failed to analyze post ${post.id}:`, error);
          results.failed++;
          results.detailed_results.push({
            post_id: post.id,
            stage: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            time_ms: Date.now() - postStartTime,
            status: 'error'
          });
        }
        
        // Small delay to avoid rate limits
        await sleep(100);
      }
      
      // Delay between batches
      await sleep(500);
    }
    
    results.processing_time_ms = Date.now() - startTime;
    results.time_saved_ms = results.estimated_old_time_ms - results.processing_time_ms;
    results.cost_saved_usd = (results.quick_only * 0.0015); // Saved ~$0.0015 per quick-only post
    
    console.log('Batch analysis completed:', {
      total: results.total,
      quick_only: results.quick_only,
      deep_analyzed: results.deep_analyzed,
      failed: results.failed,
      time: `${(results.processing_time_ms / 1000).toFixed(1)}s`,
      time_saved: `${(results.time_saved_ms / 1000).toFixed(1)}s`,
      improvement: `${((results.time_saved_ms / results.estimated_old_time_ms) * 100).toFixed(0)}%`
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        results: results
      }),
      {
        status: 200,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
    
  } catch (error) {
    console.error("Batch analysis error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    );
  }
});

// STAGE 1: Quick Detection
async function performQuickDetection(post: any) {
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/quick-psyop-detection`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
      },
      body: JSON.stringify({
        postId: post.id,
        title: post.title,
        source: post.source,
        language: post.language || "نامشخص"
      })
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Quick detection failed: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

// STAGE 2: Deep Analysis
async function performDeepAnalysis(post: any, quickResult: any) {
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-post-deepseek`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
      },
      body: JSON.stringify({
        postId: post.id,
        title: post.title,
        contents: post.contents,
        source: post.source,
        language: post.language || "نامشخص",
        published_at: post.published_at,
        quickDetectionResult: quickResult // Pass quick result as context
      })
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deep analysis failed: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Deep analysis failed');
  }
  
  return data.analysis;
}

// Save analysis result
async function saveAnalysisResult(
  supabase: any, 
  postId: string, 
  result: any, 
  analysisType: 'quick' | 'deep'
) {
  const updateData: any = {
    analyzed_at: new Date().toISOString(),
    analysis_stage: analysisType
  };
  
  if (analysisType === 'quick') {
    // Save minimal fields from quick detection
    updateData.is_psyop = result.is_psyop;
    updateData.psyop_confidence = result.psyop_confidence;
    updateData.threat_level = result.threat_level;
    updateData.target_entity = result.primary_target ? [result.primary_target] : null;
    updateData.analysis_summary = `غربالگری سریع: ${result.is_psyop ? 'احتمال PsyOp' : 'خبر عادی'}`;
    updateData.sentiment = result.is_psyop ? 'منفی' : 'خنثی';
    updateData.main_topic = 'نیاز به بررسی ندارد';
    
  } else {
    // Save all fields from deep analysis
    updateData.is_psyop = result.is_psyop === "Yes";
    updateData.psyop_confidence = result.psyop_confidence || result.confidence;
    updateData.threat_level = result.threat_level;
    updateData.target_entity = result.target_entity;
    updateData.target_persons = result.target_persons;
    updateData.psyop_technique = result.psyop_technique;
    updateData.sentiment = result.sentiment;
    updateData.sentiment_score = result.sentiment_score;
    updateData.main_topic = result.main_topic;
    updateData.analysis_summary = result.summary;
    updateData.keywords = result.keywords;
    updateData.key_points = result.key_points;
    updateData.recommended_action = result.recommended_action;
    updateData.confidence = result.confidence;
    updateData.processing_time = result.processing_time;
    updateData.analysis_model = result.analysis_model;
  }
  
  const { error } = await supabase
    .from('posts')
    .update(updateData)
    .eq('id', postId);
  
  if (error) {
    throw new Error(`Failed to save analysis: ${error.message}`);
  }
}

// Create alert for high/critical threats
async function createAlert(supabase: any, postId: string, analysis: any) {
  const alertType = 
    analysis.main_topic?.includes('جنگ روانی') ? 'Psychological Warfare' :
    analysis.main_topic?.includes('کمپین') ? 'Coordinated Campaign' :
    analysis.main_topic?.includes('اتهام') ? 'Direct Attack' :
    analysis.main_topic?.includes('شبهه') ? 'Propaganda' :
    'Viral Content';

  const triggeredReason = `تهدید سطح ${analysis.threat_level} | احساسات: ${analysis.sentiment} | موضوع: ${analysis.main_topic} | اطمینان: ${analysis.confidence}%`;

  const { error } = await supabase.from('alerts').insert({
    post_id: postId,
    alert_type: alertType,
    severity: analysis.threat_level,
    status: 'New',
    triggered_reason: triggeredReason
  });
  
  if (error) {
    console.error('Failed to create alert:', error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
