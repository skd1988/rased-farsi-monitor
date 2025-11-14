import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧹 Auto Cleanup started...');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get retention hours from config
    const { data: retentionConfig } = await supabase
      .from('auto_analysis_config')
      .select('config_value')
      .eq('config_key', 'posts_retention_hours')
      .single();

    const retentionHours = parseInt(retentionConfig?.config_value || '24');
    const cutoffDate = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

    console.log(`🕐 Retention: ${retentionHours} hours`);
    console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);

    // Smart delete: only Low/Medium threats that are NOT PsyOps
    const { data: deletedPosts, error: deleteError } = await supabase
      .from('posts')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .in('threat_level', ['Low', 'Medium'])
      .eq('is_psyop', false)
      .select('id');

    if (deleteError) {
      throw deleteError;
    }

    const postsDeleted = deletedPosts?.length || 0;
    console.log(`🗑️ Deleted ${postsDeleted} old low-threat posts`);

    // Archive important posts (High/Critical threats and PsyOps)
    const { data: archivedPosts, error: archiveError } = await supabase
      .from('posts')
      .update({ status: 'Archived' })
      .lt('created_at', cutoffDate.toISOString())
      .or('threat_level.in.(High,Critical),is_psyop.eq.true')
      .select('id');

    if (archiveError) throw archiveError;

    const postsArchived = archivedPosts?.length || 0;
    console.log(`📦 Archived ${postsArchived} important posts`);

    // Clean up old queue items
    const queueCleaned = await supabase.rpc('cleanup_analysis_queue');

    console.log(`🧹 Cleaned ${queueCleaned.data || 0} old queue items`);

    // Update stats (optional, just for tracking cleanup operations)
    const summary = {
      success: true,
      posts_deleted: postsDeleted,
      posts_archived: postsArchived,
      queue_cleaned: queueCleaned.data || 0,
      retention_hours: retentionHours,
      cutoff_date: cutoffDate.toISOString(),
      timestamp: new Date().toISOString()
    };

    console.log('✅ Auto Cleanup completed:', summary);

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Auto Cleanup error:', error);
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
