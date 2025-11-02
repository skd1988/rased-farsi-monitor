import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import PostDetailModal from '@/components/dashboard/PostDetailModal';
import { toast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';

const PsyOpDetection = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filters
  const [isPsyOpFilter, setIsPsyOpFilter] = useState<string>('Yes');
  const [threatLevelFilter, setThreatLevelFilter] = useState<string>('All');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('All');
  const [psyopTypeFilter, setPsyopTypeFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  
  // View and sort
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('threat');

  // Fetch posts
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        // Fetch posts with their AI analysis
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .order('published_at', { ascending: false });
        
        if (postsError) throw postsError;

        // Fetch all AI analysis
        const { data: analysisData, error: analysisError } = await supabase
          .from('ai_analysis')
          .select('*');
        
        if (analysisError) throw analysisError;

        // Merge posts with their analysis
        const mergedPosts = (postsData || []).map(post => {
          const analysis = analysisData?.find(a => a.post_id === post.id);
          return {
            ...post,
            ...analysis,
            // Keep post-level fields if analysis doesn't have them
            is_psyop: post.is_psyop ?? (analysis?.is_psyop === 'Yes'),
          };
        });

        setPosts(mergedPosts);
      } catch (error) {
        console.error('Error fetching posts:', error);
        toast({
          title: "خطا در دریافت داده‌ها",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();

    // Real-time updates
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
          if (payload.eventType === 'INSERT') {
            const newPost = payload.new;
            
            // Fetch analysis for new post
            const { data: analysis } = await supabase
              .from('ai_analysis')
              .select('*')
              .eq('post_id', newPost.id)
              .single();

            const mergedPost = { ...newPost, ...analysis };
            
            if (newPost.is_psyop) {
              setPosts(prev => [mergedPost, ...prev]);
              toast({
                title: "🚨 جنگ روانی جدید تشخیص داده شد",
                description: newPost.title,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            // Fetch updated analysis
            const { data: analysis } = await supabase
              .from('ai_analysis')
              .select('*')
              .eq('post_id', payload.new.id)
              .single();

            const mergedPost = { ...payload.new, ...analysis };
            setPosts(prev => 
              prev.map(p => p.id === payload.new.id ? mergedPost : p)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter posts
  const filteredPosts = useMemo(() => {
    let filtered = posts;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post => 
        post.title?.toLowerCase().includes(query) ||
        post.contents?.toLowerCase().includes(query)
      );
    }

    // Is PsyOp filter
    if (isPsyOpFilter !== 'All') {
      filtered = filtered.filter(post => {
        if (isPsyOpFilter === 'Yes') return post.is_psyop === true;
        if (isPsyOpFilter === 'No') return post.is_psyop === false;
        if (isPsyOpFilter === 'Uncertain') return post.is_psyop === null;
        return true;
      });
    }

    // Threat level filter
    if (threatLevelFilter !== 'All') {
      filtered = filtered.filter(post => post.threat_level === threatLevelFilter);
    }

    // Urgency filter
    if (urgencyFilter !== 'All') {
      filtered = filtered.filter(post => post.urgency_level === urgencyFilter);
    }

    // PsyOp type filter
    if (psyopTypeFilter !== 'All') {
      filtered = filtered.filter(post => post.psyop_type === psyopTypeFilter);
    }

    // Date range filter
    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from);
      filtered = filtered.filter(post => {
        const postDate = new Date(post.published_at);
        return postDate >= fromDate && (!dateRange.to || postDate <= dateRange.to);
      });
    }

    return filtered;
  }, [posts, searchQuery, isPsyOpFilter, threatLevelFilter, urgencyFilter, psyopTypeFilter, dateRange]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
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
      </div>

      {/* Filters */}
      <div className="space-y-4">
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
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="فوریت" />
            </SelectTrigger>
            <SelectContent>
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
            <SelectContent>
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
              <SelectContent>
                <SelectItem value="threat">سطح تهدید</SelectItem>
                <SelectItem value="date">تاریخ</SelectItem>
                <SelectItem value="urgency">فوریت</SelectItem>
                <SelectItem value="virality">پتانسیل ویروس</SelectItem>
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
          {sortedPosts.map(post => (
            <PsyOpCard
              key={post.id}
              post={post}
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
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <PostDetailModal
        post={selectedPost}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default PsyOpDetection;
