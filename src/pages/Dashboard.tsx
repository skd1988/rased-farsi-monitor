import React, { useState, useMemo, useEffect } from 'react';
import { translatePsyopTechnique } from '@/utils/psyopTranslations';
import { translateSourceType } from '@/utils/sourceTypeTranslations';
import { formatDistanceToNowIran, formatIranDate } from '@/lib/dateUtils';
import { Shield, AlertTriangle, Siren, Clock, Database, Rss, TrendingUp, Activity, Brain, Flame } from 'lucide-react';
import KPICard from '@/components/dashboard/KPICard';
import DataCollectionKPI from '@/components/dashboard/DataCollectionKPI';
import SourceTypeChart from '@/components/dashboard/SourceTypeChart';
import CollectionTimelineChart from '@/components/dashboard/CollectionTimelineChart';
import ThreatLevelTimeline from '@/components/dashboard/ThreatLevelTimeline';
import TargetedEntitiesChart from '@/components/dashboard/TargetedEntitiesChart';
import AttackVectorChart from '@/components/dashboard/AttackVectorChart';
import CampaignHeatmap from '@/components/dashboard/CampaignHeatmap';
import PostsTable from '@/components/dashboard/PostsTable';
import PostDetailModal from '@/components/dashboard/PostDetailModal';
import SocialMediaPieChart from '@/components/dashboard/SocialMediaPieChart';
import TopTargetedPersonsChart from '@/components/dashboard/TopTargetedPersonsChart';
import TopTargetedOrganizationsChart from '@/components/dashboard/TopTargetedOrganizationsChart';
import ModelCalibrationCard from '@/components/dashboard/ModelCalibrationCard';
import { SourceThreatChart } from '@/components/dashboard/SourceThreatChart';
import { EnrichedPost } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { startOfDay, subDays, eachDayOfInterval, format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Dashboard = () => {
  console.log('[Dashboard] Component mounting...');
  const navigate = useNavigate();
  const [selectedPost, setSelectedPost] = useState<EnrichedPost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [targetProfiles, setTargetProfiles] = useState<any[]>([]);
  const [socialMediaChannels, setSocialMediaChannels] = useState<any[]>([]);
  const [highThreatSourcesCount, setHighThreatSourcesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [psyopPosts, setPsyopPosts] = useState<EnrichedPost[]>([]);
  const [psyopPage, setPsyopPage] = useState(1);
  const [psyopTotalCount, setPsyopTotalCount] = useState(0);
  const psyopPageSize = 20;
  const [isLoadingPsyop, setIsLoadingPsyop] = useState(false);

  // Fetch real data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const since = subDays(startOfDay(new Date()), 30).toISOString();

        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .gte('published_at', since)
          .order('published_at', { ascending: false })
          .range(0, 999);

        if (postsError) throw postsError;

        // Fetch AI analysis data
        const { data: analysisData, error: analysisError } = await supabase
          .from('ai_analysis')
          .select('*');
        
        if (analysisError) throw analysisError;
        
        // Fetch campaigns data
        const { data: campaignsData, error: campaignsError } = await supabase
          .from('psyop_campaigns')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (campaignsError) throw campaignsError;
        
        // Fetch target profiles for photos
        const { data: profilesData, error: profilesError } = await supabase
          .from('target_profiles')
          .select('name_english, name_persian, name_arabic, photo_url');

        if (profilesError) console.error('Error fetching profiles:', profilesError);

        // Fetch social media channels for platform mapping and threat analysis
        console.log('📊 Fetching social media channels for platform mapping and threat analysis...');
        const { data: channelsData, error: channelsError } = await supabase
          .from('social_media_channels')
          .select('*')
          .limit(1000)
          .order('threat_multiplier', { ascending: false });

        if (channelsError) {
          console.error('❌ Error fetching channels:', channelsError);
        } else {
          console.log('📊 Platform mapping loaded:', {
            totalChannels: channelsData?.length || 0,
            platforms: [...new Set(channelsData?.map(ch => ch.platform))]
          });
          setSocialMediaChannels(channelsData || []);
        }

        // Fetch high threat sources count
        const { count: highThreatCount, error: sourcesError } = await supabase
          .from('source_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('active', true)
          .gte('threat_multiplier', 2.0);

        if (sourcesError) console.error('Error fetching sources:', sourcesError);

        setPosts(postsData || []);
        setAiAnalysis(analysisData || []);
        setCampaigns(campaignsData || []);
        setTargetProfiles(profilesData || []);
        setHighThreatSourcesCount(highThreatCount || 0);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "خطا در دریافت داده‌ها",
          description: "مشکلی در دریافت اطلاعات پیش آمد",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchPsyopPosts = async () => {
      try {
        setIsLoadingPsyop(true);
        const from = (psyopPage - 1) * psyopPageSize;
        const to = from + psyopPageSize - 1;

        const { data, error, count } = await supabase
          .from('posts')
          .select('id, title, source, published_at, psyop_risk_score, threat_level, sentiment, contents, source_url, author, language, status, article_url, keywords, source_country, stance_type, psyop_category, psyop_techniques', { count: 'exact' })
          .eq('is_psyop', true)
          .order('psyop_risk_score', { ascending: false })
          .range(from, to);

        if (error) throw error;

        const mappedPosts = (data || []).map(post => ({
          id: post.id,
          title: post.title,
          contents: post.contents || '',
          date: post.published_at,
          source: post.source,
          sourceURL: post.source_url || undefined,
          author: post.author || 'نامشخص',
          language: post.language || 'نامشخص',
          status: post.status || 'نامشخص',
          articleURL: post.article_url || '',
          keywords: post.keywords || [],
          source_country: post.source_country || null,
          psyop_risk_score: post.psyop_risk_score,
          threat_level: post.threat_level,
          sentiment: post.sentiment,
          stance_type: post.stance_type,
          psyop_category: post.psyop_category,
          psyop_techniques: post.psyop_techniques,
        } as EnrichedPost));

        setPsyopPosts(mappedPosts);
        setPsyopTotalCount(count || 0);
      } catch (error) {
        console.error('Error fetching psyop posts:', error);
        toast({
          title: "خطا در دریافت داده‌ها",
          description: "مشکلی در دریافت اطلاعات جنگ روانی پیش آمد",
          variant: "destructive",
        });
      } finally {
        setIsLoadingPsyop(false);
      }
    };

    fetchPsyopPosts();
  }, [psyopPage]);

  // Calculate KPIs
  const activePsyOpsToday = useMemo(() => {
    const today = startOfDay(new Date());
    return posts.filter(post => {
      const postDate = startOfDay(new Date(post.published_at));
      return post.is_psyop === true && postDate.getTime() === today.getTime();
    }).length;
  }, [posts]);

  const activePsyOpsYesterday = useMemo(() => {
    const yesterday = subDays(startOfDay(new Date()), 1);
    return posts.filter(post => {
      const postDate = startOfDay(new Date(post.published_at));
      return post.is_psyop === true && postDate.getTime() === yesterday.getTime();
    }).length;
  }, [posts]);

  const psyOpChangePercentage = activePsyOpsYesterday > 0 
    ? Math.round(((activePsyOpsToday - activePsyOpsYesterday) / activePsyOpsYesterday) * 100)
    : 0;

  const criticalThreats = useMemo(() => {
    return posts.filter(post => 
      post.threat_level === 'Critical' && post.status !== 'حل شده'
    ).length;
  }, [posts]);

  const activeCampaigns = useMemo(() => {
    return campaigns.filter(c => c.status === 'Active').length;
  }, [campaigns]);

  const pendingResponses = useMemo(() => {
    return posts.filter(post => 
      (post.threat_level === 'High' || post.threat_level === 'Critical') &&
      post.counter_narrative_ready === false
    ).length;
  }, [posts]);

  // Two-stage analysis breakdown
  const analysisBreakdown = useMemo(() => {
    const analyzed = posts.filter(post => post.analyzed_at);
    const quickCount = analyzed.filter(post => post.analysis_stage === 'quick').length;
    const deepCount = analyzed.filter(post => post.analysis_stage === 'deep').length;
    const totalAnalyzed = analyzed.length;
    
    return {
      total: totalAnalyzed,
      quick: quickCount,
      deep: deepCount,
      quickPercentage: totalAnalyzed > 0 ? Math.round((quickCount / totalAnalyzed) * 100) : 0,
      deepPercentage: totalAnalyzed > 0 ? Math.round((deepCount / totalAnalyzed) * 100) : 0
    };
  }, [posts]);

  const oldestPendingTime = useMemo(() => {
    const pending = posts.filter(post => 
      (post.threat_level === 'High' || post.threat_level === 'Critical') &&
      post.counter_narrative_ready === false
    );
    
    if (pending.length === 0) return null;
    
    const oldest = pending.reduce((oldest, current) => {
      return new Date(current.published_at) < new Date(oldest.published_at) ? current : oldest;
    });
    
    return formatDistanceToNowIran(oldest.published_at);
  }, [posts]);

  // Threat Level Timeline (last 30 days)
  const threatTimelineData = useMemo(() => {
    const days = 30;
    const data = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(startOfDay(today), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const dayPosts = posts.filter(post => {
        const postDate = startOfDay(new Date(post.published_at));
        return postDate.getTime() === date.getTime() && post.is_psyop === true;
      });
      
      data.push({
        date: dateStr,
        Critical: dayPosts.filter(p => p.threat_level === 'Critical').length,
        High: dayPosts.filter(p => p.threat_level === 'High').length,
        Medium: dayPosts.filter(p => p.threat_level === 'Medium').length,
        Low: dayPosts.filter(p => p.threat_level === 'Low').length,
      });
    }
    
    return data;
  }, [posts]);

  // Top Targeted Entities
  const targetedEntitiesData = useMemo(() => {
    const entityCounts: Record<string, { count: number; critical: number; high: number }> = {};
    
    posts.forEach(post => {
      if (post.is_psyop && post.target_entity && Array.isArray(post.target_entity)) {
        post.target_entity.forEach((entity: string) => {
          if (!entityCounts[entity]) {
            entityCounts[entity] = { count: 0, critical: 0, high: 0 };
          }
          entityCounts[entity].count += 1;
          if (post.threat_level === 'Critical') entityCounts[entity].critical += 1;
          if (post.threat_level === 'High') entityCounts[entity].high += 1;
        });
      }
    });
    
    const totalAttacks = Object.values(entityCounts).reduce((sum, e) => sum + e.count, 0);
    
    return Object.entries(entityCounts)
      .map(([entity, data]) => ({
        entity,
        count: data.count,
        percentage: totalAttacks > 0 ? (data.count / totalAttacks) * 100 : 0,
        severity: data.critical > 0 ? 'Critical' as const : 
                  data.high > 0 ? 'High' as const : 
                  'Medium' as const
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [posts]);

  // Attack Vector Distribution
  const attackVectorData = useMemo(() => {
    const vectorCounts: Record<string, number> = {};
    
    posts.forEach(post => {
      if (post.is_psyop && post.psyop_technique && Array.isArray(post.psyop_technique)) {
        post.psyop_technique.forEach((technique: string) => {
          vectorCounts[technique] = (vectorCounts[technique] || 0) + 1;
        });
      }
    });
    
    return Object.entries(vectorCounts)
      .map(([name, value]) => ({ 
        name: translatePsyopTechnique(name), 
        value 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [posts]);

  // Top Targeted Persons
  const topTargetedPersonsData = useMemo(() => {
    const personCounts: Record<string, { count: number; critical: number; high: number; data: any }> = {};
    
    posts.forEach(post => {
      if (post.is_psyop && post.target_persons && Array.isArray(post.target_persons)) {
        post.target_persons.forEach((person: any) => {
          let parsedPerson = person;
          if (typeof person === 'string') {
            try {
              parsedPerson = JSON.parse(person);
            } catch {
              parsedPerson = { name_persian: person };
            }
          }
          
          const key = parsedPerson.name_english || parsedPerson.name_persian || 'نامشخص';
          
          if (!personCounts[key]) {
            personCounts[key] = { count: 0, critical: 0, high: 0, data: parsedPerson };
          }
          personCounts[key].count += 1;
          if (post.threat_level === 'Critical') personCounts[key].critical += 1;
          if (post.threat_level === 'High') personCounts[key].high += 1;
        });
      }
    });
    
    const totalAttacks = Object.values(personCounts).reduce((sum, p) => sum + p.count, 0);
    
    return Object.entries(personCounts)
      .map(([key, info]) => {
        // Find photo from profiles
        const profile = targetProfiles.find(p => 
          p.name_english === info.data.name_english || 
          p.name_persian === info.data.name_persian
        );
        
        return {
          name_persian: info.data.name_persian || key,
          name_english: info.data.name_english,
          name_arabic: info.data.name_arabic,
          photo_url: profile?.photo_url,
          count: info.count,
          percentage: totalAttacks > 0 ? (info.count / totalAttacks) * 100 : 0,
          severity: info.critical > 0 ? 'Critical' as const : 
                    info.high > 0 ? 'High' as const : 
                    'Medium' as const
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [posts, targetProfiles]);

  // Top Targeted Organizations
  const topTargetedOrganizationsData = useMemo(() => {
    const orgCounts: Record<string, { count: number; critical: number; high: number; data: any }> = {};
    
    posts.forEach(post => {
      if (post.is_psyop && post.target_entity && Array.isArray(post.target_entity)) {
        post.target_entity.forEach((entity: any) => {
          let parsedEntity = entity;
          if (typeof entity === 'string') {
            try {
              parsedEntity = JSON.parse(entity);
            } catch {
              parsedEntity = { name_persian: entity };
            }
          }
          
          const key = parsedEntity.name_english || parsedEntity.name_persian || 'نامشخص';
          
          if (!orgCounts[key]) {
            orgCounts[key] = { count: 0, critical: 0, high: 0, data: parsedEntity };
          }
          orgCounts[key].count += 1;
          if (post.threat_level === 'Critical') orgCounts[key].critical += 1;
          if (post.threat_level === 'High') orgCounts[key].high += 1;
        });
      }
    });
    
    const totalAttacks = Object.values(orgCounts).reduce((sum, o) => sum + o.count, 0);
    
    return Object.entries(orgCounts)
      .map(([key, info]) => {
        // Find photo from profiles
        const profile = targetProfiles.find(p => 
          p.name_english === info.data.name_english || 
          p.name_persian === info.data.name_persian
        );
        
        return {
          name_persian: info.data.name_persian || key,
          name_english: info.data.name_english,
          name_arabic: info.data.name_arabic,
          photo_url: profile?.photo_url,
          count: info.count,
          percentage: totalAttacks > 0 ? (info.count / totalAttacks) * 100 : 0,
          severity: info.critical > 0 ? 'Critical' as const : 
                    info.high > 0 ? 'High' as const : 
                    'Medium' as const
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [posts, targetProfiles]);

  // Top Risky Channels - SYNCED with ChannelAnalytics
  const topRiskyChannelsData = useMemo(() => {
    console.log('🔥 [Dashboard] Calculating Top Risky Channels (synced with ChannelAnalytics)...');
    console.log('📊 [Dashboard] socialMediaChannels count:', socialMediaChannels.length);

    if (socialMediaChannels.length === 0) {
      console.warn('⚠️ [Dashboard] No social media channels loaded yet');
      return [];
    }

    // ✅ EXACT same logic as ChannelAnalytics
    const result = [...socialMediaChannels]
      .sort((a, b) => b.threat_multiplier - a.threat_multiplier)
      .slice(0, 10)
      .map(c => ({
        channel_name: c.channel_name,
        threat_score: Math.round(c.threat_multiplier * c.reach_score * c.virality_coefficient),
        threat_multiplier: c.threat_multiplier
      }));

    console.log('✅ [Dashboard] Top 10 Risky Channels:', result.map(c => ({
      name: c.channel_name,
      score: c.threat_score,
      multiplier: c.threat_multiplier
    })));

    return result;
  }, [socialMediaChannels]); // ⚠️ فقط به socialMediaChannels وابسته است

  // Campaign Heatmap (last 90 days)
  const heatmapData = useMemo(() => {
    const days = 90;
    const data = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(startOfDay(today), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const count = posts.filter(post => {
        const postDate = startOfDay(new Date(post.published_at));
        return postDate.getTime() === date.getTime() && post.is_psyop === true;
      }).length;
      
      data.push({ date: dateStr, count });
    }
    
    return data;
  }, [posts]);

  const totalPostsPages = Math.max(1, Math.ceil(psyopTotalCount / psyopPageSize));
  
  const handleViewPost = (post: EnrichedPost) => {
    setSelectedPost(post);
    setIsModalOpen(true);
  };

  const handleDayClick = (date: string) => {
    // Navigate to Posts Explorer with date filter
    navigate(`/posts?date=${date}`);
  };

  // Data Collection Metrics
  const totalPosts = posts.length;
  const postsYesterday = useMemo(() => {
    const yesterday = subDays(startOfDay(new Date()), 1);
    return posts.filter(post => {
      const postDate = startOfDay(new Date(post.published_at));
      return postDate.getTime() === yesterday.getTime();
    }).length;
  }, [posts]);

  const totalPostsChangePercentage = postsYesterday > 0 
    ? Math.round(((totalPosts - postsYesterday) / postsYesterday) * 100)
    : 0;

  const postsLast24h = useMemo(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return posts.filter(post => new Date(post.published_at) >= yesterday).length;
  }, [posts]);

  const activeSources = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const recentSources = new Set(
      posts
        .filter(post => new Date(post.published_at) >= sevenDaysAgo)
        .map(post => post.source)
    );
    return recentSources.size;
  }, [posts]);

  const totalSources = useMemo(() => {
    return new Set(posts.map(post => post.source)).size;
  }, [posts]);

  const postsToday = useMemo(() => {
    const today = startOfDay(new Date());
    return posts.filter(post => {
      const postDate = startOfDay(new Date(post.published_at));
      return postDate.getTime() === today.getTime();
    }).length;
  }, [posts]);

  const hourlyRate = useMemo(() => {
    const hoursElapsed = new Date().getHours() || 1;
    return (postsToday / hoursElapsed).toFixed(1);
  }, [postsToday]);

  const expectedDailyVolume = 100; // Configure this based on your needs
  const collectionHealth = Math.min(100, Math.round((postsToday / expectedDailyVolume) * 100));
  const healthStatus: 'good' | 'warning' | 'error' = 
    collectionHealth >= 80 ? 'good' : collectionHealth >= 50 ? 'warning' : 'error';

  // Source Type Distribution
  const sourceTypeData = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    
    posts.forEach(post => {
      const type = post.source_type || 'other';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .map(([name, value]) => ({ 
        name: translateSourceType(name), 
        value 
      }))
      .sort((a, b) => b.value - a.value);
  }, [posts]);

  // Collection Timeline (last 7 days)
  const collectionTimelineData = useMemo(() => {
    const days = 7;
    const data = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(startOfDay(today), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const count = posts.filter(post => {
        const postDate = startOfDay(new Date(post.published_at));
        return postDate.getTime() === date.getTime();
      }).length;
      
      data.push({ date: dateStr, count });
    }
    
    return data;
  }, [posts]);

  // Social Media Distribution
  const socialMediaData = useMemo(() => {
    console.log('📈 Calculating social media distribution...');

    const platformCounts: Record<string, number> = {};

    posts.forEach(post => {
      const source = post.source?.toLowerCase() || '';
      const sourceUrl = post.source_url?.toLowerCase() || '';
      const searchText = `${source} ${sourceUrl}`;

      let platform = '';

      if (searchText.includes('telegram') || searchText.includes('تلگرام') || searchText.includes('t.me')) {
        platform = 'تلگرام';
      } else if (searchText.includes('twitter') || searchText.includes('توییتر') || searchText.includes('x.com')) {
        platform = 'توییتر (X)';
      } else if (searchText.includes('instagram') || searchText.includes('اینستاگرام')) {
        platform = 'اینستاگرام';
      } else if (searchText.includes('facebook') || searchText.includes('فیسبوک')) {
        platform = 'فیسبوک';
      } else if (searchText.includes('youtube') || searchText.includes('یوتیوب')) {
        platform = 'یوتیوب';
      } else if (searchText.includes('whatsapp') || searchText.includes('واتساپ')) {
        platform = 'واتساپ';
      }

      if (platform) {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      }
    });

    console.log('✅ Platform counts:', platformCounts);

    const colors = {
      'تلگرام': 'hsl(200, 98%, 39%)',
      'توییتر (X)': 'hsl(203, 89%, 53%)',
      'اینستاگرام': 'hsl(340, 75%, 55%)',
      'فیسبوک': 'hsl(221, 44%, 41%)',
      'یوتیوب': 'hsl(0, 100%, 50%)',
      'واتساپ': 'hsl(142, 70%, 49%)',
      'سایر': 'hsl(215, 20%, 65%)'
    };

    return Object.entries(platformCounts)
      .map(([name, value]) => ({
        name,
        value,
        fill: colors[name as keyof typeof colors] || colors['سایر']
      }))
      .sort((a, b) => b.value - a.value);
  }, [posts]);

  // Calculate source threat data for chart
  const sourceThreatData = useMemo(() => {
    const sourceMap = new Map<string, { count: number; threat_multiplier: number }>();

    posts.forEach(post => {
      if (!post.source) return;

      const current = sourceMap.get(post.source) || { count: 0, threat_multiplier: 1.0 };
      current.count++;
      // Get threat multiplier from post (if calculated) or use default
      if (post.source_impact_score) {
        // Estimate threat multiplier from impact score (reverse calculation)
        current.threat_multiplier = Math.max(current.threat_multiplier,
          post.source_impact_score > 600 ? 2.0 :
          post.source_impact_score > 400 ? 1.5 : 1.0
        );
      }
      sourceMap.set(post.source, current);
    });

    return Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source,
        count: data.count,
        threat_multiplier: data.threat_multiplier
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 sources
  }, [posts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Data Collection Status Section */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-lg space-y-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            📊 وضعیت جمع‌آوری داده
          </h2>
          <p className="text-sm text-muted-foreground">
            رصد سیستم و معیارهای دریافت داده
          </p>
        </div>

        {/* Data Collection KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <DataCollectionKPI
            title="کل پست‌های جمع‌آوری شده"
            value={totalPosts.toLocaleString('fa-IR')}
            subtitle={`24 ساعت اخیر: ${postsLast24h} پست`}
            icon={Database}
            colorScheme="blue"
            trend={totalPostsChangePercentage > 0 ? `↑ ${totalPostsChangePercentage}%` : totalPostsChangePercentage < 0 ? `↓ ${Math.abs(totalPostsChangePercentage)}%` : '—'}
            onClick={() => navigate('/posts')}
          />
          <DataCollectionKPI
            title="منابع فعال"
            value={activeSources}
            subtitle={`کل تنظیم شده: ${totalSources} منبع`}
            icon={Rss}
            colorScheme="green"
          />
          <DataCollectionKPI
            title="پست‌های امروز"
            value={postsToday}
            subtitle={`${hourlyRate} پست در ساعت`}
            icon={TrendingUp}
            colorScheme="purple"
            onClick={() => {
              const today = format(new Date(), 'yyyy-MM-dd');
              navigate(`/posts?date=${today}`);
            }}
          />
          <DataCollectionKPI
            title="منابع پرخطر"
            value={highThreatSourcesCount}
            subtitle={`ضریب تهدید بالا`}
            icon={AlertTriangle}
            colorScheme="red"
            onClick={() => navigate('/source-intelligence')}
          />
          <DataCollectionKPI
            title="سلامت جمع‌آوری"
            value={`${collectionHealth}%`}
            subtitle={`انتظار: ~${expectedDailyVolume} پست/روز`}
            icon={Activity}
            colorScheme="health"
            healthStatus={healthStatus}
          />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Flame className="w-5 h-5 text-red-600" />
                Top 10 کانال پرخطر
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                بر اساس امتیاز تهدید
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topRiskyChannelsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="channel_name"
                    type="category"
                    width={120}
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip />
                  <Bar dataKey="threat_score" fill="#ef4444" radius={[0, 4, 4, 0]}>
                    {topRiskyChannelsData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.threat_score >= 100 ? '#dc2626' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <CollectionTimelineChart
            data={collectionTimelineData}
            onClick={() => navigate('/posts')}
          />

          <SocialMediaPieChart data={socialMediaData} />
        </div>
      </div>

      {/* Divider */}
      <Separator className="my-6" />

      {/* PsyOp Detection Section */}
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          🎯 تشخیص عملیات روانی
        </h2>

        {/* KPI Cards - PsyOp Focused */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="حملات جنگ روانی امروز"
          value={activePsyOpsToday}
          subtitle="نسبت به دیروز"
          icon={Shield}
          gradient="red"
          change={psyOpChangePercentage}
          isAlert
          onClick={() => navigate('/posts?filter=psyop')}
        />
        <KPICard
          title="تهدیدهای بحرانی"
          value={criticalThreats}
          subtitle="نیازمند واکنش فوری"
          icon={AlertTriangle}
          gradient="orange"
          pulse={criticalThreats > 0}
          onClick={() => navigate('/ai-analysis?threat=critical')}
        />
        <KPICard
          title="کمپین‌های فعال"
          value={activeCampaigns}
          subtitle="در حال رصد"
          icon={Siren}
          gradient="yellow"
          onClick={() => navigate('/coming-soon')}
        />
        <KPICard
          title="پست‌های تحلیل شده"
          value={analysisBreakdown.total}
          subtitle="روش دومرحله‌ای فعال است ✅"
          icon={Brain}
          gradient="purple"
          onClick={() => navigate('/posts')}
          tooltip={
            <div className="text-xs space-y-2">
              <div className="font-bold mb-2">تفکیک تحلیل:</div>
              <div className="flex items-center justify-between gap-4">
                <span>تحلیل سریع:</span>
                <span className="font-bold text-green-400">{analysisBreakdown.quick} ({analysisBreakdown.quickPercentage}%)</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>تحلیل عمیق:</span>
                <span className="font-bold text-red-400">{analysisBreakdown.deep} ({analysisBreakdown.deepPercentage}%)</span>
              </div>
              <div className="pt-2 border-t border-gray-600 text-gray-300">
                روش دومرحله‌ای 70% سریع‌تر است
              </div>
            </div>
          }
        />
        </div>
        <div className="mt-4">
          <ModelCalibrationCard />
        </div>
      </div>

      {/* Charts Row 1 - Threat Timeline and Targeted Entities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreatLevelTimeline data={threatTimelineData} />
        <TargetedEntitiesChart data={targetedEntitiesData} />
      </div>
      
      {/* Charts Row 2 - Attack Vectors and Campaign Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttackVectorChart 
          data={attackVectorData}
          onVectorClick={(vector) => navigate(`/posts?vector=${vector}`)}
        />
        <CampaignHeatmap 
          data={heatmapData}
          onDayClick={handleDayClick}
        />
      </div>
      
      {/* Charts Row 3 - Top Targeted Persons and Organizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopTargetedPersonsChart 
          data={topTargetedPersonsData}
          onPersonClick={(person) => navigate(`/target-analysis?person=${encodeURIComponent(person)}`)}
        />
        <TopTargetedOrganizationsChart 
          data={topTargetedOrganizationsData}
          onOrgClick={(org) => navigate(`/target-analysis?org=${encodeURIComponent(org)}`)}
        />
      </div>
      
      {/* PsyOp Detections Table */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">آخرین تشخیص‌های جنگ روانی</h2>
            {isLoadingPsyop && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>
          <button
            className="text-sm text-primary hover:underline"
            onClick={() => navigate('/ai-analysis')}
          >
            مشاهده همه
          </button>
        </div>
        <PostsTable
          posts={psyopPosts}
          onViewPost={handleViewPost}
          currentPage={psyopPage}
          totalPages={totalPostsPages}
          onPageChange={setPsyopPage}
        />
      </div>
      
      {/* Detail Modal */}
      <PostDetailModal
        post={selectedPost}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
