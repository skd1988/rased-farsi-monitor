import React, { useState, useMemo } from 'react';
import { Newspaper, FileText, AlertTriangle, Globe } from 'lucide-react';
import KPICard from '@/components/dashboard/KPICard';
import PostsLineChart from '@/components/dashboard/PostsLineChart';
import LanguagePieChart from '@/components/dashboard/LanguagePieChart';
import SourcesBarChart from '@/components/dashboard/SourcesBarChart';
import PostsTable from '@/components/dashboard/PostsTable';
import PostDetailModal from '@/components/dashboard/PostDetailModal';
import { mockPosts, EnrichedPost } from '@/lib/mockData';

const Dashboard = () => {
  const [selectedPost, setSelectedPost] = useState<EnrichedPost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Calculate KPIs
  const todayPosts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return mockPosts.filter(post => {
      const postDate = new Date(post.date);
      postDate.setHours(0, 0, 0, 0);
      return postDate.getTime() === today.getTime();
    }).length;
  }, []);
  
  const totalPosts = mockPosts.length;
  const activeAlerts = 0; // Placeholder for future implementation
  const uniqueSources = useMemo(() => {
    return new Set(mockPosts.map(post => post.source)).size;
  }, []);
  
  // Calculate yesterday's posts for percentage change
  const yesterdayPosts = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return mockPosts.filter(post => {
      const postDate = new Date(post.date);
      postDate.setHours(0, 0, 0, 0);
      return postDate.getTime() === yesterday.getTime();
    }).length;
  }, []);
  
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
      
      const count = mockPosts.filter(post => {
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
  }, []);
  
  // Prepare pie chart data (language distribution)
  const pieChartData = useMemo(() => {
    const languageCounts: Record<string, number> = {};
    mockPosts.forEach(post => {
      languageCounts[post.language] = (languageCounts[post.language] || 0) + 1;
    });
    
    return Object.entries(languageCounts).map(([name, value]) => ({
      name,
      value,
      percentage: (value / totalPosts) * 100,
    }));
  }, [totalPosts]);
  
  // Prepare bar chart data (top 10 sources)
  const barChartData = useMemo(() => {
    const sourceCounts: Record<string, number> = {};
    mockPosts.forEach(post => {
      sourceCounts[post.source] = (sourceCounts[post.source] || 0) + 1;
    });
    
    return Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, []);
  
  const handleViewPost = (post: EnrichedPost) => {
    setSelectedPost(post);
    setIsModalOpen(true);
  };
  
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
      <PostsTable posts={mockPosts.slice(0, 20)} onViewPost={handleViewPost} />
      
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
