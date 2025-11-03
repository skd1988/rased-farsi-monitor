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
    const { limit, resumeFromIndex = 0, maxProcessingTime = 120000, batchId } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    // Generate or use existing batch ID
    const currentBatchId = batchId || `BATCH-${Date.now()}`;
    
    // Fetch unanalyzed posts directly (no ID array needed)
    let query = supabase
      .from('posts')
      .select('id, title, contents, source, language, published_at')
      .is('analyzed_at', null)
      .order('published_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data: allPosts, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw new Error(`Failed to fetch posts: ${fetchError.message}`);
    }
    
    if (!allPosts || allPosts.length === 0) {
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
            detailed_results: [],
            needsResume: false,
            lastProcessedIndex: 0,
            batchId: currentBatchId
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
    
    // Initialize or update progress tracking
    if (resumeFromIndex === 0) {
      // New batch - create progress record
      await supabase
        .from('batch_analysis_progress')
        .insert({
          batch_id: currentBatchId,
          total_posts: allPosts.length,
          processed_posts: 0,
          status: 'running'
        });
    } else {
      // Resume - update status
      await supabase
        .from('batch_analysis_progress')
        .update({ status: 'running' })
        .eq('batch_id', currentBatchId);
    }
    
    // Get subset of posts to process in this invocation
    const posts = allPosts.slice(resumeFromIndex);
    
    console.log(`Starting two-stage analysis for ${posts.length} posts (total unanalyzed: ${allPosts.length}, resuming from index: ${resumeFromIndex})`);
    
    const results = {
      total: posts.length,
      processed: 0,
      quick_only: 0,
      deep_analyzed: 0,
      failed: 0,
      alerts_created: 0,
      processing_time_ms: 0,
      estimated_old_time_ms: posts.length * 9000,
      time_saved_ms: 0,
      cost_saved_usd: 0,
      detailed_results: [] as any[],
      needsResume: false,
      lastProcessedIndex: resumeFromIndex,
      batchId: currentBatchId
    };
    
    const startTime = Date.now();
    
    // Process posts sequentially with timeout protection
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      
      // Check if approaching timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > maxProcessingTime) {
        console.warn(`⏱️ Approaching timeout at post ${i}, stopping gracefully`);
        results.needsResume = true;
        results.lastProcessedIndex = resumeFromIndex + i;
        break;
      }
      
      try {
        // Update progress BEFORE processing
        await supabase
          .from('batch_analysis_progress')
          .update({
            processed_posts: resumeFromIndex + i + 1,
            current_post_id: post.id,
            current_stage: 'starting'
          })
          .eq('batch_id', currentBatchId);
        
        // Validate post has required fields
        if (!post.title || !post.source) {
          console.warn(`⚠️ Post ${post.id} missing required fields, skipping`);
          results.failed++;
          results.processed++;
          results.lastProcessedIndex = resumeFromIndex + i + 1;
          
          // Update failed count
          await supabase
            .from('batch_analysis_progress')
            .update({ failed: results.failed })
            .eq('batch_id', currentBatchId);
          
          continue;
        }
        
        console.log(`[${i + 1}/${posts.length}] Processing: ${post.id}`);
        const postStartTime = Date.now();
        
        // STAGE 1: Quick Detection with error handling
        let quickResult;
        try {
          // Update stage
          await supabase
            .from('batch_analysis_progress')
            .update({ current_stage: 'quick_detection' })
            .eq('batch_id', currentBatchId);
          
          console.log(`  📊 Starting quick detection...`);
          quickResult = await performQuickDetection(post);
          const quickTime = Date.now() - postStartTime;
          
          console.log(`  ✅ Quick result - PsyOp: ${quickResult.is_psyop}, Threat: ${quickResult.threat_level}, Time: ${quickTime}ms`);
          
        } catch (error) {
          console.error(`  ❌ Quick detection failed for post ${post.id}:`, error);
          
          // Save as failed analysis
          await supabase
            .from('posts')
            .update({
              is_psyop: false,
              psyop_confidence: 0,
              threat_level: 'Low',
              analysis_summary: 'خطا در تحلیل سریع',
              analyzed_at: new Date().toISOString(),
              analysis_stage: 'error'
            })
            .eq('id', post.id);
          
          results.failed++;
          results.processed++;
          results.lastProcessedIndex = resumeFromIndex + i + 1;
          
          // Update failed count
          await supabase
            .from('batch_analysis_progress')
            .update({ 
              failed: results.failed,
              error_message: error instanceof Error ? error.message : 'Quick detection error'
            })
            .eq('batch_id', currentBatchId);
          
          results.detailed_results.push({
            post_id: post.id,
            stage: 'error',
            error: error instanceof Error ? error.message : 'Quick detection error',
            time_ms: Date.now() - postStartTime,
            status: 'error'
          });
          
          continue;
        }
        
        // STAGE 2: Deep Analysis (if needed)
        if (quickResult.needs_deep_analysis) {
          try {
            // Update stage
            await supabase
              .from('batch_analysis_progress')
              .update({ current_stage: 'deep_analysis' })
              .eq('batch_id', currentBatchId);
            
            console.log(`  🧠 Needs deep analysis, proceeding...`);
            
            const deepStartTime = Date.now();
            const deepResult = await performDeepAnalysis(post, quickResult);
            const deepTime = Date.now() - deepStartTime;
            
            console.log(`  ✅ Deep analysis complete in ${deepTime}ms`);
            
            // Save deep analysis result
            await saveAnalysisResult(supabase, post.id, deepResult, 'deep');
            
            // Create alert if needed
            if (deepResult.threat_level === 'Critical' || deepResult.threat_level === 'High') {
              await createAlert(supabase, post.id, deepResult);
              results.alerts_created++;
            }
            
            results.deep_analyzed++;
            
            // Update deep count
            await supabase
              .from('batch_analysis_progress')
              .update({ deep_analyzed: results.deep_analyzed })
              .eq('batch_id', currentBatchId);
            
            results.detailed_results.push({
              post_id: post.id,
              stage: 'deep',
              is_psyop: deepResult.is_psyop === "Yes",
              threat_level: deepResult.threat_level,
              time_ms: Date.now() - postStartTime,
              status: 'success'
            });
            
          } catch (error) {
            console.error(`  ❌ Deep analysis failed for post ${post.id}:`, error);
            
            // Fallback: save quick result only
            await saveAnalysisResult(supabase, post.id, quickResult, 'quick');
            results.quick_only++;
            
            // Update quick count
            await supabase
              .from('batch_analysis_progress')
              .update({ quick_only: results.quick_only })
              .eq('batch_id', currentBatchId);
            
            results.detailed_results.push({
              post_id: post.id,
              stage: 'quick_fallback',
              error: error instanceof Error ? error.message : 'Deep analysis failed',
              time_ms: Date.now() - postStartTime,
              status: 'partial'
            });
          }
          
        } else {
          // Save quick result only
          console.log(`  ✅ Not PsyOp, saving quick result only`);
          
          await saveAnalysisResult(supabase, post.id, quickResult, 'quick');
          
          results.quick_only++;
          
          // Update quick count
          await supabase
            .from('batch_analysis_progress')
            .update({ quick_only: results.quick_only })
            .eq('batch_id', currentBatchId);
          
          results.detailed_results.push({
            post_id: post.id,
            stage: 'quick',
            is_psyop: quickResult.is_psyop,
            threat_level: quickResult.threat_level,
            time_ms: Date.now() - postStartTime,
            status: 'success'
          });
        }
        
        results.processed++;
        results.lastProcessedIndex = resumeFromIndex + i + 1;
        
        // Delay to avoid rate limiting (1 second per request = max 60 requests/min)
        await sleep(1000);
        
      } catch (error) {
        console.error(`  ❌ Failed to process post ${post.id}:`, error);
        results.failed++;
        results.processed++;
        results.lastProcessedIndex = resumeFromIndex + i + 1;
        
        // Update failed count
        await supabase
          .from('batch_analysis_progress')
          .update({ 
            failed: results.failed,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('batch_id', currentBatchId);
        
        results.detailed_results.push({
          post_id: post.id,
          stage: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'error'
        });
        
        // Continue with next post instead of crashing
        continue;
      }
    }
    
    results.processing_time_ms = Date.now() - startTime;
    results.time_saved_ms = results.estimated_old_time_ms - results.processing_time_ms;
    results.cost_saved_usd = (results.quick_only * 0.0015);
    
    // Update final status
    if (results.needsResume) {
      await supabase
        .from('batch_analysis_progress')
        .update({ 
          status: 'paused',
          processed_posts: resumeFromIndex + results.processed
        })
        .eq('batch_id', currentBatchId);
    } else {
      await supabase
        .from('batch_analysis_progress')
        .update({ 
          status: 'completed',
          processed_posts: resumeFromIndex + results.processed,
          completed_at: new Date().toISOString()
        })
        .eq('batch_id', currentBatchId);
    }
    
    console.log('✅ Batch analysis completed:', {
      processed: results.processed,
      quick_only: results.quick_only,
      deep_analyzed: results.deep_analyzed,
      failed: results.failed,
      needsResume: results.needsResume,
      lastProcessedIndex: results.lastProcessedIndex,
      time: `${(results.processing_time_ms / 1000).toFixed(1)}s`
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        results: results,
        message: results.needsResume 
          ? `Processed ${results.processed} posts. Resume needed from index ${results.lastProcessedIndex}`
          : `Completed all ${results.processed} posts`
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
    
    // Update error status if we have a batch ID
    try {
      const { batchId } = await req.json();
      if (batchId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        
        await supabase
          .from('batch_analysis_progress')
          .update({ 
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('batch_id', batchId);
      }
    } catch (e) {
      console.error("Failed to update error status:", e);
    }
    
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

// STAGE 1: Quick Detection with retry logic
async function performQuickDetection(post: any, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
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
        // If rate limited or server error, retry with backoff
        if ((response.status === 429 || response.status === 503 || response.status === 504) && attempt < retries - 1) {
          const backoffDelay = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
          console.log(`⏳ Retrying quick detection after ${backoffDelay}ms (attempt ${attempt + 1}/${retries})...`);
          await sleep(backoffDelay);
          continue;
        }
        
        const errorText = await response.text();
        throw new Error(`Quick detection failed: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      if (attempt === retries - 1) throw error;
      
      const backoffDelay = Math.pow(2, attempt) * 2000;
      console.log(`⏳ Retrying quick detection after error (attempt ${attempt + 1}/${retries})...`);
      await sleep(backoffDelay);
    }
  }
  
  throw new Error('Quick detection failed after all retries');
}

// STAGE 2: Deep Analysis with retry logic
async function performDeepAnalysis(post: any, quickResult: any, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
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
            quickDetectionResult: quickResult
          })
        }
      );
      
      if (!response.ok) {
        // If rate limited or server error, retry with backoff
        if ((response.status === 429 || response.status === 503 || response.status === 504) && attempt < retries - 1) {
          const backoffDelay = Math.pow(2, attempt) * 3000; // 3s, 6s, 12s
          console.log(`⏳ Retrying deep analysis after ${backoffDelay}ms (attempt ${attempt + 1}/${retries})...`);
          await sleep(backoffDelay);
          continue;
        }
        
        const errorText = await response.text();
        throw new Error(`Deep analysis failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Deep analysis failed');
      }
      
      return data.analysis;
      
    } catch (error) {
      if (attempt === retries - 1) throw error;
      
      const backoffDelay = Math.pow(2, attempt) * 3000;
      console.log(`⏳ Retrying deep analysis after error (attempt ${attempt + 1}/${retries})...`);
      await sleep(backoffDelay);
    }
  }
  
  throw new Error('Deep analysis failed after all retries');
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
    updateData.sentiment = result.is_psyop ? 'Negative' : 'Neutral';  // Use English values for constraint
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
