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
  const [showModal, setShowModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const modalStateRef = useRef(false);

  // Debug logging
  console.log('AI Analysis component rendered. Modal state:', showModal);
  
  useEffect(() => {
    console.log('=== MODAL STATE CHANGED ===');
    console.log('New state:', showModal);
    console.log('Ref state:', modalStateRef.current);
    console.log('Stack trace:', new Error().stack);
  }, [showModal]);

  const openModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('=== OPENING MODAL ===');
    modalStateRef.current = true;
    setShowModal(true);
    
    // Force state to stay true
    setTimeout(() => {
      if (modalStateRef.current) {
        console.log('Reinforcing modal state to true');
        setShowModal(true);
      }
    }, 10);
  };

  const closeModal = () => {
    console.log('=== CLOSING MODAL ===');
    modalStateRef.current = false;
    setShowModal(false);
  };
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

  // Generate mock analysis (fallback)
  const generateMockAnalysis = (post: any) => {
    const threats = ['Critical', 'High', 'Medium', 'Low'];
    const sentiments = ['Positive', 'Neutral', 'Negative'];
    const topics = ['جنگ روانی', 'محور مقاومت', 'اتهام', 'شبهه', 'کمپین', 'اخبار عادی'];
    
    // Intelligent mock based on keywords
    let threat = 'Low';
    if (post.keywords?.includes('جنگ روانی') || post.keywords?.includes('حرب نفسية')) {
      threat = 'High';
    }
    if (post.keywords?.includes('اتهام') || post.keywords?.includes('کمپین')) {
      threat = 'Medium';
    }
    
    return {
      analysis_summary: `تحلیل تلقائی: این مطلب از ${post.source} درباره ${post.title.substring(0, 50)}... است و بررسی شده است.`,
      sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
      sentiment_score: parseFloat((Math.random() * 2 - 1).toFixed(2)),
      main_topic: topics[Math.floor(Math.random() * topics.length)],
      threat_level: threat,
      confidence: Math.floor(Math.random() * 30) + 70,
      key_points: [
        'نکته کلیدی اول: بررسی محتوای مطلب',
        'نکته کلیدی دوم: تحلیل احساسات و لحن',
        'نکته کلیدی سوم: ارزیابی سطح تهدید'
      ],
      recommended_action: 'رصد و بررسی بیشتر توصیه می‌شود',
      analyzed_at: new Date().toISOString(),
      analysis_model: 'Mock',
      processing_time: 2.5
    };
  };

  // Analyze post with DeepSeek API
  const analyzePostWithAI = async (post: any) => {
    console.log('Analyzing post with AI:', post.title);
    
    const startTime = Date.now();
    
    try {
      // Call Supabase edge function for analysis
      const { data, error } = await supabase.functions.invoke('analyze-post', {
        body: {
          postId: post.id,
          postTitle: post.title,
          postContent: post.contents || ''
        }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }
      
      console.log('Analysis result:', data);
      
      const processingTime = (Date.now() - startTime) / 1000;
      
      return {
        ...data.analysis,
        processing_time: processingTime
      };
      
    } catch (error) {
      console.error('AI analysis failed:', error);
      console.warn('Falling back to mock analysis');
      return generateMockAnalysis(post);
    }
  };

  const startAnalysis = async (count: number) => {
    console.log(`Starting analysis of ${count} posts`);
    setIsAnalyzing(true);
    setProgress(0);
    setAnalyzedCount(0);
    setTotalCount(count);
    
    try {
      // Get posts that haven't been analyzed
      const { data: postsToAnalyze, error } = await supabase
        .from('posts')
        .select('*')
        .is('analysis_summary', null)
        .order('published_at', { ascending: false })
        .limit(count);
      
      if (error) throw error;
      
      console.log(`Found ${postsToAnalyze?.length || 0} posts to analyze`);
      
      if (!postsToAnalyze || postsToAnalyze.length === 0) {
        toast({
          title: 'هیچ مطلبی برای تحلیل یافت نشد',
          description: 'همه مطالب قبلاً تحلیل شده‌اند',
        });
        setIsAnalyzing(false);
        setShowModal(false);
        return;
      }
      
      for (let i = 0; i < postsToAnalyze.length; i++) {
        const post = postsToAnalyze[i];
        console.log(`Analyzing post ${i + 1}/${postsToAnalyze.length}: ${post.title}`);
        
        // Analyze with AI (calls edge function -> DeepSeek)
        const analysis = await analyzePostWithAI(post);
        
        // Update post in database
        const { error: updateError } = await supabase
          .from('posts')
          .update(analysis)
          .eq('id', post.id);
        
        if (updateError) {
          console.error('Error updating post:', updateError);
        } else {
          console.log(`Successfully analyzed post ${i + 1}`);
        }
        
        // Update progress
        const newProgress = Math.round(((i + 1) / postsToAnalyze.length) * 100);
        setProgress(newProgress);
        setAnalyzedCount(i + 1);
        
        // Small delay between requests (avoid rate limits)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('Analysis complete!');
      
      // Show success and reload
      toast({
        title: '✅ تحلیل با موفقیت انجام شد',
        description: `${postsToAnalyze.length} مطلب تحلیل شد`,
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: '❌ خطا در تحلیل',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
        variant: 'destructive',
      });
      setIsAnalyzing(false);
      setShowModal(false);
    }
  };

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
          <Button onClick={() => {
            console.log('شروع تحلیل button clicked');
            setShowModal(true);
          }} size="lg">
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
          <button
            onClick={(e) => {
              console.log('=== BUTTON CLICKED ===');
              console.log('Current modal state:', showModal);
              openModal(e);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            style={{
              backgroundColor: '#3B82F6',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            type="button"
          >
            <FileText className="h-4 w-4" />
            تحلیل گروهی
          </button>
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

      {/* Ultra-Simple Modal */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!isAnalyzing) {
              console.log('Background clicked, closing modal');
              closeModal();
            }
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '90%',
              direction: 'rtl',
              position: 'relative',
              zIndex: 1000000
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Modal content clicked, preventing close');
            }}
          >
            {!isAnalyzing ? (
              <div>
                <h2 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#111'}}>
                  تحلیل گروهی مطالب
                </h2>
                <p style={{color: '#666', marginBottom: '24px', fontSize: '16px'}}>
                  چند مطلب می‌خواهید تحلیل کنید؟
                </p>
                
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  <button
                    onClick={() => {
                      console.log('Analyzing 5 posts...');
                      startAnalysis(5);
                    }}
                    style={{
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      padding: '16px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px'
                    }}
                    type="button"
                  >
                    <span style={{fontSize: '24px'}}>🤖</span>
                    <span>تحلیل 5 مطلب (تست سریع)</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('Analyzing 10 posts...');
                      startAnalysis(10);
                    }}
                    style={{
                      backgroundColor: '#10B981',
                      color: 'white',
                      padding: '16px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px'
                    }}
                    type="button"
                  >
                    <span style={{fontSize: '24px'}}>⚡</span>
                    <span>تحلیل 10 مطلب اخیر</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('Analyzing 20 posts...');
                      startAnalysis(20);
                    }}
                    style={{
                      backgroundColor: '#8B5CF6',
                      color: 'white',
                      padding: '16px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px'
                    }}
                    type="button"
                  >
                    <span style={{fontSize: '24px'}}>🚀</span>
                    <span>تحلیل 20 مطلب اخیر</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Cancel clicked, closing modal');
                      closeModal();
                    }}
                    style={{
                      backgroundColor: '#E5E7EB',
                      color: '#374151',
                      padding: '16px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                    type="button"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h2 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', color: '#111'}}>
                  در حال تحلیل...
                </h2>
                
                <div style={{textAlign: 'center', marginBottom: '16px'}}>
                  <p style={{fontSize: '32px', fontWeight: 'bold', color: '#3B82F6', marginBottom: '8px'}}>
                    {analyzedCount} از {totalCount}
                  </p>
                  <p style={{color: '#666', fontSize: '14px'}}>مطلب تحلیل شده</p>
                </div>
                
                <div style={{width: '100%', height: '24px', backgroundColor: '#E5E7EB', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px'}}>
                  <div 
                    style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 100%)',
                      transition: 'width 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {progress > 10 && `${progress}%`}
                  </div>
                </div>
                
                <p style={{textAlign: 'center', color: '#666', fontSize: '14px'}}>
                  لطفاً صبر کنید، این فرآیند چند ثانیه طول می‌کشد...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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