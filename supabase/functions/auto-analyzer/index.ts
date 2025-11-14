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

        console.log(`🔍 Analyzing post: ${item.posts.title.substring(0, 50)}...`);

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
              source: item.posts.source
            })
          }
        );

        if (!quickResponse.ok) {
          throw new Error(`Quick analysis failed: ${quickResponse.status}`);
        }

        const quickData = await quickResponse.json();
        console.log(`✅ Quick analysis: is_psyop=${quickData.result.is_psyop}, threat=${quickData.result.threat_level}`);

        // Update post with quick analysis results
        await supabase
          .from('posts')
          .update({
            is_psyop: quickData.result.is_psyop,
            threat_level: quickData.result.threat_level,
            analysis_stage: 'quick',
            analyzed_at: new Date().toISOString()
          })
          .eq('id', item.post_id);

        // If needs deep analysis, call analyze-post-deepseek
        if (quickData.result.needs_deep_analysis) {
          console.log(`🔬 Running deep analysis...`);
          
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
            console.warn(`⚠️ Deep analysis failed: ${deepResponse.status}`);
            // Continue anyway, quick analysis is done
          } else {
            console.log(`✅ Deep analysis completed`);
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
