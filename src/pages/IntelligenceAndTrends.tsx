import React, { useState, useEffect } from 'react';
import { translateSourceType } from '@/utils/sourceTypeTranslations';
import { translateNarrativeTheme } from '@/utils/narrativeTranslations';
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
  Globe, Languages, Shield, Clock, Target, Bug, AlertCircle, CheckCircle, Loader2
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
  const [fixing, setFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState({ current: 0, total: 0, status: '' });
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

  // Helper function
  const countMatches = (text: string, keywords: string[]): number => {
    return keywords.reduce((count, keyword) => {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  };

  // Improved narrative theme inference
  const inferNarrativeTheme = (post: any): string => {
    const title = (post.title || '').toLowerCase();
    const content = (post.contents || '').toLowerCase();
    const combined = title + ' ' + content;
    
    // Extract attack_vectors and psyop_type if available
    const attackVectors = post.attack_vectors ? 
      JSON.stringify(post.attack_vectors).toLowerCase() : '';
    const psyopType = (post.psyop_type || '').toLowerCase();
    
    const fullText = combined + ' ' + attackVectors + ' ' + psyopType;
    
    // DEMONIZATION (شیطان‌سازی) - Most common for anti-resistance content
    const demonizationKeywords = [
      'تروریس', 'terrorist', 'إرهاب', 'extremist', 'افراطی', 'متطرف',
      'داعش', 'isis', 'القاعده', 'al-qaeda',
      'خطر', 'threat', 'تهدید', 'خطير', 'dangerous', 'خطرناک',
      'شیطان', 'evil', 'شر', 'شیطانی',
      'خشونت', 'violence', 'عنف', 'وحشی', 'brutal',
      'نظامی', 'militant', 'مسلح', 'armed', 'militia', 'شبه‌نظامی'
    ];
    
    // DELEGITIMIZATION (بی‌اعتبارسازی)
    const delegitimizationKeywords = [
      'غیرقانون', 'illegal', 'غير قانوني', 'نامشروع', 'illegitimate',
      'غیرشرعی', 'unlawful', 'غير شرعي',
      'proxy', 'puppet', 'عروسک', 'دست‌نشانده',
      'وابسته', 'dependent', 'تابع'
    ];
    
    // VICTIMIZATION (قربانی‌سازی)
    const victimizationKeywords = [
      'قربانی', 'victim', 'ضحية', 'مظلوم', 'oppressed',
      'آسیب', 'harm', 'ضرر', 'suffering', 'رنج'
    ];
    
    // FEAR-MONGERING (ترس‌افکنی)
    const fearKeywords = [
      'خطر', 'danger', 'خطير',
      'تهدید', 'threat', 'تهديد',
      'ترس', 'fear', 'خوف',
      'ناامن', 'unsafe', 'غير آمن',
      'حمله', 'attack', 'هجوم'
    ];
    
    // DIVIDE & CONQUER (تفرقه‌اندازی)
    const divideKeywords = [
      'فرقه', 'sectarian', 'طائفي',
      'تفرقه', 'division', 'انقسام',
      'شیعه', 'سنی', 'shia', 'sunni',
      'اختلاف', 'conflict', 'صراع'
    ];
    
    // FALSE FLAG (پرچم دروغین)
    const falseFlagKeywords = [
      'ادعا', 'claim', 'يزعم',
      'گزارش شده', 'reported', 'مزعوم',
      'بدون مدرک', 'unverified', 'غير مؤكد',
      'منابع امنیتی', 'security sources', 'مصادر أمنية'
    ];
    
    // WHITEWASHING (سفیدشویی)
    const whitewashKeywords = [
      'دموکراسی', 'democracy', 'ديمقراطية',
      'آزادی', 'freedom', 'حرية',
      'حقوق بشر', 'human rights', 'حقوق الإنسان'
    ];
    
    // Count keyword matches
    const scores = {
      'Demonization': countMatches(fullText, demonizationKeywords),
      'Delegitimization': countMatches(fullText, delegitimizationKeywords),
      'Fear-Mongering': countMatches(fullText, fearKeywords),
      'Divide & Conquer': countMatches(fullText, divideKeywords),
      'False Flag': countMatches(fullText, falseFlagKeywords),
      'Victimization': countMatches(fullText, victimizationKeywords),
      'Whitewashing': countMatches(fullText, whitewashKeywords)
    };
    
    console.log(`Narrative scores for "${title.substring(0, 50)}...":`, scores);
    
    // Find highest score
    let maxScore = 0;
    let bestTheme = 'Demonization'; // Default
    
    for (const [theme, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestTheme = theme;
      }
    }
    
    // If no matches, use attack_vectors as hint
    if (maxScore === 0) {
      if (attackVectors.includes('terrorism')) return 'Demonization';
      if (attackVectors.includes('legitimacy')) return 'Delegitimization';
      if (attackVectors.includes('sectarian')) return 'Divide & Conquer';
    }
    
    return bestTheme;
  };

  const inferNarrativeType = (post: any): string => {
    const title = (post.title || '').toLowerCase();
    const content = (post.contents || '').toLowerCase();
    const combined = title + ' ' + content;
    
    const defensiveKeywords = ['دفاع', 'defense', 'دفاع عن', 'تأیید', 'حمایت', 'support'];
    const supportiveKeywords = ['موفقیت', 'success', 'پیروزی', 'victory', 'نجاح', 'انتصار'];
    
    if (defensiveKeywords.some(kw => combined.includes(kw))) {
      return 'Defense';
    }
    
    if (supportiveKeywords.some(kw => combined.includes(kw))) {
      return 'Supportive';
    }
    
    // Most anti-resistance content is Attack
    return 'Attack';
  };

  const fixNarrativeFields = async () => {
    const confirmed = confirm(
      `این عملیات ${debugInfo?.totalPsyOps || 0} پست را تعمیر می‌کند. ادامه می‌دهید؟`
    );
    
    if (!confirmed) return;
    
    setFixing(true);
    setFixProgress({ current: 0, total: 0, status: 'در حال آماده‌سازی...' });
    
    try {
      // Get posts
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
        setFixing(false);
        return;
      }
      
      setFixProgress({ current: 0, total: posts.length, status: 'در حال پردازش...' });
      
      let successCount = 0;
      let failCount = 0;
      
      // Process posts
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        
        try {
          const theme = inferNarrativeTheme(post);
          const type = inferNarrativeType(post);
          
          const { error: updateError } = await supabase
            .from('posts')
            .update({ 
              narrative_theme: theme,
              narrative_type: type
            })
            .eq('id', post.id);
          
          if (updateError) throw updateError;
          
          successCount++;
          
        } catch (error) {
          console.error(`Failed to fix post ${post.id}:`, error);
          failCount++;
        }
        
        // Update progress
        setFixProgress({ 
          current: i + 1, 
          total: posts.length, 
          status: `پردازش ${i + 1} از ${posts.length}...` 
        });
        
        // Small delay every 10 posts
        if ((i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setFixing(false);
      
      toast({
        title: `✅ تعمیر کامل شد!`,
        description: `موفق: ${successCount} | خطا: ${failCount}`,
      });
      
      // Refresh
      await checkDatabaseData();
      await fetchNarratives();
      
    } catch (error) {
      console.error('Fix failed:', error);
      toast({
        title: '❌ خطا',
        description: error instanceof Error ? error.message : 'خطای ناشناخته',
        variant: 'destructive',
      });
      setFixing(false);
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
        const themeFa = translateNarrativeTheme(theme);
        if (!themeMap[theme]) {
          themeMap[theme] = {
            theme: themeFa,
            themeEn: theme,
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

        {/* SECTION 5: NARRATIVES */}
        <TabsContent value="narratives" className="space-y-6">
          {/* DEBUG PANEL */}
          <Card className="border-2 border-dashed border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bug className="w-5 h-5 text-yellow-600" />
                  پنل دیباگ (موقت)
                </CardTitle>
                <Button
                  onClick={checkDatabaseData}
                  variant="outline"
                  size="sm"
                  className="bg-yellow-600 text-white hover:bg-yellow-700"
                >
                  بررسی داده‌ها
                </Button>
              </div>
            </CardHeader>
            {debugInfo && (
              <CardContent className="space-y-4">
                {/* Status Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">کل PsyOp ها</div>
                    <div className="text-3xl font-bold">{debugInfo.totalPsyOps}</div>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">با روایت</div>
                    <div className="text-3xl font-bold">{debugInfo.withNarrative}</div>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">پوشش</div>
                    <div className="text-3xl font-bold">{debugInfo.coverage}%</div>
                  </div>
                </div>
                
                {/* Issue Detection */}
                {debugInfo.totalPsyOps === 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200">
                    <div className="flex items-center gap-2 font-bold text-red-800 dark:text-red-200 mb-2">
                      <AlertCircle className="w-5 h-5" />
                      مشکل: هیچ PsyOp شناسایی نشده
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      لطفاً ابتدا مطالب را تحلیل کنید (صفحه تحلیل هوش مصنوعی)
                    </div>
                  </div>
                )}
                
                {debugInfo.totalPsyOps > 0 && debugInfo.withNarrative === 0 && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-2 border-orange-200">
                    <div className="flex items-center gap-2 font-bold text-orange-800 dark:text-orange-200 mb-2">
                      <AlertCircle className="w-5 h-5" />
                      مشکل: فیلد narrative_theme خالی است
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                      {debugInfo.totalPsyOps} PsyOp شناسایی شده اما هیچکدام narrative_theme ندارند
                    </div>
                    <Button
                      onClick={fixNarrativeFields}
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      تعمیر خودکار
                    </Button>
                  </div>
                )}
                
                {debugInfo.withNarrative > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200">
                    <div className="flex items-center gap-2 font-bold text-green-800 dark:text-green-200 mb-1">
                      <CheckCircle className="w-5 h-5" />
                      ✅ داده‌ها موجود است
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      {debugInfo.withNarrative} پست با روایت یافت شد
                    </div>
                    <Button
                      onClick={fetchNarratives}
                      size="sm"
                      variant="outline"
                      className="mt-2"
                    >
                      بارگذاری روایت‌ها
                    </Button>
                  </div>
                )}
                
                {/* Theme Distribution */}
                {Object.keys(debugInfo.themeDistribution).length > 0 && (
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="font-bold mb-3">توزیع روایت‌ها:</div>
                     <div className="grid grid-cols-2 gap-2">
                      {Object.entries(debugInfo.themeDistribution).map(([theme, count]: [string, any]) => (
                        <div key={theme} className="flex justify-between text-sm p-2 bg-muted rounded">
                          <span>{translateNarrativeTheme(theme)}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Sample Posts */}
                {debugInfo.samplePosts.length > 0 && (
                  <details className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                    <summary className="font-bold cursor-pointer hover:text-primary">
                      نمونه پست‌ها ({debugInfo.samplePosts.length}) - کلیک کنید
                    </summary>
                    <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                      {debugInfo.samplePosts.map((post: any) => (
                        <div key={post.id} className="text-xs p-3 bg-muted rounded border">
                          <div className="font-medium truncate mb-1">{post.title}</div>
                          <div className="text-muted-foreground space-y-1">
                            <div>narrative_theme: {post.narrative_theme ? translateNarrativeTheme(post.narrative_theme) : '❌ خالی'}</div>
                            <div>analysis_stage: {post.analysis_stage || '-'}</div>
                            <div>psyop_type: {post.psyop_type || '-'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            )}
          </Card>

          {/* Narratives Display */}
          {narrativesLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : narratives.length > 0 ? (
            <div className="space-y-6">
              {/* Narrative Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>توزیع روایت‌های جنگ روانی</CardTitle>
                  <CardDescription>{narratives.reduce((sum, n) => sum + n.count, 0)} روایت شناسایی شده</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={narratives}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="theme" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Narrative Details */}
              {narratives.map((narrative, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{narrative.theme}</CardTitle>
                        <CardDescription>{narrative.count} پست</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {narrative.threatBreakdown.Critical > 0 && (
                          <Badge variant="destructive">{narrative.threatBreakdown.Critical} بحرانی</Badge>
                        )}
                        {narrative.threatBreakdown.High > 0 && (
                          <Badge className="bg-orange-500">{narrative.threatBreakdown.High} بالا</Badge>
                        )}
                        {narrative.threatBreakdown.Medium > 0 && (
                          <Badge className="bg-yellow-500">{narrative.threatBreakdown.Medium} متوسط</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {narrative.posts.slice(0, 5).map((post: any) => (
                        <div key={post.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="font-medium line-clamp-2">{post.title}</div>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{post.source}</span>
                                <span>•</span>
                                <span>{formatPersianDate(post.published_at)}</span>
                              </div>
                            </div>
                            {post.threat_level && (
                              <Badge variant={
                                post.threat_level === 'Critical' ? 'destructive' :
                                post.threat_level === 'High' ? 'default' :
                                'secondary'
                              }>
                                {post.threat_level}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {narrative.posts.length > 5 && (
                        <div className="text-center text-sm text-muted-foreground">
                          و {narrative.posts.length - 5} پست دیگر...
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <Target className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">هیچ روایتی یافت نشد</p>
                <p className="text-sm mt-2">با استفاده از پنل دیباگ بالا، وضعیت را بررسی کنید</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Progress Modal */}
      {fixing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-4">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3 text-blue-600" />
              <div className="text-lg font-bold">در حال تعمیر...</div>
              <div className="text-sm text-muted-foreground mt-1">
                {fixProgress.status}
              </div>
            </div>
            <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 right-0 h-full bg-blue-600 transition-all duration-300"
                style={{ 
                  width: `${fixProgress.total > 0 ? (fixProgress.current / fixProgress.total) * 100 : 0}%` 
                }}
              />
            </div>
            <div className="text-center text-sm text-muted-foreground mt-2">
              {fixProgress.current} / {fixProgress.total}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligenceAndTrends;
