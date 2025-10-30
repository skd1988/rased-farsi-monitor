import React, { useState, useMemo, useEffect } from 'react';
import { Newspaper, FileText, AlertTriangle, Globe } from 'lucide-react';
import KPICard from '@/components/dashboard/KPICard';
import PostsLineChart from '@/components/dashboard/PostsLineChart';
import LanguagePieChart from '@/components/dashboard/LanguagePieChart';
import SourcesBarChart from '@/components/dashboard/SourcesBarChart';
import PostsTable from '@/components/dashboard/PostsTable';
import PostDetailModal from '@/components/dashboard/PostDetailModal';
import { EnrichedPost } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const Dashboard = () => {
  const [selectedPost, setSelectedPost] = useState<EnrichedPost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch real data from Supabase
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .order('published_at', { ascending: false });
        
        if (error) throw error;
        
        // Map Supabase data to EnrichedPost format
        const mappedPosts: EnrichedPost[] = (data || []).map(post => ({
          id: post.id,
          title: post.title,
          content: post.contents || '',
          contents: post.contents || '',
          date: post.published_at,
          source: post.source,
          sourceURL: post.source_url,
          author: post.author || 'نامشخص',
          language: post.language,
          status: post.status,
          articleURL: post.article_url,
          keywords: post.keywords || [],
          sentiment: post.sentiment,
          threat_level: post.threat_level,
          analysis_summary: post.analysis_summary,
        }));
        
        setPosts(mappedPosts);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPosts();
  }, []);
  
  // Calculate KPIs
  const todayPosts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return posts.filter(post => {
      const postDate = new Date(post.date);
      postDate.setHours(0, 0, 0, 0);
      return postDate.getTime() === today.getTime();
    }).length;
  }, [posts]);
  
  const totalPosts = posts.length;
  const activeAlerts = 0; // Placeholder for future implementation
  const uniqueSources = useMemo(() => {
    return new Set(posts.map(post => post.source)).size;
  }, [posts]);
  
  // Calculate yesterday's posts for percentage change
  const yesterdayPosts = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return posts.filter(post => {
      const postDate = new Date(post.date);
      postDate.setHours(0, 0, 0, 0);
      return postDate.getTime() === yesterday.getTime();
    }).length;
  }, [posts]);
  
  const changePercentage = yesterdayPosts > 0 
    ? Math.round(((todayPosts - yesterdayPosts) / yesterdayPosts) * 100)
    : 0;
  
  // Prepare line chart data (last 30 days)
  const lineChartData = useMemo(() => {
    const days = 30;
    const data = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const count = posts.filter(post => {
        const postDate = new Date(post.date);
        postDate.setHours(0, 0, 0, 0);
        return postDate.getTime() === date.getTime();
      }).length;
      
      data.push({
        date: date.toISOString(),
        count,
      });
    }
    
    return data;
  }, [posts]);
  
  // Prepare pie chart data (language distribution)
  const pieChartData = useMemo(() => {
    const languageCounts: Record<string, number> = {};
    posts.forEach(post => {
      languageCounts[post.language] = (languageCounts[post.language] || 0) + 1;
    });
    
    return Object.entries(languageCounts).map(([name, value]) => ({
      name,
      value,
      percentage: (value / totalPosts) * 100,
    }));
  }, [posts, totalPosts]);
  
  // Prepare bar chart data (top 10 sources)
  const barChartData = useMemo(() => {
    const sourceCounts: Record<string, { count: number; sourceURL?: string }> = {};
    posts.forEach(post => {
      if (!sourceCounts[post.source]) {
        sourceCounts[post.source] = { count: 0, sourceURL: post.sourceURL };
      }
      sourceCounts[post.source].count += 1;
    });
    
    return Object.entries(sourceCounts)
      .map(([source, data]) => ({ source, count: data.count, sourceURL: data.sourceURL }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [posts]);
  
  const handleViewPost = (post: EnrichedPost) => {
    setSelectedPost(post);
    setIsModalOpen(true);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="مطالب امروز"
          value={todayPosts}
          subtitle="نسبت به دیروز"
          icon={Newspaper}
          gradient="blue"
          change={changePercentage}
        />
        <KPICard
          title="مجموع مطالب"
          value={totalPosts}
          subtitle="از ابتدای رصد"
          icon={FileText}
          gradient="green"
        />
        <KPICard
          title="هشدارهای فعال"
          value={activeAlerts}
          subtitle="نیازمند بررسی"
          icon={AlertTriangle}
          gradient="orange"
          isAlert
        />
        <KPICard
          title="منابع فعال"
          value={uniqueSources}
          subtitle="منبع خبری"
          icon={Globe}
          gradient="purple"
        />
      </div>
      
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PostsLineChart data={lineChartData} />
        <LanguagePieChart data={pieChartData} />
      </div>
      
      {/* Charts Row 2 */}
      <SourcesBarChart data={barChartData} />
      
      {/* Posts Table */}
      <PostsTable posts={posts.slice(0, 20)} onViewPost={handleViewPost} />
      
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
