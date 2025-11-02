import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { timeRange = 7 } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    // Get PsyOp posts from time range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);
    
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('is_psyop', true)
      .gte('published_at', startDate.toISOString())
      .order('published_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`📊 Analyzing ${posts?.length || 0} PsyOp posts for campaigns`);
    
    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ campaigns: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Detect campaigns using multiple methods
    const campaigns = [];
    
    console.log('🔍 METHOD 1: Detecting keyword clusters...');
    const keywordCampaigns = detectKeywordClusters(posts);
    campaigns.push(...keywordCampaigns);
    console.log(`Found ${keywordCampaigns.length} keyword campaigns`);
    
    console.log('🔍 METHOD 2: Detecting narrative synchronization...');
    const narrativeCampaigns = detectNarrativeSynchronization(posts);
    campaigns.push(...narrativeCampaigns);
    console.log(`Found ${narrativeCampaigns.length} narrative campaigns`);
    
    console.log('🔍 METHOD 3: Detecting source coordination...');
    const sourceCoordination = detectSourceCoordination(posts);
    campaigns.push(...sourceCoordination);
    console.log(`Found ${sourceCoordination.length} coordinated campaigns`);
    
    console.log('🔍 METHOD 4: Detecting timing patterns...');
    const timingCampaigns = detectTimingPatterns(posts);
    campaigns.push(...timingCampaigns);
    console.log(`Found ${timingCampaigns.length} timing pattern campaigns`);
    
    // Merge and deduplicate campaigns
    console.log('🔄 Merging similar campaigns...');
    const mergedCampaigns = mergeSimilarCampaigns(campaigns);
    
    // Calculate campaign metrics
    const enrichedCampaigns = mergedCampaigns.map(campaign => ({
      ...campaign,
      id: generateCampaignId(campaign),
      intensity: calculateIntensity(campaign),
      reach: estimateReach(campaign),
      threat_level: assessThreatLevel(campaign),
      status: determineStatus(campaign)
    }));
    
    // Sort by intensity
    enrichedCampaigns.sort((a, b) => b.intensity - a.intensity);
    
    console.log(`✅ Detected ${enrichedCampaigns.length} unique campaigns`);
    
    return new Response(
      JSON.stringify({ campaigns: enrichedCampaigns }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
    
  } catch (error) {
    console.error("❌ Campaign detection error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// METHOD 1: Keyword Clustering
function detectKeywordClusters(posts: any[]): any[] {
  const campaigns = [];
  const keywordGroups: Record<string, any[]> = {};
  
  // Group posts by shared keywords
  posts.forEach(post => {
    const keywords = post.keywords || [];
    keywords.forEach((keyword: string) => {
      if (!keywordGroups[keyword]) {
        keywordGroups[keyword] = [];
      }
      keywordGroups[keyword].push(post);
    });
  });
  
  // Find clusters with 3+ posts in 48 hours
  for (const [keyword, postsWithKeyword] of Object.entries(keywordGroups)) {
    if (postsWithKeyword.length >= 3) {
      // Check timing
      const timestamps = postsWithKeyword.map(p => new Date(p.published_at).getTime());
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      const hoursDiff = (maxTime - minTime) / (1000 * 60 * 60);
      
      if (hoursDiff <= 48) {
        campaigns.push({
          type: 'keyword_cluster',
          campaign_name: `کمپین کلیدواژه: ${keyword}`,
          campaign_type: 'Keyword Clustering',
          primary_keyword: keyword,
          posts: postsWithKeyword,
          timespan_hours: hoursDiff,
          detection_method: 'Keyword Clustering',
          orchestrator: 'Unknown'
        });
      }
    }
  }
  
  return campaigns;
}

// METHOD 2: Narrative Synchronization
function detectNarrativeSynchronization(posts: any[]): any[] {
  const campaigns = [];
  const narrativeGroups: Record<string, any[]> = {};
  
  // Group by narrative_theme + target
  posts.forEach(post => {
    if (post.narrative_theme && post.target_entity) {
      const targets = Array.isArray(post.target_entity) ? post.target_entity : [post.target_entity];
      targets.forEach((target: string) => {
        const key = `${post.narrative_theme}:${target}`;
        if (!narrativeGroups[key]) {
          narrativeGroups[key] = [];
        }
        narrativeGroups[key].push(post);
      });
    }
  });
  
  // Find synchronized narratives (4+ posts, multiple sources)
  for (const [key, postsInGroup] of Object.entries(narrativeGroups)) {
    if (postsInGroup.length >= 4) {
      const [narrative, target] = key.split(':');
      const sources = new Set(postsInGroup.map(p => p.source));
      
      if (sources.size >= 2) {
        campaigns.push({
          type: 'narrative_sync',
          campaign_name: `کمپین روایتی: ${narrative} علیه ${target}`,
          campaign_type: 'Narrative Synchronization',
          narrative_theme: narrative,
          main_target: target,
          posts: postsInGroup,
          sources: Array.from(sources),
          detection_method: 'Narrative Synchronization',
          orchestrator: 'Coordinated Network'
        });
      }
    }
  }
  
  return campaigns;
}

// METHOD 3: Source Coordination
function detectSourceCoordination(posts: any[]): any[] {
  const campaigns = [];
  const processed = new Set();
  
  // Find posts with similar titles from different sources within 24 hours
  for (let i = 0; i < posts.length; i++) {
    if (processed.has(posts[i].id)) continue;
    
    const similarPosts = [posts[i]];
    const baseTime = new Date(posts[i].published_at).getTime();
    
    for (let j = i + 1; j < posts.length; j++) {
      if (processed.has(posts[j].id)) continue;
      
      const timeDiff = Math.abs(baseTime - new Date(posts[j].published_at).getTime());
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff <= 24 && posts[i].source !== posts[j].source) {
        const similarity = calculateTitleSimilarity(posts[i].title, posts[j].title);
        if (similarity > 0.6) {
          similarPosts.push(posts[j]);
          processed.add(posts[j].id);
        }
      }
    }
    
    if (similarPosts.length >= 3) {
      processed.add(posts[i].id);
      const sources = new Set(similarPosts.map(p => p.source));
      campaigns.push({
        type: 'source_coordination',
        campaign_name: `کمپین هماهنگ: ${similarPosts[0].title.substring(0, 50)}...`,
        campaign_type: 'Source Coordination',
        posts: similarPosts,
        sources: Array.from(sources),
        detection_method: 'Source Coordination',
        orchestrator: 'Multi-Source Network'
      });
    }
  }
  
  return campaigns;
}

// METHOD 4: Timing Patterns
function detectTimingPatterns(posts: any[]): any[] {
  const campaigns = [];
  
  // Group by hour bins
  const hourlyBins: Record<string, any[]> = {};
  
  posts.forEach(post => {
    const date = new Date(post.published_at);
    const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    
    if (!hourlyBins[hourKey]) {
      hourlyBins[hourKey] = [];
    }
    hourlyBins[hourKey].push(post);
  });
  
  // Find unusual spikes (3x normal)
  const avgPerHour = posts.length / Object.keys(hourlyBins).length;
  
  for (const [hourKey, postsInHour] of Object.entries(hourlyBins)) {
    if (postsInHour.length >= avgPerHour * 3 && postsInHour.length >= 5) {
      campaigns.push({
        type: 'timing_spike',
        campaign_name: `اوج فعالیت غیرعادی: ${new Date(postsInHour[0].published_at).toLocaleString('fa-IR')}`,
        campaign_type: 'Timing Pattern',
        posts: postsInHour,
        spike_ratio: postsInHour.length / avgPerHour,
        detection_method: 'Timing Pattern Analysis',
        orchestrator: 'Coordinated Timing'
      });
    }
  }
  
  return campaigns;
}

// Helper functions
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.toLowerCase().split(/\s+/));
  const words2 = new Set(title2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

function mergeSimilarCampaigns(campaigns: any[]): any[] {
  const merged = [];
  const used = new Set();
  
  for (const campaign of campaigns) {
    if (used.has(campaign)) continue;
    
    const postIds = new Set(campaign.posts.map((p: any) => p.id));
    
    let isDuplicate = false;
    for (const existingCampaign of merged) {
      const existingIds = new Set(existingCampaign.posts.map((p: any) => p.id));
      const overlap = [...postIds].filter(id => existingIds.has(id)).length;
      
      if (overlap / postIds.size > 0.5) {
        isDuplicate = true;
        // Merge into existing
        const allPosts = [...existingCampaign.posts, ...campaign.posts];
        const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values());
        existingCampaign.posts = uniquePosts;
        break;
      }
    }
    
    if (!isDuplicate) {
      merged.push(campaign);
    }
    
    used.add(campaign);
  }
  
  return merged;
}

function generateCampaignId(campaign: any): string {
  const postIds = campaign.posts.map((p: any) => p.id).sort().join(',');
  const hash = postIds.substring(0, 8);
  return `CAMPAIGN-${hash}`;
}

function calculateIntensity(campaign: any): number {
  const postCount = campaign.posts.length;
  const sourceCount = new Set(campaign.posts.map((p: any) => p.source)).size;
  const timespan = campaign.timespan_hours || 24;
  
  return Math.round((postCount * 10) + (sourceCount * 5) + (1 / (timespan / 24) * 20));
}

function estimateReach(campaign: any): number {
  return campaign.posts.length * 10000;
}

function assessThreatLevel(campaign: any): string {
  const intensity = campaign.intensity || 0;
  const highThreat = campaign.posts.filter((p: any) => 
    p.threat_level === 'Critical' || p.threat_level === 'High'
  ).length;
  
  if (intensity > 100 || highThreat > 5) return 'Critical';
  if (intensity > 50 || highThreat > 2) return 'High';
  if (intensity > 20) return 'Medium';
  return 'Low';
}

function determineStatus(campaign: any): string {
  const latestPost = campaign.posts.sort((a: any, b: any) => 
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  )[0];
  
  const hoursSinceLatest = (Date.now() - new Date(latestPost.published_at).getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceLatest < 6) return 'Active';
  if (hoursSinceLatest < 24) return 'Monitoring';
  if (hoursSinceLatest < 72) return 'Declining';
  return 'Ended';
}
