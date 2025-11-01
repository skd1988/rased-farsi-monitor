import React, { useState, useMemo, useEffect } from 'react';
import { Newspaper, FileText, AlertTriangle, Globe } from 'lucide-react';
import KPICard from '@/components/dashboard/KPICard';
import PostsLineChart from '@/components/dashboard/PostsLineChart';
import LanguagePieChart from '@/components/dashboard/LanguagePieChart';
import SourceTypePieChart from '@/components/dashboard/SourceTypePieChart';
import SocialMediaPieChart from '@/components/dashboard/SocialMediaPieChart';
import SourcesBarChart from '@/components/dashboard/SourcesBarChart';
import CountryPieChart from '@/components/dashboard/CountryPieChart';
import PostsTable from '@/components/dashboard/PostsTable';
import PostDetailModal from '@/components/dashboard/PostDetailModal';
import { EnrichedPost } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { detectCountryFromSource } from '@/utils/countryDetector';

const Dashboard = () => {
  const [selectedPost, setSelectedPost] = useState<EnrichedPost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch real data from Supabase
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        let allPosts: any[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        // Fetch all posts in batches of 1000 to bypass Supabase's default limit
        while (hasMore) {
          const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('published_at', { ascending: false })
            .range(from, from + batchSize - 1);
          
          if (error) throw error;
          
          if (data && data.length > 0) {
            allPosts = [...allPosts, ...data];
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        
        // Map Supabase data to EnrichedPost format
        const mappedPosts: EnrichedPost[] = allPosts.map(post => ({
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
  
  // Helper functions for source classification
  const classifySource = (source: string): 'social' | 'website' | 'unknown' => {
    if (!source) return 'unknown';
    
    const sourceLower = source.toLowerCase();
    
    // Check for social media domains
    const socialDomains = [
      't.me', 'telegram.me', 'telegram.org',
      'twitter.com', 'x.com',
      'facebook.com', 'fb.com', 'fb.watch',
      'instagram.com', 'instagr.am',
      'youtube.com', 'youtu.be',
      'tiktok.com',
      'linkedin.com',
      'snapchat.com',
      'whatsapp.com', 'wa.me',
      'reddit.com',
      'pinterest.com',
      'discord.gg', 'discord.com'
    ];
    
    // Check for social media keywords
    const socialKeywords = [
      'twitter', 'توییتر', 'تويتر',
      'facebook', 'فيسبوك', 'فیسبوک',
      'instagram', 'إنستغرام', 'اینستاگرام',
      'youtube', 'يوتيوب', 'یوتیوب',
      'tiktok', 'تيك توك', 'تیک‌تاک',
      'telegram', 'تلغرام', 'تلگرام',
      'linkedin', 'لينكد إن',
      'snapchat', 'سناب شات',
      'whatsapp', 'واتساب',
      'reddit', 'ردیت',
      'pinterest', 'پینترست',
      'discord', 'دیسکورد'
    ];
    
    const isSocialDomain = socialDomains.some(domain => sourceLower.includes(domain));
    const isSocialKeyword = socialKeywords.some(keyword => sourceLower.includes(keyword));
    
    return (isSocialDomain || isSocialKeyword) ? 'social' : 'website';
  };

  const getSocialPlatform = (source: string): string => {
    if (!source) return 'سایر';
    const sourceLower = source.toLowerCase();
    
    // Check for Telegram
    if (sourceLower.includes('t.me') || sourceLower.includes('telegram.me') || 
        sourceLower.includes('telegram.org') || sourceLower.includes('telegram') || 
        sourceLower.includes('تلغرام') || sourceLower.includes('تلگرام')) {
      return 'تلگرام';
    }
    
    // Check for Twitter/X
    if (sourceLower.includes('twitter.com') || sourceLower.includes('x.com') ||
        sourceLower.includes('twitter') || sourceLower.includes('توییتر') || 
        sourceLower.includes('تويتر')) {
      return 'توییتر';
    }
    
    // Check for Facebook
    if (sourceLower.includes('facebook.com') || sourceLower.includes('fb.com') || 
        sourceLower.includes('fb.watch') || sourceLower.includes('facebook') || 
        sourceLower.includes('فيسبوك') || sourceLower.includes('فیسبوک')) {
      return 'فیسبوک';
    }
    
    // Check for Instagram
    if (sourceLower.includes('instagram.com') || sourceLower.includes('instagr.am') ||
        sourceLower.includes('instagram') || sourceLower.includes('إنستغرام') || 
        sourceLower.includes('اینستاگرام')) {
      return 'اینستاگرام';
    }
    
    // Check for YouTube
    if (sourceLower.includes('youtube.com') || sourceLower.includes('youtu.be') ||
        sourceLower.includes('youtube') || sourceLower.includes('يوتيوب') || 
        sourceLower.includes('یوتیوب')) {
      return 'یوتیوب';
    }
    
    // Check for TikTok
    if (sourceLower.includes('tiktok.com') || sourceLower.includes('tiktok') || 
        sourceLower.includes('تيك توك') || sourceLower.includes('تیک')) {
      return 'تیک‌تاک';
    }
    
    // Check for LinkedIn
    if (sourceLower.includes('linkedin.com') || sourceLower.includes('linkedin') || 
        sourceLower.includes('لينكد')) {
      return 'لینکدین';
    }
    
    // Check for WhatsApp
    if (sourceLower.includes('whatsapp.com') || sourceLower.includes('wa.me') ||
        sourceLower.includes('whatsapp') || sourceLower.includes('واتساب')) {
      return 'واتساپ';
    }
    
    // Check for Reddit
    if (sourceLower.includes('reddit.com') || sourceLower.includes('reddit') || 
        sourceLower.includes('ردیت')) {
      return 'ردیت';
    }
    
    return 'سایر';
  };

  // Prepare source type pie chart data
  const sourceTypeData = useMemo(() => {
    const sourceTypes = posts.reduce((acc, post) => {
      const type = classifySource(post.source);
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: 'وب‌سایت‌ها', value: sourceTypes.website || 0, fill: '#3B82F6' },
      { name: 'شبکه‌های اجتماعی', value: sourceTypes.social || 0, fill: '#10B981' }
    ];
  }, [posts]);

  // Prepare social media breakdown pie chart data
  const socialMediaData = useMemo(() => {
    const socialOnly = posts.filter(p => classifySource(p.source) === 'social');
    const platforms = socialOnly.reduce((acc, post) => {
      const platform = getSocialPlatform(post.source);
      if (platform) {
        acc[platform] = (acc[platform] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const platformColors: Record<string, string> = {
      'توییتر': '#1DA1F2',
      'فیسبوک': '#4267B2',
      'اینستاگرام': '#E1306C',
      'یوتیوب': '#FF0000',
      'تیک‌تاک': '#000000',
      'تلگرام': '#0088cc',
      'لینکدین': '#0077b5',
      'واتساپ': '#25D366',
      'ردیت': '#FF4500',
      'سایر': '#6B7280'
    };

    return Object.entries(platforms).map(([name, value]) => ({
      name,
      value,
      fill: platformColors[name] || '#6B7280'
    }));
  }, [posts]);

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

  // Prepare country distribution data
  const countryData = useMemo(() => {
    const countryCounts: Record<string, number> = {};
    const totalPosts = posts.length;

    posts.forEach(post => {
      const country = post.source_country || 'نامشخص';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    const colorMap: Record<string, string> = {
      'ایران': '#239B56',
      'قطر': '#8E44AD',
      'عربستان سعودی': '#E67E22',
      'امارات': '#3498DB',
      'مصر': '#E74C3C',
      'عراق': '#F39C12',
      'لبنان': '#1ABC9C',
      'آمریکا': '#34495E',
      'بریتانیا': '#2980B9',
      'فرانسه': '#9B59B6',
      'آلمان': '#16A085',
      'ترکیه': '#C0392B',
      'روسیه': '#7F8C8D',
      'نامشخص': '#BDC3C7'
    };

    return Object.entries(countryCounts)
      .map(([country, count]) => ({
        country,
        count,
        percentage: totalPosts > 0 ? (count / totalPosts) * 100 : 0,
        fill: colorMap[country] || '#95A5A6'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 countries
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
    <div className="p-6 space-y-6" dir="rtl">
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
      
      {/* Charts Row 2 - New Source Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SourceTypePieChart data={sourceTypeData} />
        <SocialMediaPieChart data={socialMediaData} />
      </div>
      
      {/* Charts Row 3 - Sources & Country Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SourcesBarChart data={barChartData} />
        <CountryPieChart data={countryData} loading={loading} />
      </div>
      
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
