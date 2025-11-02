import React, { useState, useMemo, useEffect } from 'react';
import { Shield, AlertTriangle, Siren, Clock, Database, Rss, TrendingUp, Activity } from 'lucide-react';
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
import { EnrichedPost } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { startOfDay, subDays, eachDayOfInterval, format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedPost, setSelectedPost] = useState<EnrichedPost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch real data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch posts with PsyOp data
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .order('published_at', { ascending: false });
        
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
        
        setPosts(postsData || []);
        setAiAnalysis(analysisData || []);
        setCampaigns(campaignsData || []);
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

  const oldestPendingTime = useMemo(() => {
    const pending = posts.filter(post => 
      (post.threat_level === 'High' || post.threat_level === 'Critical') &&
      post.counter_narrative_ready === false
    );
    
    if (pending.length === 0) return null;
    
    const oldest = pending.reduce((oldest, current) => {
      return new Date(current.published_at) < new Date(oldest.published_at) ? current : oldest;
    });
    
    return formatDistanceToNow(new Date(oldest.published_at), { 
      locale: faIR, 
      addSuffix: false 
    });
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
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [posts]);

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

  // PsyOp Posts for table (only posts with is_psyop = true)
  const psyopPosts = useMemo(() => {
    return posts
      .filter(post => post.is_psyop === true)
      .map(post => ({
        id: post.id,
        title: post.title,
        contents: post.contents || '',
        date: post.published_at,
        source: post.source,
        sourceURL: post.source_url || undefined,
        author: post.author || 'نامشخص',
        language: post.language,
        status: post.status,
        articleURL: post.article_url || '',
        keywords: post.keywords || [],
        source_country: post.source_country || null,
      } as EnrichedPost))
      .sort((a, b) => {
        // Sort by threat level first
        const threatOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
        const postA = posts.find(p => p.id === a.id);
        const postB = posts.find(p => p.id === b.id);
        const threatA = threatOrder[postA?.threat_level as keyof typeof threatOrder] ?? 999;
        const threatB = threatOrder[postB?.threat_level as keyof typeof threatOrder] ?? 999;
        
        if (threatA !== threatB) return threatA - threatB;
        
        // Then by date
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 15);
  }, [posts]);
  
  const handleViewPost = (post: EnrichedPost) => {
    setSelectedPost(post);
    setIsModalOpen(true);
  };

  const handleDayClick = (date: string) => {
    // Navigate to Posts Explorer with date filter
    navigate(`/posts-explorer?date=${date}`);
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
      .map(([name, value]) => ({ name, value }))
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            title="سلامت جمع‌آوری"
            value={`${collectionHealth}%`}
            subtitle={`انتظار: ~${expectedDailyVolume} پست/روز`}
            icon={Activity}
            colorScheme="health"
            healthStatus={healthStatus}
          />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <SourceTypeChart
            data={sourceTypeData}
            totalSources={totalSources}
            onSegmentClick={(type) => navigate(`/posts?sourceType=${type}`)}
          />
          <CollectionTimelineChart
            data={collectionTimelineData}
            onClick={() => navigate('/posts')}
          />
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
          onClick={() => navigate('/posts-explorer?filter=psyop')}
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
          title="پاسخ‌های در انتظار"
          value={pendingResponses}
          subtitle="نیاز به روایت مقابل"
          icon={Clock}
          gradient={pendingResponses > 10 ? 'red' : pendingResponses > 5 ? 'orange' : 'green'}
          timer={oldestPendingTime || undefined}
          onClick={() => navigate('/coming-soon')}
        />
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
          onVectorClick={(vector) => navigate(`/posts-explorer?vector=${vector}`)}
        />
        <CampaignHeatmap 
          data={heatmapData}
          onDayClick={handleDayClick}
        />
      </div>
      
      {/* PsyOp Detections Table */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">آخرین تشخیص‌های جنگ روانی</h2>
          <button 
            className="text-sm text-primary hover:underline"
            onClick={() => navigate('/ai-analysis')}
          >
            مشاهده همه
          </button>
        </div>
        <PostsTable posts={psyopPosts} onViewPost={handleViewPost} />
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
