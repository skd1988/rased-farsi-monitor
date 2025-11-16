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

    // STEP 1: Archive important posts FIRST (before deletion)
    const { data: archivedPosts, error: archiveError } = await supabase
      .from('posts')
      .update({ status: 'Archived' })
      .lt('created_at', cutoffDate.toISOString())
      .neq('status', 'Archived')  // فقط پست‌هایی که قبلاً archived نشده‌اند
      .or('threat_level.in.(High,Critical),is_psyop.eq.true')
      .select('id, title, threat_level, is_psyop');

    if (archiveError) {
      console.error('❌ Archive error:', archiveError);
      throw archiveError;
    }

    const postsArchived = archivedPosts?.length || 0;
    console.log(`📦 Archived ${postsArchived} important posts`);

    // Log sample of archived posts
    if (postsArchived > 0 && archivedPosts.length > 0) {
      console.log('📋 Sample archived posts:');
      archivedPosts.slice(0, 3).forEach(p => {
        console.log(`  - ${p.title?.substring(0, 50)} (${p.threat_level}, PsyOp: ${p.is_psyop})`);
      });
    }

    // STEP 2: Delete low-priority posts (after archiving important ones)
    const { data: deletedPosts, error: deleteError } = await supabase
      .from('posts')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .in('threat_level', ['Low', 'Medium'])
      .eq('is_psyop', false)
      .select('id, title, threat_level');

    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
      throw deleteError;
    }

    const postsDeleted = deletedPosts?.length || 0;
    console.log(`🗑️ Deleted ${postsDeleted} old low-threat posts`);

    // Log sample of deleted posts
    if (postsDeleted > 0 && deletedPosts.length > 0) {
      console.log('📋 Sample deleted posts:');
      deletedPosts.slice(0, 3).forEach(p => {
        console.log(`  - ${p.title?.substring(0, 50)} (${p.threat_level})`);
      });
    }

    // Reset 30-day counters once per day
    const today = new Date().toISOString().split('T')[0];
    const { data: lastReset } = await supabase
      .from('auto_analysis_config')
      .select('config_value')
      .eq('config_key', 'last_counter_reset')
      .single();

    if (lastReset?.config_value !== today) {
      console.log('🔄 Resetting 30-day counters...');

      // Reset source profiles
      const { error: resetSourcesError } = await supabase
        .from('source_profiles')
        .update({ last_30days_psyop_count: 0 });

      if (resetSourcesError) {
        console.error('❌ Error resetting source profiles:', resetSourcesError);
      }

      // Reset channels
      const { error: resetChannelsError } = await supabase
        .from('social_media_channels')
        .update({ last_30days_psyop_count: 0 });

      if (resetChannelsError) {
        console.error('❌ Error resetting channels:', resetChannelsError);
      }

      // Update last reset date
      const { error: upsertError } = await supabase
        .from('auto_analysis_config')
        .upsert({
          config_key: 'last_counter_reset',
          config_value: today
        });

      if (upsertError) {
        console.error('❌ Error updating last_counter_reset:', upsertError);
      } else {
        console.log('✅ Counters reset successfully');
      }
    }

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
