import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📚 Intelligent Archive started...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // تاریخ دیروز
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    
    console.log(`📅 Archiving data for: ${yesterdayDate}`);

    const results = {
      date: yesterdayDate,
      daily_digest: false,
      significant_posts: 0,
      campaigns: 0,
      source_timeline: 0,
      attack_vectors: 0,
      narratives: 0,
      target_attacks: 0,
      errors: []
    };

    // ========================================
    // STEP 1: Create Daily Intelligence Digest
    // ========================================
    try {
      console.log('📊 Creating daily digest...');
      
      const { data: statsData } = await supabase.rpc('calculate_daily_stats', {
        target_date: yesterdayDate
      });

      const { data: topSourcesData } = await supabase.rpc('get_top_sources', {
        target_date: yesterdayDate,
        limit_count: 10
      });

      const { data: keywordsData } = await supabase.rpc('extract_trending_keywords', {
        target_date: yesterdayDate,
        limit_count: 20
      });

      const stats = statsData || {};
      const topSources = topSourcesData || [];
      const keywords = keywordsData || [];

      // Calculate percentage
      const psyopPercentage = stats.total_posts > 0 
        ? (stats.psyop_detected / stats.total_posts) * 100 
        : 0;

      const avgSentiment = stats.total_posts > 0
        ? ((stats.sentiment_positive - stats.sentiment_negative) / stats.total_posts)
        : 0;

      // Insert daily digest
      const { error: digestError } = await supabase
        .from('daily_intelligence_digest')
        .upsert({
          digest_date: yesterdayDate,
          total_posts: stats.total_posts || 0,
          total_analyzed: stats.total_analyzed || 0,
          critical_threats: stats.critical_threats || 0,
          high_threats: stats.high_threats || 0,
          medium_threats: stats.medium_threats || 0,
          low_threats: stats.low_threats || 0,
          psyop_detected: stats.psyop_detected || 0,
          psyop_percentage: parseFloat(psyopPercentage.toFixed(2)),
          sentiment_positive: stats.sentiment_positive || 0,
          sentiment_neutral: stats.sentiment_neutral || 0,
          sentiment_negative: stats.sentiment_negative || 0,
          avg_sentiment_score: parseFloat(avgSentiment.toFixed(2)),
          persian_posts: stats.persian_posts || 0,
          arabic_posts: stats.arabic_posts || 0,
          english_posts: stats.english_posts || 0,
          top_sources: topSources,
          most_active_source: topSources[0]?.source || null,
          trending_keywords: keywords
        }, {
          onConflict: 'digest_date'
        });

      if (digestError) throw digestError;
      results.daily_digest = true;
      console.log('✅ Daily digest created');

    } catch (error) {
      console.error('❌ Daily digest error:', error);
      results.errors.push({ step: 'daily_digest', error: error.message });
    }

    // ========================================
    // STEP 2: Archive Significant Posts
    // ========================================
    try {
      console.log('⭐ Archiving significant posts...');
      
      const startTime = new Date(yesterdayDate);
      const endTime = new Date(yesterdayDate);
      endTime.setDate(endTime.getDate() + 1);

      const { data: significantPosts } = await supabase
        .from('posts')
        .select('*')
        .gte('created_at', startTime.toISOString())
        .lt('created_at', endTime.toISOString())
        .in('threat_level', ['Critical', 'High'])
        .eq('is_psyop', true);

      if (significantPosts && significantPosts.length > 0) {
        const archiveData = significantPosts.map(post => ({
          original_post_id: post.id,
          archived_date: yesterdayDate,
          title: post.title,
          summary: post.analysis_summary || post.title,
          source: post.source,
          article_url: post.article_url,
          published_at: post.published_at,
          threat_level: post.threat_level,
          is_psyop: post.is_psyop,
          psyop_type: post.psyop_type,
          sentiment: post.sentiment,
          sentiment_score: post.sentiment_score,
          targets_mentioned: post.target_entity || [],
          main_topic: post.main_topic,
          keywords: post.keywords || [],
          archive_reason: `${post.threat_level} threat level`,
          language: post.language
        }));

        const { error: archiveError } = await supabase
          .from('significant_posts_archive')
          .insert(archiveData);

        if (archiveError) throw archiveError;
        results.significant_posts = significantPosts.length;
        console.log(`✅ Archived ${significantPosts.length} significant posts`);
      }

    } catch (error) {
      console.error('❌ Significant posts error:', error);
      results.errors.push({ step: 'significant_posts', error: error.message });
    }

    // ========================================
    // STEP 3: Archive Attack Vectors History
    // ========================================
    try {
      console.log('🎯 Archiving attack vectors...');
      
      const { data: vectorsData } = await supabase.rpc('calculate_daily_attack_vectors', {
        target_date: yesterdayDate
      });

      if (vectorsData && Object.keys(vectorsData).length > 0) {
        const vectorRecords = Object.entries(vectorsData).map(([vector, data]: [string, any]) => ({
          vector_name: vector,
          date: yesterdayDate,
          usage_count: data.count || 0,
          critical_count: data.critical || 0,
          high_count: data.high || 0,
          sources: data.sources || [],
          targets: data.targets || [],
          avg_threat_level: ((data.critical * 4 + data.high * 3) / data.count).toFixed(2)
        }));

        const { error: vectorError } = await supabase
          .from('attack_vector_history')
          .upsert(vectorRecords, {
            onConflict: 'vector_name,date'
          });

        if (vectorError) throw vectorError;
        results.attack_vectors = vectorRecords.length;
        console.log(`✅ Archived ${vectorRecords.length} attack vectors`);
      }

    } catch (error) {
      console.error('❌ Attack vectors error:', error);
      results.errors.push({ step: 'attack_vectors', error: error.message });
    }

    // ========================================
    // STEP 4: Archive Narratives History
    // ========================================
    try {
      console.log('📖 Archiving narratives...');
      
      const { data: narrativesData } = await supabase.rpc('calculate_daily_narratives', {
        target_date: yesterdayDate
      });

      if (narrativesData && Object.keys(narrativesData).length > 0) {
        const narrativeRecords = Object.entries(narrativesData).map(([narrative, data]: [string, any]) => ({
          narrative_theme: narrative,
          date: yesterdayDate,
          usage_count: data.count || 0,
          sources: data.sources || [],
          targets: data.targets || [],
          attack_vectors: data.vectors || []
        }));

        const { error: narrativeError } = await supabase
          .from('narrative_history')
          .upsert(narrativeRecords, {
            onConflict: 'narrative_theme,date'
          });

        if (narrativeError) throw narrativeError;
        results.narratives = narrativeRecords.length;
        console.log(`✅ Archived ${narrativeRecords.length} narratives`);
      }

    } catch (error) {
      console.error('❌ Narratives error:', error);
      results.errors.push({ step: 'narratives', error: error.message });
    }

    // ========================================
    // STEP 5: Archive Target Attacks History
    // ========================================
    try {
      console.log('👥 Archiving target attacks...');
      
      const { data: targetsData } = await supabase.rpc('calculate_daily_target_attacks', {
        target_date: yesterdayDate
      });

      if (targetsData && Object.keys(targetsData).length > 0) {
        const targetRecords = Object.entries(targetsData).map(([targetName, data]: [string, any]) => ({
          target_name: targetName,
          target_type: data.type || 'Entity',
          date: yesterdayDate,
          attack_count: data.count || 0,
          critical_attacks: data.critical || 0,
          high_attacks: data.high || 0,
          attack_vectors: data.vectors || [],
          narratives: data.narratives || [],
          sources: data.sources || [],
          avg_threat_level: ((data.critical * 4 + data.high * 3) / data.count).toFixed(2)
        }));

        const { error: targetError } = await supabase
          .from('target_attack_history')
          .upsert(targetRecords, {
            onConflict: 'target_name,target_type,date'
          });

        if (targetError) throw targetError;
        results.target_attacks = targetRecords.length;
        console.log(`✅ Archived ${targetRecords.length} target attacks`);
      }

    } catch (error) {
      console.error('❌ Target attacks error:', error);
      results.errors.push({ step: 'target_attacks', error: error.message });
    }

    // ========================================
    // Summary
    // ========================================
    console.log('✅ Intelligent Archive completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Intelligent Archive error:', error);
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
