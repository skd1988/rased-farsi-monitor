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

  // Add logging to localStorage
  const addAnalysisLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, type };
    
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Store in localStorage
    const logs = JSON.parse(localStorage.getItem('analysis_logs') || '[]');
    logs.push(logEntry);
    // Keep only last 100 logs
    if (logs.length > 100) logs.shift();
    localStorage.setItem('analysis_logs', JSON.stringify(logs));
  };

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

  // Analyze a single post with AI (with timeout and retry using AbortController)
  const analyzePostWithAI = async (post: any, retryCount = 0): Promise<any | null> => {
    const maxRetries = 1;
    const timeoutMs = 30000;
    
    addAnalysisLog(`📝 شروع تحلیل پست: ${post.title}`, 'info');
    console.log('🔍 Starting AI analysis for post:', post.id);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        addAnalysisLog('⏱️❌ تحلیل به دلیل timeout متوقف شد (30 ثانیه)', 'error');
        console.error('❌ Analysis timeout after 30 seconds');
      }, timeoutMs);

      addAnalysisLog('🚀 فراخوانی edge function...', 'info');
      console.log('📞 Calling analyze-post edge function...');
      
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          postId: post.id,
          postTitle: post.title,
          postContent: post.contents || ''
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      addAnalysisLog(`✅ پاسخ از edge function دریافت شد (status: ${response.status})`, 'info');
      console.log('📦 Edge function response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        addAnalysisLog(`❌ خطای HTTP ${response.status}: ${errorText}`, 'error');
        
        if (response.status >= 500 && retryCount < maxRetries) {
          addAnalysisLog(`🔄 تلاش مجدد (${retryCount + 1}/${maxRetries})...`, 'info');
          await new Promise(r => setTimeout(r, 2000));
          return analyzePostWithAI(post, retryCount + 1);
        }
        
        toast({
          title: "خطای سرور",
          description: `کد خطا: ${response.status}`,
          variant: "destructive"
        });
        return null;
      }

      const data = await response.json();
      console.log('📦 Edge function data:', data);

      if (data?.error === 'MISSING_API_KEY') {
        addAnalysisLog('🔑 کلید API موجود نیست', 'error');
        toast({
          title: "خطا: کلید API موجود نیست",
          description: "لطفاً کلید DEEPSEEK_API_KEY را در تنظیمات تعریف کنید",
          variant: "destructive"
        });
        return null;
      }
      
      if (data?.error === 'RATE_LIMIT') {
        addAnalysisLog('⏸️ محدودیت تعداد درخواست', 'error');
        toast({
          title: "محدودیت تعداد درخواست",
          description: "لطفاً چند دقیقه صبر کنید و مجدداً تلاش کنید",
          variant: "destructive"
        });
        return null;
      }

      if (!data?.success || !data?.analysis) {
        addAnalysisLog('⚠️ پاسخ نامعتبر از edge function', 'error');
        console.error('⚠️ Invalid response format:', data);
        
        if (retryCount < maxRetries) {
          addAnalysisLog(`🔄 تلاش مجدد (${retryCount + 1}/${maxRetries})...`, 'info');
          await new Promise(r => setTimeout(r, 2000));
          return analyzePostWithAI(post, retryCount + 1);
        }
        
        toast({
          title: "خطا: پاسخ نامعتبر",
          description: "ساختار پاسخ از سرویس تحلیل صحیح نیست",
          variant: "destructive"
        });
        return null;
      }

      addAnalysisLog(
        `✅ تحلیل موفق - تهدید: ${data.analysis.threat_level} | احساس: ${data.analysis.sentiment}`,
        'success'
      );
      console.log('✅ Analysis successful:', data.analysis);
      
      return {
        analysis_summary: data.analysis.analysis_summary,
        sentiment: data.analysis.sentiment,
        sentiment_score: data.analysis.sentiment_score,
        main_topic: data.analysis.main_topic,
        threat_level: data.analysis.threat_level,
        confidence: data.analysis.confidence,
        key_points: data.analysis.key_points,
        recommended_action: data.analysis.recommended_action,
        analyzed_at: data.analysis.analyzed_at,
        analysis_model: data.analysis.analysis_model,
        processing_time: data.analysis.processing_time
      };
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addAnalysisLog('⏱️ Timeout - زمان انتظار تمام شد', 'error');
        console.error('❌ Request aborted due to timeout');
        
        if (retryCount < maxRetries) {
          addAnalysisLog(`🔄 تلاش مجدد پس از timeout (${retryCount + 1}/${maxRetries})...`, 'info');
          await new Promise(r => setTimeout(r, 2000));
          return analyzePostWithAI(post, retryCount + 1);
        }
        
        toast({
          title: "خطا: زمان انتظار تمام شد",
          description: "تحلیل بیش از 30 ثانیه طول کشید",
          variant: "destructive"
        });
        return null;
      }
      
      if (error.message.includes('fetch') || error.message.includes('network')) {
        addAnalysisLog(`🌐 خطای شبکه: ${error.message}`, 'error');
        
        if (retryCount < maxRetries) {
          addAnalysisLog(`🔄 تلاش مجدد (${retryCount + 1}/${maxRetries})...`, 'info');
          await new Promise(r => setTimeout(r, 2000));
          return analyzePostWithAI(post, retryCount + 1);
        }
        
        toast({
          title: "خطای شبکه",
          description: "لطفاً اتصال اینترنت خود را بررسی کنید",
          variant: "destructive"
        });
        return null;
      }
      
      addAnalysisLog(`❌ خطای غیرمنتظره: ${error.message}`, 'error');
      console.error('❌ Unexpected error:', error);
      
      toast({
        title: "خطای غیرمنتظره",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  };

  const startAnalysis = async (count: number) => {
    setIsAnalyzing(true);
    setProgress(0);
    setAnalyzedCount(0);
    setTotalCount(count);
    
    addAnalysisLog(`=== شروع تحلیل گروهی ${count} مطلب ===`, 'info');

    try {
      addAnalysisLog(`دریافت ${count} مطلب تحلیل نشده از دیتابیس...`, 'info');
      
      // Get posts that haven't been analyzed
      const { data: postsToAnalyze, error } = await supabase
        .from('posts')
        .select('*')
        .is('analysis_summary', null)
        .order('published_at', { ascending: false })
        .limit(count);

      if (error) {
        addAnalysisLog(`خطا در دریافت مطالب: ${error.message}`, 'error');
        throw error;
      }

      if (!postsToAnalyze || postsToAnalyze.length === 0) {
        addAnalysisLog('هیچ مطلب جدیدی برای تحلیل یافت نشد', 'info');
        toast({
          title: "اطلاعیه",
          description: "هیچ مطلب جدیدی برای تحلیل وجود ندارد",
        });
        setIsAnalyzing(false);
        setShowModal(false);
        return;
      }

      addAnalysisLog(`${postsToAnalyze.length} مطلب برای تحلیل یافت شد`, 'success');

      let successCount = 0;
      let failCount = 0;

      // Analyze each post
      for (let i = 0; i < postsToAnalyze.length; i++) {
        const post = postsToAnalyze[i];
        
        addAnalysisLog(`--- تحلیل مطلب ${i + 1}/${postsToAnalyze.length}: ${post.id} ---`, 'info');

        const analysis = await analyzePostWithAI(post);
        
        if (analysis) {
          addAnalysisLog('ذخیره نتایج در دیتابیس...', 'info');
          
          // Update post in database
          const { error: updateError } = await supabase
            .from('posts')
            .update(analysis)
            .eq('id', post.id);

          if (updateError) {
            addAnalysisLog(`خطا در ذخیره نتایج: ${updateError.message}`, 'error');
            failCount++;
          } else {
            addAnalysisLog(`نتایج با موفقیت ذخیره شد`, 'success');
            successCount++;
          }
        } else {
          addAnalysisLog('تحلیل ناموفق بود - ادامه به مطلب بعدی', 'error');
          failCount++;
        }

        // Update progress
        const newProgress = Math.round(((i + 1) / postsToAnalyze.length) * 100);
        setProgress(newProgress);
        setAnalyzedCount(i + 1);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const finalMessage = `تحلیل کامل شد! ${successCount} موفق، ${failCount} ناموفق`;
      addAnalysisLog(finalMessage, successCount > 0 ? 'success' : 'error');

      toast({
        title: "تحلیل کامل شد",
        description: `${successCount} مطلب با موفقیت تحلیل شد${failCount > 0 ? ` و ${failCount} مطلب ناموفق بود` : ''}`,
        variant: successCount > 0 ? "default" : "destructive",
      });

      // Refresh data
      addAnalysisLog('بارگذاری مجدد داده‌ها...', 'info');
      await fetchAnalyzedPosts();

      // Close modal after a delay
      setTimeout(() => {
        setShowModal(false);
        setIsAnalyzing(false);
      }, 2000);

    } catch (error: any) {
      addAnalysisLog(`Exception در تحلیل گروهی: ${error.message}`, 'error');
      toast({
        title: "خطا در فرآیند تحلیل",
        description: error instanceof Error ? error.message : "خطای ناشناخته",
        variant: "destructive",
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