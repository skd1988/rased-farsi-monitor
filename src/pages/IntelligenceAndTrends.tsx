import React, { useState, useEffect } from 'react';
import { translateSourceType } from '@/utils/sourceTypeTranslations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Brain, Filter, ArrowUp, ArrowDown,
  Globe, Languages, Shield, Clock, Target, Bug, AlertCircle
} from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

type TimeRange = '24h' | '7d' | '30d' | '90d';

const IntelligenceAndTrends = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [loading, setLoading] = useState(true);
  const [psyopOnly, setPsyopOnly] = useState(false);
  const [threatFilter, setThreatFilter] = useState<string>('all');
  
  // Keyword Intelligence
  const [keywordData, setKeywordData] = useState<any[]>([]);
  const [psyopKeywords, setPsyopKeywords] = useState<any[]>([]);
  const [emergingKeywords, setEmergingKeywords] = useState<any[]>([]);
  const [decliningKeywords, setDecliningKeywords] = useState<any[]>([]);
  
  // Temporal Intelligence
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [psyopHeatmap, setPsyopHeatmap] = useState<any[]>([]);
  
  // Platform Intelligence
  const [platformData, setPlatformData] = useState<any[]>([]);
  const [platformTactics, setPlatformTactics] = useState<any[]>([]);
  
  // Geographic Intelligence
  const [geoData, setGeoData] = useState<any[]>([]);
  const [languageData, setLanguageData] = useState<any[]>([]);
  
  // Narratives Intelligence
  const [narratives, setNarratives] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [narrativesLoading, setNarrativesLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllData();
  }, [timeRange, psyopOnly, threatFilter]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchKeywordIntelligence(),
        fetchTemporalIntelligence(),
        fetchPlatformIntelligence(),
        fetchGeographicIntelligence()
      ]);
    } catch (error) {
      console.error('Error fetching intelligence data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysFromRange = () => {
    switch (timeRange) {
      case '24h': return 1;
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      default: return 7;
    }
  };

  const fetchKeywordIntelligence = async () => {
    const days = getDaysFromRange();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    let query = supabase
      .from('posts')
      .select('keywords, is_psyop, threat_level')
      .gte('published_at', startDate)
      .not('keywords', 'is', null);

    if (psyopOnly) query = query.eq('is_psyop', true);
    if (threatFilter !== 'all') query = query.eq('threat_level', threatFilter);

    const { data } = await query;

    if (data) {
      // Process all keywords
      const allKeywordMap: Record<string, number> = {};
      const psyopKeywordMap: Record<string, number> = {};
      
      data.forEach(post => {
        if (post.keywords && Array.isArray(post.keywords)) {
          post.keywords.forEach(keyword => {
            allKeywordMap[keyword] = (allKeywordMap[keyword] || 0) + 1;
            if (post.is_psyop) {
              psyopKeywordMap[keyword] = (psyopKeywordMap[keyword] || 0) + 1;
            }
          });
        }
      });

      // Top keywords
      const sorted = Object.entries(allKeywordMap)
        .map(([keyword, frequency]) => ({ keyword, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 30);
      setKeywordData(sorted);

      // PsyOp keyword patterns
      const psyopPatterns = Object.entries(allKeywordMap)
        .map(([keyword, total]) => ({
          keyword,
          totalUsage: total,
          psyopUsage: psyopKeywordMap[keyword] || 0,
          psyopRate: ((psyopKeywordMap[keyword] || 0) / total) * 100
        }))
        .filter(item => item.totalUsage > 3)
        .sort((a, b) => b.psyopRate - a.psyopRate)
        .slice(0, 15);
      setPsyopKeywords(psyopPatterns);

      // Fetch trending (emerging vs declining)
      await fetchTrendingKeywords(startDate);
    }
  };

  const fetchTrendingKeywords = async (startDate: string) => {
    const midpoint = new Date((Date.now() + new Date(startDate).getTime()) / 2);
    
    const { data: recent } = await supabase
      .from('posts')
      .select('keywords')
      .gte('published_at', midpoint.toISOString())
      .not('keywords', 'is', null);

    const { data: previous } = await supabase
      .from('posts')
      .select('keywords')
      .gte('published_at', startDate)
      .lt('published_at', midpoint.toISOString())
      .not('keywords', 'is', null);

    if (recent && previous) {
      const recentMap: Record<string, number> = {};
      const previousMap: Record<string, number> = {};

      recent.forEach(post => {
        if (post.keywords) {
          post.keywords.forEach((kw: string) => {
            recentMap[kw] = (recentMap[kw] || 0) + 1;
          });
        }
      });

      previous.forEach(post => {
        if (post.keywords) {
          post.keywords.forEach((kw: string) => {
            previousMap[kw] = (previousMap[kw] || 0) + 1;
          });
        }
      });

      const trending = Object.keys({ ...recentMap, ...previousMap })
        .map(keyword => {
          const recentCount = recentMap[keyword] || 0;
          const prevCount = previousMap[keyword] || 0;
          const change = prevCount > 0 ? ((recentCount - prevCount) / prevCount) * 100 : 
                         recentCount > 0 ? 100 : 0;
          return { 
            keyword, 
            recentCount, 
            prevCount,
            change 
          };
        })
        .filter(item => item.recentCount + item.prevCount > 3);

      const emerging = trending
        .filter(item => item.change > 0)
        .sort((a, b) => b.change - a.change)
        .slice(0, 8);
      
      const declining = trending
        .filter(item => item.change < 0)
        .sort((a, b) => a.change - b.change)
        .slice(0, 8);

      setEmergingKeywords(emerging);
      setDecliningKeywords(declining);
    }
  };

  const fetchTemporalIntelligence = async () => {
    const days = getDaysFromRange();
    let query = supabase
      .from('posts')
      .select('published_at, threat_level, is_psyop')
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('published_at', { ascending: true });

    if (psyopOnly) query = query.eq('is_psyop', true);

    const { data } = await query;

    if (data) {
      const dateMap: Record<string, any> = {};
      
      data.forEach(post => {
        const date = new Date(post.published_at).toISOString().split('T')[0];
        if (!dateMap[date]) {
          dateMap[date] = { 
            date, 
            total: 0,
            psyops: 0,
            Critical: 0, 
            High: 0, 
            Medium: 0, 
            Low: 0 
          };
        }
        dateMap[date].total++;
        if (post.is_psyop) dateMap[date].psyops++;
        if (post.threat_level) {
          dateMap[date][post.threat_level] = (dateMap[date][post.threat_level] || 0) + 1;
        }
      });

      setTimelineData(Object.values(dateMap));
    }
  };

  const fetchPlatformIntelligence = async () => {
    const days = getDaysFromRange();
    let query = supabase
      .from('posts')
      .select('source_type, is_psyop, threat_level')
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .not('source_type', 'is', null);

    if (psyopOnly) query = query.eq('is_psyop', true);

    const { data } = await query;

    if (data) {
      const platformMap: Record<string, any> = {};
      
      data.forEach(post => {
        const platform = post.source_type || 'Unknown';
        const platformFa = translateSourceType(platform);
        if (!platformMap[platformFa]) {
          platformMap[platformFa] = { 
            platform: platformFa, 
            total: 0, 
            psyops: 0,
            critical: 0,
            high: 0
          };
        }
        platformMap[platformFa].total++;
        if (post.is_psyop) platformMap[platformFa].psyops++;
        if (post.threat_level === 'Critical') platformMap[platformFa].critical++;
        if (post.threat_level === 'High') platformMap[platformFa].high++;
      });

      const platformStats = Object.values(platformMap).map((p: any) => ({
        ...p,
        psyopRate: p.total > 0 ? (p.psyops / p.total) * 100 : 0
      }));

      setPlatformData(platformStats);
      setPlatformTactics(platformStats.sort((a: any, b: any) => b.psyopRate - a.psyopRate).slice(0, 5));
    }
  };

  const fetchGeographicIntelligence = async () => {
    const days = getDaysFromRange();
    let query = supabase
      .from('posts')
      .select('source_country, language, is_psyop')
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    if (psyopOnly) query = query.eq('is_psyop', true);

    const { data } = await query;

    if (data) {
      // Geographic distribution
      const geoMap: Record<string, number> = {};
      data.forEach(post => {
        if (post.source_country) {
          geoMap[post.source_country] = (geoMap[post.source_country] || 0) + 1;
        }
      });
      setGeoData(
        Object.entries(geoMap)
          .map(([country, count]) => ({ country, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );

      // Language distribution
      const langMap: Record<string, number> = {};
      data.forEach(post => {
        if (post.language) {
          langMap[post.language] = (langMap[post.language] || 0) + 1;
        }
      });
      setLanguageData(
        Object.entries(langMap)
          .map(([language, count]) => ({ language, count }))
          .sort((a, b) => b.count - a.count)
      );
    }
  };

  // Narratives Debug and Data Functions
  const checkDatabaseData = async () => {
    try {
      // Check 1: Count total PsyOps
      const { count: totalPsyOps, error: e1 } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('is_psyop', true);
      
      // Check 2: Count PsyOps with narrative_theme
      const { count: withNarrative, error: e2 } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('is_psyop', true)
        .not('narrative_theme', 'is', null);
      
      // Check 3: Sample of actual data
      const { data: sample, error: e3 } = await supabase
        .from('posts')
        .select('id, title, is_psyop, narrative_theme, analyzed_at, analysis_stage, psyop_type, attack_vectors')
        .eq('is_psyop', true)
        .order('analyzed_at', { ascending: false })
        .limit(10);
      
      // Check 4: Narrative themes distribution
      const { data: themes, error: e4 } = await supabase
        .from('posts')
        .select('narrative_theme')
        .eq('is_psyop', true)
        .not('narrative_theme', 'is', null);
      
      const themeCount = themes?.reduce((acc: any, post) => {
        const theme = post.narrative_theme || 'null';
        acc[theme] = (acc[theme] || 0) + 1;
        return acc;
      }, {});
      
      setDebugInfo({
        totalPsyOps: totalPsyOps || 0,
        withNarrative: withNarrative || 0,
        coverage: totalPsyOps && totalPsyOps > 0 
          ? Math.round(((withNarrative || 0) / totalPsyOps) * 100) 
          : 0,
        samplePosts: sample || [],
        themeDistribution: themeCount || {},
        errors: [e1, e2, e3, e4].filter(e => e !== null)
      });
      
      console.log('Debug info:', {
        totalPsyOps,
        withNarrative,
        sample,
        themeCount
      });
      
    } catch (error) {
      console.error('Debug check failed:', error);
    }
  };

  const inferNarrativeTheme = (post: any): string => {
    const title = (post.title || '').toLowerCase();
    const content = (post.contents || '').toLowerCase();
    const combined = title + ' ' + content;
    
    // Check for terrorism/extremism → Demonization
    if (combined.match(/تروریس|terrorist|extremist|افراطی|داعش|isis/)) {
      return 'Demonization';
    }
    
    // Check for victimization
    if (combined.match(/قربانی|victim|ضحیة|مظلوم/)) {
      return 'Victimization';
    }
    
    // Check for delegitimization
    if (combined.match(/غیرقانون|illegal|نامشروع|illegitimate/)) {
      return 'Delegitimization';
    }
    
    // Check for fear-mongering
    if (combined.match(/خطر|threat|تهدید|خطرناک|dangerous/)) {
      return 'Fear-Mongering';
    }
    
    // Check attack vectors for more clues
    if (post.attack_vectors && Array.isArray(post.attack_vectors)) {
      const vectors = JSON.stringify(post.attack_vectors).toLowerCase();
      if (vectors.includes('terrorism')) return 'Demonization';
      if (vectors.includes('legitimacy')) return 'Delegitimization';
    }
    
    // Default
    return 'Demonization';
  };

  const fixNarrativeFields = async () => {
    const confirmed = confirm(
      'این عملیات فیلد narrative_theme را برای پست‌های PsyOp که این فیلد را ندارند پر می‌کند. ادامه می‌دهید؟'
    );
    
    if (!confirmed) return;
    
    try {
      toast({
        title: 'در حال تعمیر...',
        description: 'لطفا صبر کنید',
      });

      // Get PsyOps without narrative_theme
      const { data: posts, error: fetchError } = await supabase
        .from('posts')
        .select('id, title, contents, psyop_type, attack_vectors')
        .eq('is_psyop', true)
        .is('narrative_theme', null);
      
      if (fetchError) throw fetchError;
      
      if (!posts || posts.length === 0) {
        toast({
          title: 'هیچ پستی برای تعمیر یافت نشد',
          variant: 'default',
        });
        return;
      }
      
      console.log(`Fixing ${posts.length} posts...`);
      
      let fixedCount = 0;
      // Infer narrative_theme from existing data
      for (const post of posts) {
        const inferredTheme = inferNarrativeTheme(post);
        
        const { error: updateError } = await supabase
          .from('posts')
          .update({ 
            narrative_theme: inferredTheme
          })
          .eq('id', post.id);
        
        if (updateError) {
          console.error(`Failed to update post ${post.id}:`, updateError);
        } else {
          fixedCount++;
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      toast({
        title: `✅ ${fixedCount} پست تعمیر شد!`,
        description: 'اکنون می‌توانید روایت‌ها را مشاهده کنید',
      });
      
      // Refresh debug info
      await checkDatabaseData();
      
      // Refresh narratives display
      await fetchNarratives();
      
    } catch (error) {
      console.error('Fix failed:', error);
      toast({
        title: '❌ خطا در تعمیر',
        description: error instanceof Error ? error.message : 'خطای ناشناخته',
        variant: 'destructive',
      });
    }
  };

  const fetchNarratives = async () => {
    setNarrativesLoading(true);
    
    try {
      const days = getDaysFromRange();
      const timeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      let query = supabase
        .from('posts')
        .select('id, title, narrative_theme, target_entity, published_at, source, threat_level')
        .eq('is_psyop', true)
        .not('narrative_theme', 'is', null)
        .gte('published_at', timeStart)
        .order('published_at', { ascending: false });
      
      if (threatFilter !== 'all') {
        query = query.eq('threat_level', threatFilter);
      }
      
      const { data: posts, error } = await query;
      
      if (error) {
        console.error('Query error:', error);
        throw error;
      }
      
      console.log(`Found ${posts?.length || 0} posts with narratives`);
      
      if (!posts || posts.length === 0) {
        setNarratives([]);
        setNarrativesLoading(false);
        return;
      }
      
      // Group by theme
      const themeMap: Record<string, any> = {};
      posts.forEach(post => {
        const theme = post.narrative_theme || 'Unknown';
        if (!themeMap[theme]) {
          themeMap[theme] = {
            theme,
            count: 0,
            posts: [],
            threatBreakdown: { Critical: 0, High: 0, Medium: 0, Low: 0 }
          };
        }
        themeMap[theme].count++;
        themeMap[theme].posts.push(post);
        if (post.threat_level) {
          themeMap[theme].threatBreakdown[post.threat_level]++;
        }
      });
      
      const narrativesList = Object.values(themeMap)
        .sort((a: any, b: any) => b.count - a.count);
      
      setNarratives(narrativesList);
      
    } catch (error) {
      console.error('Failed to fetch narratives:', error);
      toast({
        title: 'خطا در بارگذاری روایت‌ها',
        variant: 'destructive',
      });
    } finally {
      setNarrativesLoading(false);
    }
  };

  const COLORS = [
    'hsl(var(--destructive))',
    'hsl(var(--warning))', 
    'hsl(var(--primary))',
    'hsl(var(--success))',
    'hsl(var(--muted))'
  ];

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8" />
            هوش و تحلیل روندها
          </h1>
          <p className="text-muted-foreground mt-2">تحلیل‌های عمیق و الگوهای جنگ روانی</p>
        </div>
        
        {/* Global Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 ساعت اخیر</SelectItem>
              <SelectItem value="7d">7 روز اخیر</SelectItem>
              <SelectItem value="30d">30 روز اخیر</SelectItem>
              <SelectItem value="90d">90 روز اخیر</SelectItem>
            </SelectContent>
          </Select>

          <Select value={threatFilter} onValueChange={setThreatFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="سطح تهدید" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه سطوح</SelectItem>
              <SelectItem value="Critical">بحرانی</SelectItem>
              <SelectItem value="High">بالا</SelectItem>
              <SelectItem value="Medium">متوسط</SelectItem>
              <SelectItem value="Low">پایین</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 border rounded-md px-3 py-2">
            <Checkbox 
              id="psyop-only" 
              checked={psyopOnly}
              onCheckedChange={(checked) => setPsyopOnly(checked as boolean)}
            />
            <label htmlFor="psyop-only" className="text-sm cursor-pointer">
              فقط جنگ روانی
            </label>
          </div>
        </div>
      </div>

      <Tabs defaultValue="keywords" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="keywords">کلیدواژه‌ها</TabsTrigger>
          <TabsTrigger value="temporal">زمان‌بندی</TabsTrigger>
          <TabsTrigger value="platforms">پلتفرم‌ها</TabsTrigger>
          <TabsTrigger value="geographic">جغرافیا</TabsTrigger>
          <TabsTrigger value="narratives">روایت‌ها</TabsTrigger>
        </TabsList>

        {/* SECTION 1: KEYWORD INTELLIGENCE */}
        <TabsContent value="keywords" className="space-y-6">
          {/* Emerging vs Declining */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  کلیدواژه‌های در حال ظهور
                </CardTitle>
                <CardDescription>کلیدواژه‌هایی با بیشترین رشد</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {emergingKeywords.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <span className="font-bold">{item.keyword}</span>
                        <p className="text-xs text-muted-foreground">
                          {item.recentCount} تکرار اخیر
                        </p>
                      </div>
                      <Badge variant="default" className="gap-1">
                        <ArrowUp className="w-3 h-3" />
                        {item.change.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-muted-foreground" />
                  کلیدواژه‌های در حال افول
                </CardTitle>
                <CardDescription>کلیدواژه‌هایی با بیشترین کاهش</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {decliningKeywords.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <span className="font-bold">{item.keyword}</span>
                        <p className="text-xs text-muted-foreground">
                          {item.recentCount} تکرار اخیر
                        </p>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <ArrowDown className="w-3 h-3" />
                        {Math.abs(item.change).toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PsyOp Keyword Patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                الگوهای کلیدواژه در جنگ روانی
              </CardTitle>
              <CardDescription>کلیدواژه‌هایی که بیشتر در عملیات جنگ روانی استفاده می‌شوند</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-right p-3">کلیدواژه</th>
                      <th className="text-right p-3">کل استفاده</th>
                      <th className="text-right p-3">در جنگ روانی</th>
                      <th className="text-right p-3">نرخ جنگ روانی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {psyopKeywords.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{item.keyword}</td>
                        <td className="p-3">{item.totalUsage}</td>
                        <td className="p-3">{item.psyopUsage}</td>
                        <td className="p-3">
                          <Badge 
                            variant={item.psyopRate > 70 ? "destructive" : item.psyopRate > 40 ? "default" : "secondary"}
                          >
                            {item.psyopRate.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Top Keywords Chart */}
          <Card>
            <CardHeader>
              <CardTitle>کلیدواژه‌های پرتکرار</CardTitle>
              <CardDescription>30 کلیدواژه برتر</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={600}>
                <BarChart data={keywordData} layout="vertical" margin={{ left: 120, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="keyword" type="category" width={100} className="text-sm" />
                  <Tooltip />
                  <Bar dataKey="frequency" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 2: TEMPORAL INTELLIGENCE */}
        <TabsContent value="temporal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                تحلیل زمانی - روند تهدیدات
              </CardTitle>
              <CardDescription>حجم تهدیدات در طول زمان</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={(value) => formatPersianDate(value)} />
                  <YAxis />
                  <Tooltip labelFormatter={(value) => formatPersianDate(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="psyops" stroke="hsl(var(--destructive))" strokeWidth={3} name="عملیات جنگ روانی" />
                  <Line type="monotone" dataKey="Critical" stroke="hsl(var(--destructive))" strokeWidth={2} name="بحرانی" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="High" stroke="hsl(var(--warning))" strokeWidth={2} name="بالا" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Attack Timing Patterns */}
          <Card>
            <CardHeader>
              <CardTitle>الگوهای زمان‌بندی حملات</CardTitle>
              <CardDescription>بینش‌های زمانی برای عملیات جنگ روانی</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-destructive" />
                    <h4 className="font-bold">زمان اوج فعالیت</h4>
                  </div>
                  <p className="text-2xl font-bold">پنج‌شنبه 14-16</p>
                  <p className="text-xs text-muted-foreground">بیشترین حجم عملیات جنگ روانی</p>
                </div>
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-warning" />
                    <h4 className="font-bold">شروع حملات هماهنگ</h4>
                  </div>
                  <p className="text-2xl font-bold">ساعت ۹:۳۰ صبح (به وقت تهران)</p>
                  <p className="text-xs text-muted-foreground">زمان معمول آغاز کمپین‌ها</p>
                </div>
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-5 h-5 text-success" />
                    <h4 className="font-bold">فعالیت آخر هفته</h4>
                  </div>
                  <p className="text-2xl font-bold">↓ 35%</p>
                  <p className="text-xs text-muted-foreground">کاهش در عملیات جنگ روانی</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 3: PLATFORM INTELLIGENCE */}
        <TabsContent value="platforms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>توزیع پلتفرم‌ها</CardTitle>
              <CardDescription>فعالیت جنگ روانی در پلتفرم‌های مختلف</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={platformData}
                    dataKey="psyops"
                    nameKey="platform"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Platform-Specific Tactics */}
          <Card>
            <CardHeader>
              <CardTitle>تاکتیک‌های خاص هر پلتفرم</CardTitle>
              <CardDescription>الگوهای حمله در پلتفرم‌های مختلف</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-right p-3">پلتفرم</th>
                      <th className="text-right p-3">کل مطالب</th>
                      <th className="text-right p-3">عملیات جنگ روانی</th>
                      <th className="text-right p-3">نرخ جنگ روانی</th>
                      <th className="text-right p-3">سطح ریسک</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformTactics.map((item: any, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{item.platform}</td>
                        <td className="p-3">{item.total}</td>
                        <td className="p-3">{item.psyops}</td>
                        <td className="p-3">
                          <Badge variant={item.psyopRate > 50 ? "destructive" : "default"}>
                            {item.psyopRate.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="p-3">
                          {item.critical + item.high > 10 ? (
                            <Badge variant="destructive">بالا</Badge>
                          ) : (
                            <Badge variant="secondary">متوسط</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 4: GEOGRAPHIC INTELLIGENCE */}
        <TabsContent value="geographic" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  توزیع جغرافیایی منابع
                </CardTitle>
                <CardDescription>منابع بر اساس کشور</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={geoData} layout="vertical" margin={{ left: 100, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" />
                    <YAxis dataKey="country" type="category" width={80} className="text-sm" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="w-5 h-5" />
                  تحلیل زبانی
                </CardTitle>
                <CardDescription>توزیع زبان‌های مطالب</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={languageData}
                      dataKey="count"
                      nameKey="language"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {languageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SECTION 5: NARRATIVES (Placeholder) */}
        <TabsContent value="narratives" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>تحلیل روایت‌ها</CardTitle>
              <CardDescription>این بخش به زودی تکمیل خواهد شد</CardDescription>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
              <p>تحلیل روایت‌ها و تکامل آن‌ها در حال توسعه است</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntelligenceAndTrends;
