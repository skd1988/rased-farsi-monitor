import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, Search, Grid3x3, List, Calendar as CalendarIcon, Shield, CheckCircle } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import PsyOpCard from '@/components/psyop/PsyOpCard';
import PsyOpAnalysisModal from '@/components/psyop/PsyOpAnalysisModal';
import { toast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { DataPagination } from '@/components/common/DataPagination';
import { PostCardSkeletonGrid } from '@/components/dashboard/PostCardSkeleton';
import { useNewAuth } from '@/contexts/NewAuthContext';

interface PsyOpPost {
  id: string;
  title: string;
  contents: string;
  source: string;
  author?: string | null;
  published_at: string;

  // Core PsyOp fields
  is_psyop: boolean;
  psyop_confidence?: number | null;
  psyop_risk_score?: number | null;
  threat_level?: "Critical" | "High" | "Medium" | "Low" | null;
  stance_type?: string | null;
  psyop_category?: string | null;
  psyop_techniques?: string[] | null;

  psyop_review_status?: string | null;
  psyop_notes?: string | null;

  // 3-level analysis stage
  analysis_stage?: "quick" | "deep" | "deepest" | null;
  quick_analyzed_at?: string | null;
  deep_analyzed_at?: string | null;
  deepest_analysis_completed_at?: string | null;

  // Deepest (crisis) analysis fields
  deepest_escalation_level?: string | null;
  deepest_strategic_summary?: string | null;
  deepest_key_risks?: string[] | null;
  deepest_audience_segments?: string[] | null;
  deepest_recommended_actions?: string[] | null;
  deepest_monitoring_indicators?: string[] | null;

  // Additional fields preserved from previous interface
  narrative_theme: string | null;
  psyop_technique: string[] | null;
  target_entity: string | null;
  analysis_summary: string | null;
  sentiment: string | null;
  keywords: string[] | null;
  urgency_level?: string | null;
  virality_potential?: number | null;
  psyop_reviewed_at?: string | null;
  psyop_review_notes?: string | null;
}

type BatchResult = {
  stage?: string;
  processed_posts?: number;
  summarize_calls?: number;
  quick_calls?: number;
  deep_calls?: number;
  deepest_calls?: number;
  errors?: number;
};

const PsyOpDetection = () => {
  console.log('🟡 [PsyOpDetection] FUNCTION CALLED');
  const { user } = useNewAuth();
  const [posts, setPosts] = useState<PsyOpPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 20;

  const [deepestLoadingId, setDeepestLoadingId] = useState<string | null>(null);
  
  // Filters
  const [isPsyOpFilter, setIsPsyOpFilter] = useState<string>('Yes');
  const [statusFilter, setStatusFilter] = useState<string>('Unresolved');
  const [showAll, setShowAll] = useState(false);
  const [threatLevelFilter, setThreatLevelFilter] = useState<string>('All');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('All');
  const [psyopTypeFilter, setPsyopTypeFilter] = useState<string>('All');
  const [stanceFilter, setStanceFilter] = useState<'all' | 'supportive' | 'neutral' | 'legitimate_criticism' | 'hostile_propaganda'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'none' | 'potential_psyop' | 'confirmed_psyop'>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unreviewed' | 'confirmed' | 'rejected' | 'needs_followup'>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [stageFilter, setStageFilter] = useState<'all' | 'quick' | 'deep' | 'deepest'>('all');

  // View and sort
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('threat');

  // Batch processing state
  const [batchMaxPosts, setBatchMaxPosts] = useState<number>(25);
  const [batchRunSummarize, setBatchRunSummarize] = useState<boolean>(true);
  const [batchRunQuick, setBatchRunQuick] = useState<boolean>(true);
  const [batchRunDeep, setBatchRunDeep] = useState<boolean>(true);
  const [batchRunDeepest, setBatchRunDeepest] = useState<boolean>(false);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  // Mount effect
  useEffect(() => {
    console.log('🟢 [PsyOpDetection] COMPONENT MOUNTED!');
    console.log('🟢 [PsyOpDetection] Location:', window.location.href);

    return () => {
      console.log('🔵 [PsyOpDetection] COMPONENT UNMOUNTING');
    };
  }, []);

  // Fetch posts with pagination
  useEffect(() => {
    console.log('📊 [PsyOpDetection] Fetching posts with filters:', {
      currentPage,
      threatLevelFilter,
      psyopTypeFilter,
      dateRange,
      riskFilter
    });
    fetchPosts();
  }, [currentPage, threatLevelFilter, psyopTypeFilter, dateRange, riskFilter]);

  const fetchPosts = async () => {
    try {
      console.log('⏳ [PsyOpDetection] fetchPosts started, setting loading=true');
      setLoading(true);
      
      // Build query with filters
      let query = supabase
        .from('posts')
        .select(`
      id,
      title,
      contents,
      source,
      author,
      published_at,
      is_psyop,
      psyop_confidence,
      psyop_risk_score,
      threat_level,
      stance_type,
      psyop_category,
      psyop_techniques,
      psyop_review_status,
      analysis_stage,
      quick_analyzed_at,
      deep_analyzed_at,
      deepest_analysis_completed_at,
      deepest_escalation_level,
      deepest_strategic_summary,
      deepest_key_risks,
      deepest_audience_segments,
      deepest_recommended_actions,
      deepest_monitoring_indicators,
      narrative_theme,
      psyop_technique,
      target_entity,
      analysis_summary,
      sentiment,
      keywords,
      urgency_level,
      virality_potential,
      psyop_reviewed_at,
      psyop_review_notes
    `, { count: 'exact' })
        .eq('is_psyop', true);

      if (riskFilter === 'high') {
        query = query.gte('psyop_risk_score', 70);
      } else if (riskFilter === 'medium') {
        query = query.gte('psyop_risk_score', 40).lte('psyop_risk_score', 69);
      } else if (riskFilter === 'low') {
        query = query.lte('psyop_risk_score', 39);
      }
      
      // Apply filters
      if (threatLevelFilter !== 'All') {
        query = query.eq('threat_level', threatLevelFilter);
      }
      
      if (psyopTypeFilter !== 'All') {
        query = query.contains('psyop_technique', [psyopTypeFilter]);
      }
      
      if (dateRange?.from) {
        query = query.gte('published_at', startOfDay(dateRange.from).toISOString());
      }
      
      if (dateRange?.to) {
        query = query.lte('published_at', startOfDay(dateRange.to).toISOString());
      }
      
      // Apply pagination
      const { data: postsData, error: postsError, count } = await query
        .order('published_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);
      
      if (postsError) throw postsError;

      setPosts(postsData || []);
      setTotalCount(count || 0);
      console.log('✅ [PsyOpDetection] Posts fetched successfully:', postsData?.length || 0, 'posts');

    } catch (error) {
      console.error('❌ [PsyOpDetection] Error fetching posts:', error);
      toast({
        title: "خطا در دریافت داده‌ها",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 [PsyOpDetection] fetchPosts completed, setting loading=false');
      setLoading(false);
    }
  };

  // Real-time updates for new PsyOps
  useEffect(() => {
    const channel = supabase
      .channel('psyop-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.is_psyop) {
            // Refresh current page to include new post
            fetchPosts();
            toast({
              title: "🚨 جنگ روانی جدید تشخیص داده شد",
              description: payload.new.title,
            });
          } else if (payload.eventType === 'UPDATE') {
            // Refresh current page to show updates
            fetchPosts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleReviewUpdate = async (
    postId: string,
    status: 'confirmed' | 'rejected' | 'needs_followup'
  ) => {
    const reviewedAt = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('posts')
        .update({
          psyop_review_status: status,
          psyop_reviewed_at: reviewedAt,
        })
        .eq('id', postId);

      if (error) {
        console.error('Failed to update review status', error);
        toast({
          title: 'خطا در به‌روزرسانی وضعیت',
          description: 'لطفاً دوباره تلاش کنید',
          variant: 'destructive',
        });
        return;
      }

      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, psyop_review_status: status, psyop_reviewed_at: reviewedAt }
            : p
        )
      );

      toast({
        title: 'وضعیت بررسی به‌روزرسانی شد',
        description: 'وضعیت جدید ثبت شد',
      });
    } catch (error) {
      console.error('Unexpected error updating review status', error);
      toast({
        title: 'خطای غیرمنتظره',
        description: 'لطفاً دوباره تلاش کنید',
        variant: 'destructive',
      });
    }
  };

  // Filter posts (client-side filtering for search only, other filters are server-side)
  const filteredPosts = useMemo(() => {
    let filtered = posts;

    if (reviewFilter !== 'all') {
      filtered = filtered.filter(
        p => (p.psyop_review_status ?? 'unreviewed') === reviewFilter
      );
    }

    if (stanceFilter !== 'all') {
      filtered = filtered.filter(p => (p.stance_type ?? 'neutral') === stanceFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => (p.psyop_category ?? 'none') === categoryFilter);
    }

    if (stageFilter !== 'all') {
      filtered = filtered.filter(p => p.analysis_stage === stageFilter);
    }

    if (riskFilter === 'high') {
      filtered = filtered.filter(p => (p.psyop_risk_score ?? 0) >= 70);
    } else if (riskFilter === 'medium') {
      filtered = filtered.filter(p => {
        const score = p.psyop_risk_score ?? 0;
        return score >= 40 && score <= 69;
      });
    } else if (riskFilter === 'low') {
      filtered = filtered.filter(p => (p.psyop_risk_score ?? 0) < 40);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        post =>
          post.title?.toLowerCase().includes(query) ||
          post.analysis_summary?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [posts, searchQuery, riskFilter, stanceFilter, categoryFilter, reviewFilter, stageFilter]);

  // Sort posts
  const sortedPosts = useMemo(() => {
    const sorted = [...filteredPosts];
    
    if (sortBy === 'threat') {
      const threatOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      sorted.sort((a, b) => {
        const aOrder = threatOrder[a.threat_level as keyof typeof threatOrder] ?? 999;
        const bOrder = threatOrder[b.threat_level as keyof typeof threatOrder] ?? 999;
        return aOrder - bOrder;
      });
    } else if (sortBy === 'date') {
      sorted.sort((a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    } else if (sortBy === 'risk_desc') {
      sorted.sort((a, b) => (b.psyop_risk_score ?? 0) - (a.psyop_risk_score ?? 0));
    } else if (sortBy === 'risk_asc') {
      sorted.sort((a, b) => (a.psyop_risk_score ?? 0) - (b.psyop_risk_score ?? 0));
    } else if (sortBy === 'urgency') {
      const urgencyOrder = { 'Immediate': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'Monitor Only': 4 };
      sorted.sort((a, b) => {
        const aOrder = urgencyOrder[a.urgency_level as keyof typeof urgencyOrder] ?? 999;
        const bOrder = urgencyOrder[b.urgency_level as keyof typeof urgencyOrder] ?? 999;
        return aOrder - bOrder;
      });
    } else if (sortBy === 'virality') {
      sorted.sort((a, b) => (b.virality_potential || 0) - (a.virality_potential || 0));
    }
    
    return sorted;
  }, [filteredPosts, sortBy]);

  // Quick stats
  const stats = useMemo(() => {
    const psyops = filteredPosts.filter(p => p.is_psyop === true);
    return {
      total: psyops.length,
      critical: psyops.filter(p => p.threat_level === 'Critical').length,
      high: psyops.filter(p => p.threat_level === 'High').length,
      avgConfidence: psyops.length > 0
        ? Math.round(psyops.reduce((sum, p) => sum + (p.psyop_confidence || 0), 0) / psyops.length)
        : 0,
      quickOnly: psyops.filter(p => p.analysis_stage === 'quick').length,
      deepCount: psyops.filter(p => p.analysis_stage === 'deep').length,
      deepestCount: psyops.filter(
        p => p.analysis_stage === 'deepest' || p.deepest_analysis_completed_at
      ).length,
    };
  }, [filteredPosts]);

  // Count by filter
  const counts = useMemo(() => {
    return {
      all: posts.length,
      yes: posts.filter(p => p.is_psyop === true).length,
      no: posts.filter(p => p.is_psyop === false).length,
      uncertain: posts.filter(p => p.is_psyop === null).length,
    };
  }, [posts]);

  const handleRunDeepestAnalysis = async (postId: string) => {
    try {
      setDeepestLoadingId(postId);

      const { data, error } = await supabase.functions.invoke('deepest-analysis', {
        body: { postId },
      });

      if (error) {
        console.error('Deepest analysis error', error);
        toast({
          title: 'خطا در تحلیل بحران',
          description: 'لطفاً دوباره تلاش کنید',
          variant: 'destructive',
        });
        return;
      }

      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? {
                ...p,
                deepest_escalation_level: data?.escalation_level ?? p.deepest_escalation_level ?? null,
                deepest_strategic_summary: data?.strategic_summary ?? p.deepest_strategic_summary ?? null,
                deepest_key_risks: data?.key_risks ?? p.deepest_key_risks ?? null,
                deepest_audience_segments: data?.audience_segments ?? p.deepest_audience_segments ?? null,
                deepest_recommended_actions: data?.recommended_actions ?? p.deepest_recommended_actions ?? null,
                deepest_monitoring_indicators: data?.monitoring_indicators ?? p.deepest_monitoring_indicators ?? null,
                deepest_analysis_completed_at: new Date().toISOString(),
              }
            : p
        )
      );

      toast({
        title: 'تحلیل بحران ثبت شد',
        description: 'نتایج تحلیل عمیق به‌روز شد',
      });
    } catch (err) {
      console.error('Unexpected deepest-analysis error', err);
      toast({
        title: 'خطای غیرمنتظره',
        description: 'لطفاً دوباره تلاش کنید',
        variant: 'destructive',
      });
    } finally {
      setDeepestLoadingId(null);
    }
  };

  const handleRunBatchPipeline = async () => {
    try {
      setIsBatchRunning(true);
      setBatchResult(null);

      const payload = {
        maxPosts: batchMaxPosts,
        runSummarize: batchRunSummarize,
        runQuick: batchRunQuick,
        runDeep: batchRunDeep,
        runDeepest: batchRunDeepest,
      };

      const { data, error } = await supabase.functions.invoke('psyop-batch-pipeline', {
        body: payload,
      });

      if (error) {
        console.error('Batch pipeline error', error);
        toast({
          title: 'خطا در اجرای پردازش گروهی',
          description: 'لطفاً دوباره تلاش کنید',
          variant: 'destructive',
        });
        setBatchResult({
          processed_posts: 0,
          summarize_calls: 0,
          quick_calls: 0,
          deep_calls: 0,
          deepest_calls: 0,
          errors: 1,
        });
        return;
      }

      setBatchResult(data || null);
      toast({
        title: 'پردازش گروهی اجرا شد',
        description: 'نتایج پردازش در بخش خلاصه قابل مشاهده است',
      });
    } catch (err) {
      console.error('Unexpected error during batch pipeline', err);
      toast({
        title: 'خطای غیرمنتظره در پردازش گروهی',
        description: 'لطفاً دوباره تلاش کنید',
        variant: 'destructive',
      });
      setBatchResult({
        processed_posts: 0,
        summarize_calls: 0,
        quick_calls: 0,
        deep_calls: 0,
        deepest_calls: 0,
        errors: 1,
      });
    } finally {
      setIsBatchRunning(false);
    }
  };

  console.log('🟠 [PsyOpDetection] RENDERING... loading=', loading, 'posts=', posts.length);

  if (loading) {
    console.log('⏳ [PsyOpDetection] Rendering LOADING screen');
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div className="text-lg font-semibold">در حال بارگذاری...</div>
          <div className="text-sm text-muted-foreground">
            اگر این پیام برای مدت طولانی نمایش داده می‌شود، ممکن است مشکلی وجود داشته باشد.
          </div>
        </div>
      </div>
    );
  }

  console.log('✨ [PsyOpDetection] Rendering MAIN content');
  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">تشخیص جنگ روانی</h1>
          <p className="text-muted-foreground mt-1">
            رصد و تحلیل عملیات‌های جنگ روانی علیه محور مقاومت
          </p>
        </div>
        <Badge variant="destructive" className="text-lg px-4 py-2">
          {stats.critical} بحرانی
        </Badge>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{stats.total}</div>
          <div className="text-sm text-muted-foreground">مجموع جنگ روانی</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-danger">{stats.critical}</div>
          <div className="text-sm text-muted-foreground">بحرانی</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
          <div className="text-sm text-muted-foreground">بالا</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-success">{stats.avgConfidence}%</div>
          <div className="text-sm text-muted-foreground">میانگین اطمینان</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-cyan-500">{stats.quickOnly}</div>
          <div className="text-sm text-muted-foreground">فقط Quick</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-500">{stats.deepCount}</div>
          <div className="text-sm text-muted-foreground">تحلیل عمیق (Deep)</div>
        </div>
        <div className="text-center">
          <div className={cn('text-2xl font-bold', stats.deepestCount > 0 ? 'text-rose-500 animate-pulse' : 'text-rose-500')}>
            {stats.deepestCount}
          </div>
          <div className="text-sm text-muted-foreground">تحلیل بحران (Deepest)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {user?.role === 'super_admin' && (
          <Card className="relative overflow-hidden">
            <div className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">پردازش گروهی (Batch)</div>
                {isBatchRunning && (
                  <span className="text-[11px] text-amber-600">در حال اجرا...</span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1">
                  <span>حداکثر پست:</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={batchMaxPosts}
                    onChange={(e) => setBatchMaxPosts(Number(e.target.value) || 1)}
                    className="w-16 border rounded px-1 py-0.5 text-right text-xs bg-background"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={batchRunSummarize}
                    onChange={(e) => setBatchRunSummarize(e.target.checked)}
                  />
                  <span>خلاصه‌سازی</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={batchRunQuick}
                    onChange={(e) => setBatchRunQuick(e.target.checked)}
                  />
                  <span>تشخیص سریع</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={batchRunDeep}
                    onChange={(e) => setBatchRunDeep(e.target.checked)}
                  />
                  <span>تحلیل عمیق</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={batchRunDeepest}
                    onChange={(e) => setBatchRunDeepest(e.target.checked)}
                  />
                  <span>تحلیل بحران (Deepest)</span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  onClick={handleRunBatchPipeline}
                  disabled={isBatchRunning}
                  className="px-3 py-1 rounded-lg text-xs font-semibold"
                >
                  {isBatchRunning ? 'در حال پردازش...' : 'اجرای پردازش گروهی'}
                </Button>

                {batchResult && (
                  <div className="text-[11px] text-muted-foreground text-left space-y-0.5">
                    <div>مرحله: {batchResult.stage ?? 'batch_pipeline'}</div>
                    <div>پست‌های پردازش‌شده: {batchResult.processed_posts ?? 0}</div>
                    <div>خلاصه‌سازی: {batchResult.summarize_calls ?? 0}</div>
                    <div>تشخیص سریع: {batchResult.quick_calls ?? 0}</div>
                    <div>تحلیل عمیق: {batchResult.deep_calls ?? 0}</div>
                    <div>تحلیل بحران: {batchResult.deepest_calls ?? 0}</div>
                    <div>خطاها: {batchResult.errors ?? 0}</div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="جستجو در عنوان و محتوا..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            <Badge
              variant={isPsyOpFilter === 'All' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setIsPsyOpFilter('All')}
            >
              همه ({counts.all})
            </Badge>
            <Badge
              variant={isPsyOpFilter === 'Yes' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setIsPsyOpFilter('Yes')}
            >
              جنگ روانی ({counts.yes})
            </Badge>
            <Badge
              variant={isPsyOpFilter === 'No' ? 'outline' : 'outline'}
              className="cursor-pointer"
              onClick={() => setIsPsyOpFilter('No')}
            >
              عادی ({counts.no})
            </Badge>
            <Badge
              variant={isPsyOpFilter === 'Uncertain' ? 'outline' : 'outline'}
              className="cursor-pointer"
              onClick={() => setIsPsyOpFilter('Uncertain')}
            >
              نامشخص ({counts.uncertain})
            </Badge>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex gap-1">
            {['All', 'Critical', 'High', 'Medium', 'Low'].map(level => (
              <Badge
                key={level}
                variant={threatLevelFilter === level ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer',
                  level === 'Critical' && threatLevelFilter === level && 'bg-danger',
                  level === 'High' && threatLevelFilter === level && 'bg-orange-600',
                  level === 'Medium' && threatLevelFilter === level && 'bg-yellow-600',
                  level === 'Low' && threatLevelFilter === level && 'bg-success'
                )}
                onClick={() => setThreatLevelFilter(level)}
              >
                {level === 'All' ? 'همه سطوح' : level}
              </Badge>
            ))}
          </div>
        </div>

        {/* More Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="وضعیت" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="All">همه</SelectItem>
              <SelectItem value="Unresolved">🔴 حل نشده</SelectItem>
              <SelectItem value="Acknowledged">🟡 تأیید شده</SelectItem>
              <SelectItem value="In Progress">🟠 در حال بررسی</SelectItem>
              <SelectItem value="Resolved">🟢 حل شده</SelectItem>
              <SelectItem value="False Positive">⚪ مثبت کاذب</SelectItem>
            </SelectContent>
          </Select>

          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="فوریت" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="All">همه</SelectItem>
              <SelectItem value="Immediate">فوری</SelectItem>
              <SelectItem value="High">بالا</SelectItem>
              <SelectItem value="Medium">متوسط</SelectItem>
              <SelectItem value="Low">پایین</SelectItem>
              <SelectItem value="Monitor Only">فقط رصد</SelectItem>
            </SelectContent>
          </Select>

          <Select value={psyopTypeFilter} onValueChange={setPsyopTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="نوع جنگ روانی" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="All">همه انواع</SelectItem>
              <SelectItem value="Direct Attack">حمله مستقیم</SelectItem>
              <SelectItem value="Indirect Accusation">اتهام غیرمستقیم</SelectItem>
              <SelectItem value="Doubt Creation">ایجاد شک</SelectItem>
              <SelectItem value="False Flag">پرچم جعلی</SelectItem>
              <SelectItem value="Demoralization">روحیه‌زدایی</SelectItem>
              <SelectItem value="Division Creation">ایجاد تفرقه</SelectItem>
              <SelectItem value="Information Warfare">جنگ اطلاعاتی</SelectItem>
              <SelectItem value="Propaganda Campaign">کمپین تبلیغاتی</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stanceFilter} onValueChange={(value) => setStanceFilter(value as typeof stanceFilter)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="فیلتر موضع" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="all">تمام مواضع</SelectItem>
              <SelectItem value="supportive">حامی</SelectItem>
              <SelectItem value="neutral">خنثی</SelectItem>
              <SelectItem value="legitimate_criticism">انتقاد مشروع</SelectItem>
              <SelectItem value="hostile_propaganda">تبلیغات خصمانه</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as typeof categoryFilter)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="دسته‌بندی عملیات روانی" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="all">تمام دسته‌ها</SelectItem>
              <SelectItem value="none">بدون عملیات</SelectItem>
              <SelectItem value="potential_psyop">احتمال عملیات روانی</SelectItem>
              <SelectItem value="confirmed_psyop">تأیید شده</SelectItem>
            </SelectContent>
          </Select>

          <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as typeof reviewFilter)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="وضعیت بررسی" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="unreviewed">بررسی نشده</SelectItem>
              <SelectItem value="confirmed">تأیید شده</SelectItem>
              <SelectItem value="rejected">رد شده</SelectItem>
              <SelectItem value="needs_followup">نیاز به پیگیری</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stageFilter} onValueChange={(value) => setStageFilter(value as typeof stageFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="مرحله تحلیل" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="all">همه مراحل</SelectItem>
              <SelectItem value="quick">Quick</SelectItem>
              <SelectItem value="deep">Deep</SelectItem>
              <SelectItem value="deepest">Deepest</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-60">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'PPP', { locale: faIR })} -{' '}
                      {format(dateRange.to, 'PPP', { locale: faIR })}
                    </>
                  ) : (
                    format(dateRange.from, 'PPP', { locale: faIR })
                  )
                ) : (
                  <span>انتخاب بازه زمانی</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <div className="mr-auto flex gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
                <SelectValue placeholder="مرتب‌سازی" />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="threat">سطح تهدید</SelectItem>
                <SelectItem value="date">تاریخ</SelectItem>
                <SelectItem value="risk_desc">ریسک (زیاد → کم)</SelectItem>
                <SelectItem value="risk_asc">ریسک (کم → زیاد)</SelectItem>
                <SelectItem value="urgency">فوریت</SelectItem>
                <SelectItem value="virality">پتانسیل ویروس</SelectItem>
              </SelectContent>
            </Select>

            <Select value={riskFilter} onValueChange={(value) => setRiskFilter(value as typeof riskFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="فیلتر ریسک" />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="all">تمام سطوح ریسک</SelectItem>
                <SelectItem value="high">ریسک بالا</SelectItem>
                <SelectItem value="medium">ریسک متوسط</SelectItem>
                <SelectItem value="low">ریسک پایین</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-1 border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm text-muted-foreground">نمایش همه (شامل حل شده)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Content */}
      {sortedPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="relative">
            <Shield className="h-24 w-24 text-success/30" />
            <CheckCircle className="h-12 w-12 text-success absolute bottom-0 right-0" />
          </div>
          <h3 className="text-2xl font-semibold text-center">
            هیچ عملیات جنگ روانی فعالی تشخیص داده نشد
          </h3>
          <p className="text-muted-foreground text-center">
            سیستم در حال رصد {posts.length} منبع است
          </p>
        </div>
      ) : (
        <div className={cn(
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-4'
        )}>
          {sortedPosts.map(post => {
            return (
              <div key={post.id} className="relative space-y-2">
                <PsyOpCard
                  post={post}
                  deepestLoadingId={deepestLoadingId}
                  onRunDeepestAnalysis={handleRunDeepestAnalysis}
                  onViewAnalysis={(post) => {
                    setSelectedPost(post);
                    setIsModalOpen(true);
                  }}
                  onPrepareResponse={(post) => {
                    toast({
                      title: "آماده‌سازی پاسخ",
                      description: "این ویژگی به زودی اضافه خواهد شد",
                    });
                  }}
                  onMarkFalsePositive={(post) => {
                    toast({
                      title: "علامت‌گذاری به عنوان مثبت کاذب",
                      description: "این ویژگی به زودی اضافه خواهد شد",
                    });
                  }}
                  onAddToCampaign={(post) => {
                    toast({
                      title: "افزودن به کمپین",
                      description: "این ویژگی به زودی اضافه خواهد شد",
                    });
                  }}
                  onStatusChange={async (postId, newStatus) => {
                    // Status change will be implemented after database migration
                    toast({
                      title: "⚠️ در حال توسعه",
                      description: "قابلیت تغییر وضعیت به زودی فعال می‌شود",
                    });
                  }}
                />

                <div className="mt-2 flex flex-wrap gap-2 text-xs justify-end">
                  {post.threat_level && (
                    <Badge variant="destructive">سطح تهدید: {post.threat_level}</Badge>
                  )}
                  {post.psyop_risk_score != null && (
                    <Badge variant="outline">ریسک: {post.psyop_risk_score}</Badge>
                  )}
                  {post.analysis_stage && (
                    <Badge variant="secondary">
                      {post.analysis_stage === 'quick' && 'Quick'}
                      {post.analysis_stage === 'deep' && 'Deep'}
                      {post.analysis_stage === 'deepest' && 'Deepest'}
                    </Badge>
                  )}
                  {post.deepest_analysis_completed_at && (
                    <Badge variant="outline">تحلیل بحران انجام شده</Badge>
                  )}
                </div>

                <div className="flex gap-2 mt-2 justify-end">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleReviewUpdate(post.id, 'confirmed')}
                  >
                    تأیید
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleReviewUpdate(post.id, 'rejected')}
                  >
                    مثبت کاذب
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleReviewUpdate(post.id, 'needs_followup')}
                  >
                    نیاز به پیگیری
                  </Button>
                </div>

                {Array.isArray(post.psyop_techniques) && post.psyop_techniques.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {post.psyop_techniques.map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-100 text-xs"
                      >
                        {tech.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && sortedPosts.length > 0 && (
        <DataPagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalCount / ITEMS_PER_PAGE)}
          totalItems={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          loading={loading}
        />
      )}

      {/* Analysis Modal */}
      <PsyOpAnalysisModal
        post={selectedPost}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {selectedPost?.deepest_analysis_completed_at && isModalOpen && (
        <Card className="mt-4 border border-rose-500/30 bg-card">
          <div className="p-4" dir="rtl">
            <h3 className="text-sm font-bold mb-2">تحلیل بحران (Deepest)</h3>

            {selectedPost.deepest_escalation_level && (
              <p className="text-xs mb-2">
                سطح تشدید: <span className="font-semibold">{selectedPost.deepest_escalation_level}</span>
              </p>
            )}

            {selectedPost.deepest_strategic_summary && (
              <p className="text-xs mb-3 leading-relaxed">
                {selectedPost.deepest_strategic_summary}
              </p>
            )}

            {selectedPost.deepest_key_risks && selectedPost.deepest_key_risks.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold mb-1">مهم‌ترین ریسک‌ها:</h4>
                <ul className="list-disc list-inside text-xs space-y-1">
                  {selectedPost.deepest_key_risks.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedPost.deepest_audience_segments && selectedPost.deepest_audience_segments.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold mb-1">گروه‌های مخاطب هدف:</h4>
                <ul className="list-disc list-inside text-xs space-y-1">
                  {selectedPost.deepest_audience_segments.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedPost.deepest_recommended_actions && selectedPost.deepest_recommended_actions.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold mb-1">اقدامات پیشنهادی:</h4>
                <ul className="list-disc list-inside text-xs space-y-1">
                  {selectedPost.deepest_recommended_actions.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedPost.deepest_monitoring_indicators && selectedPost.deepest_monitoring_indicators.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-1">شاخص‌های پایش:</h4>
                <ul className="list-disc list-inside text-xs space-y-1">
                  {selectedPost.deepest_monitoring_indicators.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PsyOpDetection;
