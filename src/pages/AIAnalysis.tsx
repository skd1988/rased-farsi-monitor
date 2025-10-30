import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download } from 'lucide-react';
import StatsCard from '@/components/analysis/StatsCard';
import AnalysisCard from '@/components/analysis/AnalysisCard';
import AnalysisDetailModal from '@/components/analysis/AnalysisDetailModal';
import BulkAnalysisModal from '@/components/analysis/BulkAnalysisModal';

interface AnalyzedPost {
  id: string;
  title: string;
  contents: string;
  source: string;
  author: string;
  published_at: string;
  analysis_summary: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
  main_topic: string | null;
  threat_level: string | null;
  confidence: number | null;
  key_points: string[] | null;
  recommended_action: string | null;
  analyzed_at: string | null;
  processing_time: number | null;
  article_url: string | null;
  keywords: string[] | null;
  language: string;
  status: string;
  created_at: string;
  updated_at: string;
  analysis_model: string | null;
}

const AIAnalysis = () => {
  const [posts, setPosts] = useState<AnalyzedPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<AnalyzedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [threatFilter, setThreatFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('threat');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<AnalyzedPost | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyzedPosts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [posts, searchQuery, threatFilter, sentimentFilter, topicFilter, sortBy]);

  const fetchAnalyzedPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .not('analyzed_at', 'is', null)
        .order('analyzed_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching analyzed posts:', error);
      toast({
        title: 'خطا در بارگذاری تحلیل‌ها',
        description: 'لطفا دوباره تلاش کنید',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...posts];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.analysis_summary?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Threat level filter
    if (threatFilter !== 'all') {
      filtered = filtered.filter(post => post.threat_level === threatFilter);
    }

    // Sentiment filter
    if (sentimentFilter !== 'all') {
      filtered = filtered.filter(post => post.sentiment === sentimentFilter);
    }

    // Topic filter
    if (topicFilter !== 'all') {
      filtered = filtered.filter(post => post.main_topic === topicFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'threat') {
        const threatOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return threatOrder[a.threat_level] - threatOrder[b.threat_level];
      } else if (sortBy === 'newest') {
        return new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime();
      }
      return 0;
    });

    setFilteredPosts(filtered);
  };

  const stats = {
    analyzed: posts.length,
    critical: posts.filter(p => p.threat_level === 'Critical').length,
    high: posts.filter(p => p.threat_level === 'High').length,
    negative: posts.filter(p => p.sentiment === 'Negative').length,
  };

  const allTopics = Array.from(new Set(posts.map(p => p.main_topic).filter(Boolean)));

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <div className="text-6xl">🤖</div>
          <h3 className="text-2xl font-bold">هنوز هیچ مطلبی تحلیل نشده</h3>
          <p className="text-muted-foreground">برای شروع، از دکمه زیر استفاده کنید</p>
          <Button onClick={() => setShowBulkModal(true)} size="lg">
            <FileText className="ml-2 h-5 w-5" />
            شروع تحلیل
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">تحلیل هوشمند</h1>
          <p className="text-muted-foreground mt-2">تحلیل محتوا با هوش مصنوعی و شناسایی تهدیدها</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowBulkModal(true)}>
            <FileText className="ml-2 h-4 w-4" />
            تحلیل گروهی
          </Button>
          <Button variant="outline">
            <Download className="ml-2 h-4 w-4" />
            خروجی گزارش PDF
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="تحلیل شده"
          value={stats.analyzed}
          icon="🤖"
          color="blue"
        />
        <StatsCard
          title="تهدید بحرانی"
          value={stats.critical}
          icon="🔴"
          color="red"
          pulse={stats.critical > 0}
        />
        <StatsCard
          title="نیازمند بررسی"
          value={stats.high}
          icon="⚠️"
          color="orange"
        />
        <StatsCard
          title="احساسات منفی"
          value={stats.negative}
          icon="😟"
          color="yellow"
        />
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Input
            placeholder="جستجو در نتایج..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="md:col-span-2"
          />
          
          <Select value={threatFilter} onValueChange={setThreatFilter}>
            <SelectTrigger>
              <SelectValue placeholder="سطح تهدید" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="Critical">بحرانی</SelectItem>
              <SelectItem value="High">بالا</SelectItem>
              <SelectItem value="Medium">متوسط</SelectItem>
              <SelectItem value="Low">پایین</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="احساسات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="Positive">مثبت</SelectItem>
              <SelectItem value="Neutral">خنثی</SelectItem>
              <SelectItem value="Negative">منفی</SelectItem>
            </SelectContent>
          </Select>

          <Select value={topicFilter} onValueChange={setTopicFilter}>
            <SelectTrigger>
              <SelectValue placeholder="موضوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              {allTopics.map(topic => (
                <SelectItem key={topic} value={topic}>{topic}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="مرتب‌سازی" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="threat">تهدید بحرانی → پایین</SelectItem>
              <SelectItem value="newest">جدیدترین</SelectItem>
              <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Analysis Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPosts.map(post => (
          <AnalysisCard
            key={post.id}
            post={post}
            onViewDetails={() => setSelectedPost(post)}
            onReanalyze={() => {
              // Re-analyze logic will be handled in AnalysisCard
            }}
          />
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          هیچ نتیجه‌ای با این فیلترها یافت نشد
        </div>
      )}

      <BulkAnalysisModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onComplete={fetchAnalyzedPosts}
      />

      {selectedPost && (
        <AnalysisDetailModal
          post={selectedPost}
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  );
};

export default AIAnalysis;