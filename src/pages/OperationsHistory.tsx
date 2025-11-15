import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { formatPersianDate, formatPersianDateLong } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';
import {
  Archive,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Target,
  Network,
  Radio,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Clock,
  Filter,
  Download,
  Flame,
  Eye,
  Users,
  Megaphone,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import {
  DailyDigest,
  SignificantPost,
  AttackVectorHistory,
  NarrativeHistory,
  TargetAttackHistory,
  CampaignArchive,
  SourceTimeline,
  HistoryFilters,
  MonthlyStats,
} from '@/types/history';
import { cn } from '@/lib/utils';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

// Color scheme
const COLORS = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#CA8A04',
  low: '#2563EB',
  success: '#16A34A',
  primary: '#6366F1',
  purple: '#9333EA',
};

const CHART_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#F97316'];

// ترجمه عناوین بردارهای حمله به فارسی
const VECTOR_NAME_TRANSLATIONS: Record<string, string> = {
  'Legitimacy Questioning': 'زیر سؤال بردن مشروعیت',
  'Weakness Portrayal': 'نمایش ضعف',
  'Foreign Interference': 'دخالت خارجی',
  'Sectarian Division': 'تفرقه فرقه‌ای',
  'Terrorism Labeling': 'برچسب تروریستی',
  'Human Rights Violations': 'نقض حقوق بشر',
  'Corruption Allegations': 'اتهام فساد',
  'Fearmongering': 'ترس‌آفرینی',
  'Disinformation': 'اطلاعات نادرست',
  'Character Assassination': 'ترور شخصیت',
  'False Flag Operations': 'عملیات پرچم دروغین',
  'Emotional Manipulation': 'دستکاری احساسی',
  'Scapegoating': 'قربانی‌سازی',
  'Demonization': 'شیطان‌سازی',
};

// ترجمه عناوین روایت‌ها به فارسی
const narrativeTranslations: Record<string, string> = {
  'Corruption': 'فساد',
  'Terrorism': 'تروریسم',
  'Foreign Agent': 'عامل خارجی',
  'Weakness': 'ضعف',
  'Illegitimacy': 'عدم مشروعیت',
  'Sectarianism': 'فرقه‌گرایی',
  'Violence': 'خشونت',
  'Extremism': 'افراط‌گرایی',
  'Destabilization': 'بی‌ثباتی',
  'Human Rights Abuse': 'نقض حقوق بشر',
};

const OperationsHistory = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('daily-digest');
  const [loading, setLoading] = useState(false);

  // Global Filters
  const [filters, setFilters] = useState<HistoryFilters>({
    startDate: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    threatLevel: 'all',
  });

  // Data states
  const [dailyDigests, setDailyDigests] = useState<DailyDigest[]>([]);
  const [significantPosts, setSignificantPosts] = useState<SignificantPost[]>([]);
  const [attackVectors, setAttackVectors] = useState<AttackVectorHistory[]>([]);
  const [narratives, setNarratives] = useState<NarrativeHistory[]>([]);
  const [targetHistory, setTargetHistory] = useState<TargetAttackHistory[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignArchive[]>([]);
  const [sourceTimelines, setSourceTimelines] = useState<SourceTimeline[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [highRiskSources, setHighRiskSources] = useState<any[]>([]);
  const [highRiskChannels, setHighRiskChannels] = useState<any[]>([]);

  // Aggregate attack vectors by vector_name and add Persian translation
  const aggregatedAttackVectors = React.useMemo(() => {
    const aggregated = attackVectors.reduce((acc, item) => {
      const existing = acc.find((v) => v.vector_name === item.vector_name);
      if (existing) {
        existing.usage_count += item.usage_count;
        existing.critical_count += item.critical_count;
        existing.high_count += item.high_count;
      } else {
        acc.push({ ...item });
      }
      return acc;
    }, [] as AttackVectorHistory[]);

    // Sort by usage_count descending
    const sorted = aggregated.sort((a, b) => b.usage_count - a.usage_count);

    // Add Persian translation
    return sorted.map((vector) => ({
      ...vector,
      vector_name_persian: VECTOR_NAME_TRANSLATIONS[vector.vector_name] || vector.vector_name,
    }));
  }, [attackVectors]);

  // Aggregate Narratives by narrative and add Persian translation
  const aggregatedNarratives = React.useMemo(() => {
    const grouped = narratives.reduce((acc: any, item: any) => {
      const key = item.narrative;
      if (!acc[key]) {
        acc[key] = {
          narrative: key,
          usage_count: 0,
          impact_score: 0,
          impact_scores: [],
          reach_estimate: 0,
          category: item.category,
          evolution_notes: item.evolution_notes,
        };
      }
      acc[key].usage_count += item.usage_count || 0;
      acc[key].reach_estimate += item.reach_estimate || 0;
      if (item.impact_score) {
        acc[key].impact_scores.push(item.impact_score);
      }
      return acc;
    }, {});

    return Object.values(grouped)
      .map((n: any) => ({
        ...n,
        impact_score:
          n.impact_scores.length > 0
            ? n.impact_scores.reduce((a: number, b: number) => a + b, 0) / n.impact_scores.length
            : 0,
        narrative_persian: narrativeTranslations[n.narrative] || n.narrative,
      }))
      .sort((a: any, b: any) => b.usage_count - a.usage_count);
  }, [narratives]);

  // Fetch data on mount and filter change
  useEffect(() => {
    fetchAllData();
  }, [filters]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDailyDigests(),
        fetchSignificantPosts(),
        fetchAttackVectors(),
        fetchNarratives(),
        fetchTargetHistory(),
        fetchCampaigns(),
        fetchSourceTimelines(),
        fetchMonthlyStats(),
        fetchHighRiskSources(),
        fetchHighRiskChannels(),
      ]);
    } catch (error) {
      console.error('Error fetching history data:', error);
      toast({
        title: 'خطا در بارگذاری داده‌ها',
        description: 'لطفاً دوباره تلاش کنید.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyDigests = async () => {
    const { data, error } = await supabase
      .from('daily_intelligence_digest')
      .select('*')
      .gte('digest_date', filters.startDate!)
      .lte('digest_date', filters.endDate!)
      .order('digest_date', { ascending: false });

    if (!error && data) setDailyDigests(data);
  };

  const fetchSignificantPosts = async () => {
    let query = supabase
      .from('significant_posts_archive')
      .select('*')
      .gte('archived_date', filters.startDate!)
      .lte('archived_date', filters.endDate!)
      .order('archived_date', { ascending: false });

    if (filters.threatLevel && filters.threatLevel !== 'all') {
      query = query.eq('threat_level', filters.threatLevel);
    }

    const { data, error } = await query;
    if (!error && data) setSignificantPosts(data);
  };

  const fetchAttackVectors = async () => {
    const { data, error } = await supabase
      .from('attack_vector_history')
      .select('*')
      .gte('date', filters.startDate!)
      .lte('date', filters.endDate!)
      .order('date', { ascending: false });

    if (!error && data) setAttackVectors(data);
  };

  const fetchNarratives = async () => {
    const { data, error } = await supabase
      .from('narrative_history')
      .select('*')
      .order('usage_count', { ascending: false });

    if (!error && data) setNarratives(data);
  };

  const fetchTargetHistory = async () => {
    const { data, error } = await supabase
      .from('target_attack_history')
      .select('*')
      .order('attack_count', { ascending: false });

    if (!error && data) setTargetHistory(data);
  };

  const fetchCampaigns = async () => {
    let query = supabase
      .from('psyop_campaigns_archive')
      .select('*')
      .order('archived_date', { ascending: false });

    const { data, error } = await query;
    if (!error && data) setCampaigns(data);
  };

  const fetchSourceTimelines = async () => {
    const { data, error } = await supabase
      .from('source_behavior_timeline')
      .select('*')
      .gte('date', filters.startDate!)
      .lte('date', filters.endDate!)
      .order('date', { ascending: false });

    if (!error && data) setSourceTimelines(data);
  };

  const fetchMonthlyStats = async () => {
    // Generate monthly stats from available data
    const stats: MonthlyStats[] = [];
    const months = 12;

    for (let i = 0; i < months; i++) {
      const monthStart = format(startOfMonth(subMonths(new Date(), i)), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(subMonths(new Date(), i)), 'yyyy-MM-dd');

      const { data: postsData } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gte('published_at', monthStart)
        .lte('published_at', monthEnd);

      const { data: psyopData } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('is_psyop', true)
        .gte('published_at', monthStart)
        .lte('published_at', monthEnd);

      stats.push({
        month: format(subMonths(new Date(), i), 'yyyy-MM'),
        totalPosts: postsData?.length || 0,
        psyopPosts: psyopData?.length || 0,
        criticalThreats: 0,
        activeCampaigns: 0,
        uniqueSources: 0,
        topNarratives: [],
        topTargets: [],
      });
    }

    setMonthlyStats(stats.reverse());
  };

  const fetchHighRiskSources = async () => {
    const { data, error } = await supabase
      .from('high_risk_sources')
      .select(`
        "منبع",
        "تعداد مطالب",
        "عملیات روانی",
        "درصد PsyOp",
        "بحرانی",
        "تهدید بالا",
        "سطح خطر",
        "آخرین پست"
      `)
      .order('"درصد PsyOp"', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching high risk sources:', error);
      return;
    }

    // Map Persian column names to English for use in code
    const mappedSources = data?.map((s: any) => ({
      source: s['منبع'],
      total_posts: s['تعداد مطالب'],
      psyop_count: s['عملیات روانی'],
      psyop_rate: s['درصد PsyOp'],
      critical: s['بحرانی'],
      high: s['تهدید بالا'],
      risk_level: s['سطح خطر'],
      last_post: s['آخرین پست'],
    })) || [];

    setHighRiskSources(mappedSources);
  };

  const fetchHighRiskChannels = async () => {
    const { data, error } = await supabase
      .from('high_risk_sources')
      .select(`
        "منبع",
        "تعداد مطالب",
        "عملیات روانی",
        "درصد PsyOp",
        "بحرانی",
        "تهدید بالا",
        "سطح خطر",
        "آخرین پست"
      `)
      .or('"منبع".ilike.%(Facebook)%,"منبع".ilike.%(Telegram)%,"منبع".ilike.%YouTube%')
      .order('"درصد PsyOp"', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching high risk channels:', error);
      return;
    }

    // Map to English names with platform detection
    const mappedChannels = data?.map((s: any) => ({
      channel_name: s['منبع'],
      platform: s['منبع'].includes('Facebook') ? 'Facebook' :
                s['منبع'].includes('Telegram') ? 'Telegram' :
                s['منبع'].includes('YouTube') ? 'YouTube' : 'Other',
      total_posts: s['تعداد مطالب'],
      psyop_count: s['عملیات روانی'],
      psyop_rate: s['درصد PsyOp'],
      critical: s['بحرانی'],
      high: s['تهدید بالا'],
      risk_level: s['سطح خطر'],
      last_post: s['آخرین پست'],
    })) || [];

    setHighRiskChannels(mappedChannels);
  };

  // Render helpers
  const getThreatBadge = (level: string) => {
    const colors = {
      Critical: 'bg-red-600',
      High: 'bg-orange-600',
      Medium: 'bg-yellow-600',
      Low: 'bg-blue-600',
    };
    return <Badge className={cn('text-white', colors[level as keyof typeof colors])}>{level}</Badge>;
  };

  const getRiskLevelEmoji = (level: string) => {
    const emojiMap: Record<string, string> = {
      'بحرانی': '🔴',
      'بالا': '🟠',
      'متوسط': '🟡',
      'پایین': '🟢',
      'Critical': '🔴',
      'High': '🟠',
      'Medium': '🟡',
      'Low': '🟢',
    };
    return emojiMap[level] || '⚪';
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Archive className="w-16 h-16 text-muted-foreground mb-4" />
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  );

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Archive className="w-8 h-8 text-primary" />
            تاریخچه عملیات‌های روانی
          </h1>
          <p className="text-muted-foreground mt-2">
            آرشیو هوشمند و تحلیل تاریخچه عملیات روانی شناسایی شده
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          دریافت گزارش کامل
        </Button>
      </div>

      {/* Global Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            فیلترهای جستجو
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">از تاریخ</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">تا تاریخ</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            {/* Threat Level */}
            <div className="space-y-2">
              <label className="text-sm font-medium">سطح تهدید</label>
              <Select
                value={filters.threatLevel}
                onValueChange={(value) => setFilters({ ...filters, threatLevel: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="Critical">بحرانی</SelectItem>
                  <SelectItem value="High">بالا</SelectItem>
                  <SelectItem value="Medium">متوسط</SelectItem>
                  <SelectItem value="Low">پایین</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
                    startDate: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
                    endDate: format(new Date(), 'yyyy-MM-dd'),
                    threatLevel: 'all',
                  })
                }
                className="w-full"
              >
                بازنشانی فیلترها
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 lg:grid-cols-10 gap-2 h-auto p-2 bg-muted">
          <TabsTrigger value="daily-digest" className="flex flex-col gap-1 py-2">
            <CalendarIcon className="w-4 h-4" />
            <span className="text-xs">خلاصه روزانه</span>
          </TabsTrigger>
          <TabsTrigger value="significant-posts" className="flex flex-col gap-1 py-2">
            <Flame className="w-4 h-4" />
            <span className="text-xs">پست‌های برجسته</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex flex-col gap-1 py-2">
            <Network className="w-4 h-4" />
            <span className="text-xs">کمپین‌ها</span>
          </TabsTrigger>
          <TabsTrigger value="targets" className="flex flex-col gap-1 py-2">
            <Target className="w-4 h-4" />
            <span className="text-xs">حمله به اهداف</span>
          </TabsTrigger>
          <TabsTrigger value="attack-vectors" className="flex flex-col gap-1 py-2">
            <Shield className="w-4 h-4" />
            <span className="text-xs">بردارهای حمله</span>
          </TabsTrigger>
          <TabsTrigger value="narratives" className="flex flex-col gap-1 py-2">
            <Megaphone className="w-4 h-4" />
            <span className="text-xs">روایت‌ها</span>
          </TabsTrigger>
          <TabsTrigger value="risky-sources" className="flex flex-col gap-1 py-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs">منابع پرخطر</span>
          </TabsTrigger>
          <TabsTrigger value="risky-channels" className="flex flex-col gap-1 py-2">
            <Radio className="w-4 h-4" />
            <span className="text-xs">کانال‌های پرخطر</span>
          </TabsTrigger>
          <TabsTrigger value="monthly-reports" className="flex flex-col gap-1 py-2">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs">گزارش ماهانه</span>
          </TabsTrigger>
          <TabsTrigger value="overall-stats" className="flex flex-col gap-1 py-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs">آمار کلی</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Daily Digest */}
        <TabsContent value="daily-digest" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : dailyDigests.length === 0 ? (
            <EmptyState message="هیچ خلاصه روزانه‌ای در این بازه زمانی یافت نشد" />
          ) : (
            <>
              {/* Timeline Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>روند عملیات روانی</CardTitle>
                  <CardDescription>نمودار روند شناسایی PsyOps در طول زمان</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyDigests}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="digest_date"
                        tickFormatter={(date) => format(new Date(date), 'MM/dd')}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(date) => formatPersianDate(date)}
                        contentStyle={{ direction: 'rtl' }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="psyop_posts"
                        stroke={COLORS.critical}
                        name="PsyOps"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="critical_threats"
                        stroke={COLORS.high}
                        name="تهدیدات بحرانی"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Daily Digest Cards */}
              <div className="grid grid-cols-1 gap-4">
                {dailyDigests.map((digest) => (
                  <Card key={digest.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5" />
                          خلاصه روز {formatPersianDateLong(digest.digest_date)}
                        </CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="outline">{digest.total_posts} پست</Badge>
                          <Badge className="bg-red-600 text-white">
                            {digest.psyop_posts} PsyOp
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Threat Distribution */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                          <div className="text-sm text-muted-foreground">بحرانی</div>
                          <div className="text-2xl font-bold text-red-600">
                            {digest.critical_threats}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                          <div className="text-sm text-muted-foreground">بالا</div>
                          <div className="text-2xl font-bold text-orange-600">
                            {digest.high_threats}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                          <div className="text-sm text-muted-foreground">متوسط</div>
                          <div className="text-2xl font-bold text-yellow-600">
                            {digest.medium_threats}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <div className="text-sm text-muted-foreground">پایین</div>
                          <div className="text-2xl font-bold text-blue-600">
                            {digest.low_threats}
                          </div>
                        </div>
                      </div>

                      {/* Key Insights */}
                      {digest.key_insights && (
                        <div className="p-4 rounded-lg bg-muted">
                          <h4 className="font-semibold mb-2">نکات کلیدی:</h4>
                          <p className="text-sm">{digest.key_insights}</p>
                        </div>
                      )}

                      {/* Top Items */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {digest.top_narratives && digest.top_narratives.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2 text-sm">روایت‌های برتر:</h4>
                            <div className="flex flex-wrap gap-1">
                              {digest.top_narratives.slice(0, 3).map((narrative, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {narrative}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {digest.top_targets && digest.top_targets.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2 text-sm">اهداف برتر:</h4>
                            <div className="flex flex-wrap gap-1">
                              {digest.top_targets.slice(0, 3).map((target, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {target}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {digest.top_attack_vectors && digest.top_attack_vectors.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2 text-sm">بردارهای حمله:</h4>
                            <div className="flex flex-wrap gap-1">
                              {digest.top_attack_vectors.slice(0, 3).map((vector, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {vector}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 2: Significant Posts */}
        <TabsContent value="significant-posts" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : significantPosts.length === 0 ? (
            <EmptyState message="هیچ پست برجسته‌ای در این بازه زمانی یافت نشد" />
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کل پست‌ها
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{significantPosts.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      بحرانی
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">
                      {significantPosts.filter((p) => p.threat_level === 'Critical').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      بالا
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      {significantPosts.filter((p) => p.threat_level === 'High').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      میانگین امتیاز PsyOp
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {(
                        significantPosts.reduce((sum, p) => sum + (p.psyop_score || 0), 0) /
                        significantPosts.length
                      ).toFixed(1)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Threat Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>توزیع سطوح تهدید</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: 'بحرانی',
                            value: significantPosts.filter((p) => p.threat_level === 'Critical')
                              .length,
                          },
                          {
                            name: 'بالا',
                            value: significantPosts.filter((p) => p.threat_level === 'High').length,
                          },
                          {
                            name: 'متوسط',
                            value: significantPosts.filter((p) => p.threat_level === 'Medium')
                              .length,
                          },
                          {
                            name: 'پایین',
                            value: significantPosts.filter((p) => p.threat_level === 'Low').length,
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill={COLORS.critical} />
                        <Cell fill={COLORS.high} />
                        <Cell fill={COLORS.medium} />
                        <Cell fill={COLORS.low} />
                      </Pie>
                      <Tooltip contentStyle={{ direction: 'rtl' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Posts List */}
              <div className="space-y-3">
                {significantPosts.slice(0, 20).map((post) => (
                  <Card key={post.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {getThreatBadge(post.threat_level)}
                            <Badge variant="outline">{post.source_type}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {post.source_name}
                            </span>
                          </div>
                          <h3 className="font-semibold">{post.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatPersianDate(post.published_at)}
                            </span>
                            <span>امتیاز PsyOp: {post.psyop_score}</span>
                          </div>
                          {post.significance_reason && (
                            <div className="mt-3 p-3 rounded bg-muted text-sm">
                              <strong>دلیل اهمیت:</strong> {post.significance_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 3: Campaigns Archive */}
        <TabsContent value="campaigns" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : campaigns.length === 0 ? (
            <EmptyState message="هیچ کمپین آرشیو شده‌ای یافت نشد" />
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کل کمپین‌ها
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{campaigns.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      فعال
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {campaigns.filter((c) => c.status === 'Active').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      تکمیل شده
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      {campaigns.filter((c) => c.status === 'Completed').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      آرشیو شده
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-600">
                      {campaigns.filter((c) => c.status === 'Archived').length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Campaigns List */}
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <Card key={campaign.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <Network className="w-5 h-5" />
                            {campaign.campaign_name}
                          </CardTitle>
                          <CardDescription>{campaign.description}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {getThreatBadge(campaign.severity)}
                          <Badge
                            className={cn(
                              campaign.status === 'Active' && 'bg-green-600',
                              campaign.status === 'Completed' && 'bg-blue-600',
                              campaign.status === 'Archived' && 'bg-gray-600',
                              'text-white'
                            )}
                          >
                            {campaign.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">شروع:</span>{' '}
                          {formatPersianDate(campaign.start_date)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">پایان:</span>{' '}
                          {campaign.end_date ? formatPersianDate(campaign.end_date) : 'ادامه دارد'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">تعداد پست:</span>{' '}
                          {campaign.total_posts}
                        </div>
                        <div>
                          <span className="text-muted-foreground">منابع:</span>{' '}
                          {campaign.participating_sources?.length || 0}
                        </div>
                      </div>

                      {campaign.impact_assessment && (
                        <div className="p-3 rounded bg-muted">
                          <strong className="text-sm">ارزیابی تأثیر:</strong>
                          <p className="text-sm mt-1">{campaign.impact_assessment}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 4: Target Attack History */}
        <TabsContent value="targets" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : targetHistory.length === 0 ? (
            <EmptyState message="هیچ تاریخچه حمله‌ای یافت نشد" />
          ) : (
            <>
              {/* Top 20 Targets Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>20 هدف برتر</CardTitle>
                  <CardDescription>اهداف با بیشترین حملات</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={targetHistory.slice(0, 20)}
                      layout="vertical"
                      margin={{ left: 100 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="target_name" type="category" width={100} />
                      <Tooltip contentStyle={{ direction: 'rtl' }} />
                      <Bar dataKey="attack_count" fill={COLORS.critical} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Targets by Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Persons */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      افراد هدف‌گرفته شده
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {targetHistory
                        .filter((t) => t.target_type === 'Person')
                        .slice(0, 10)
                        .map((target) => (
                          <div
                            key={target.id}
                            className="flex items-center justify-between p-3 rounded bg-muted"
                          >
                            <span className="font-medium">{target.target_name}</span>
                            <Badge variant="destructive">{target.attack_count} حمله</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Organizations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      نهادها و سازمان‌ها
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {targetHistory
                        .filter((t) => t.target_type === 'Organization')
                        .slice(0, 10)
                        .map((target) => (
                          <div
                            key={target.id}
                            className="flex items-center justify-between p-3 rounded bg-muted"
                          >
                            <span className="font-medium">{target.target_name}</span>
                            <Badge variant="destructive">{target.attack_count} حمله</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 5: Attack Vectors History */}
        <TabsContent value="attack-vectors" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : aggregatedAttackVectors.length === 0 ? (
            <EmptyState message="هیچ بردار حمله‌ای یافت نشد" />
          ) : (
            <>
              {/* Frequency Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>فراوانی بردارهای حمله</CardTitle>
                  <CardDescription>
                    نمودار میزان استفاده از بردارهای مختلف حمله در بازه زمانی انتخاب شده
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={aggregatedAttackVectors.slice(0, 15)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="vector_name_persian"
                        angle={-45}
                        textAnchor="end"
                        height={120}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis />
                      <Tooltip
                        contentStyle={{ direction: 'rtl' }}
                        formatter={(value: number, name: string) => {
                          if (name === 'usage_count') return [value, 'تعداد استفاده'];
                          if (name === 'critical_count') return [value, 'بحرانی'];
                          if (name === 'high_count') return [value, 'بالا'];
                          return [value, name];
                        }}
                      />
                      <Legend
                        formatter={(value) => {
                          if (value === 'usage_count') return 'تعداد استفاده';
                          if (value === 'critical_count') return 'بحرانی';
                          if (value === 'high_count') return 'بالا';
                          return value;
                        }}
                      />
                      <Bar dataKey="usage_count" fill={COLORS.primary} name="تعداد استفاده">
                        {aggregatedAttackVectors.slice(0, 15).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                      <Bar dataKey="critical_count" fill={COLORS.critical} name="بحرانی" />
                      <Bar dataKey="high_count" fill={COLORS.high} name="بالا" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Attack Vectors List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aggregatedAttackVectors.map((vector, index) => (
                  <Card key={`${vector.vector_name}-${index}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{vector.vector_name_persian}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {vector.vector_name}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <div className="text-xs text-muted-foreground">تعداد استفاده</div>
                          <div className="text-xl font-bold text-blue-600">{vector.usage_count}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                          <div className="text-xs text-muted-foreground">بحرانی</div>
                          <div className="text-xl font-bold text-red-600">{vector.critical_count}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                          <div className="text-xs text-muted-foreground">بالا</div>
                          <div className="text-xl font-bold text-orange-600">{vector.high_count}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/20">
                          <div className="text-xs text-muted-foreground">میانگین تهدید</div>
                          <div className="text-xl font-bold text-gray-600">
                            {vector.avg_threat_level.toFixed(1)}
                          </div>
                        </div>
                      </div>
                      {vector.sources && vector.sources.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <strong>منابع:</strong> {vector.sources.slice(0, 3).join('، ')}
                          {vector.sources.length > 3 && ` و ${vector.sources.length - 3} مورد دیگر`}
                        </div>
                      )}
                      {vector.targets && vector.targets.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <strong>اهداف:</strong> {vector.targets.slice(0, 3).join('، ')}
                          {vector.targets.length > 3 && ` و ${vector.targets.length - 3} مورد دیگر`}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 6: Narratives History */}
        <TabsContent value="narratives" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : aggregatedNarratives.length === 0 ? (
            <EmptyState message="هیچ روایتی یافت نشد" />
          ) : (
            <>
              {/* Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>توزیع روایت‌ها</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={aggregatedNarratives.slice(0, 10).map((n) => ({
                          name: n.narrative_persian,
                          value: n.usage_count,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {aggregatedNarratives.slice(0, 10).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ direction: 'rtl' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Narratives List */}
              <div className="space-y-4">
                {aggregatedNarratives.map((narrative, idx) => (
                  <Card key={idx}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{narrative.narrative_persian}</span>
                        <Badge variant="secondary">{narrative.category}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">تعداد استفاده:</span>{' '}
                          {narrative.usage_count}
                        </div>
                        <div>
                          <span className="text-muted-foreground">امتیاز تأثیر:</span>{' '}
                          {narrative.impact_score.toFixed(1)}/10
                        </div>
                        <div>
                          <span className="text-muted-foreground">تخمین دسترسی:</span>{' '}
                          {narrative.reach_estimate?.toLocaleString()}
                        </div>
                      </div>
                      {narrative.evolution_notes && (
                        <div className="p-3 rounded bg-muted text-sm">
                          <strong>یادداشت‌های تحول:</strong> {narrative.evolution_notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 7: Risky Sources */}
        <TabsContent value="risky-sources" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : highRiskSources.length === 0 ? (
            <EmptyState message="هیچ منبع پرخطری یافت نشد" />
          ) : (
            <>
              {/* Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کل منابع پرخطر
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{highRiskSources.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کل مطالب
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {highRiskSources.reduce((sum, s) => sum + (s.total_posts || 0), 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کل عملیات روانی
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">
                      {highRiskSources.reduce((sum, s) => sum + (s.psyop_count || 0), 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      میانگین نرخ PsyOp
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      {highRiskSources.length > 0
                        ? (
                            (highRiskSources.reduce((sum, s) => sum + (s.psyop_rate || 0), 0) /
                              highRiskSources.length) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* High Risk Sources Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    منابع با نرخ بالای عملیات روانی
                  </CardTitle>
                  <CardDescription>
                    20 منبع برتر با بالاترین نرخ عملیات روانی (مرتب شده بر اساس درصد PsyOp)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {highRiskSources.map((source, index) => (
                      <div
                        key={`${source.source}-${index}`}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getRiskLevelEmoji(source.risk_level)}</span>
                            <div>
                              <div className="font-semibold text-lg">{source.source}</div>
                              <div className="text-xs text-muted-foreground">
                                سطح خطر: {source.risk_level}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">نرخ PsyOp</div>
                            <div className="text-2xl font-bold text-red-600">
                              {(source.psyop_rate * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">عملیات روانی</div>
                            <div className="text-xl font-bold text-orange-600">
                              {source.psyop_count}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">کل مطالب</div>
                            <div className="text-xl font-bold">{source.total_posts}</div>
                          </div>
                          <div className="text-center min-w-[80px]">
                            <div className="text-xs text-muted-foreground">بحرانی</div>
                            <div className="text-xl font-bold text-red-700">{source.critical}</div>
                          </div>
                          <div className="text-center min-w-[80px]">
                            <div className="text-xs text-muted-foreground">تهدید بالا</div>
                            <div className="text-xl font-bold text-orange-700">{source.high}</div>
                          </div>
                          <div className="text-center min-w-[120px]">
                            <div className="text-xs text-muted-foreground">آخرین پست</div>
                            <div className="text-sm font-medium">
                              {source.last_post ? formatPersianDate(source.last_post) : 'نامشخص'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* PsyOp Rate Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>توزیع نرخ عملیات روانی</CardTitle>
                  <CardDescription>مقایسه نرخ PsyOp منابع مختلف</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={highRiskSources.slice(0, 15)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="source" type="category" width={150} />
                      <Tooltip
                        contentStyle={{ direction: 'rtl' }}
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                      />
                      <Bar
                        dataKey={(d) => (d.psyop_rate * 100).toFixed(1)}
                        fill={COLORS.critical}
                        name="نرخ PsyOp (%)"
                      >
                        {highRiskSources.slice(0, 15).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.psyop_rate > 0.7 ? COLORS.critical : COLORS.high}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab 8: Risky Channels */}
        <TabsContent value="risky-channels" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : highRiskChannels.length === 0 ? (
            <EmptyState message="هیچ کانال پرخطری یافت نشد" />
          ) : (
            <>
              {/* Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کل کانال‌های پرخطر
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{highRiskChannels.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کل مطالب
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {highRiskChannels.reduce((sum, c) => sum + (c.total_posts || 0), 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کل عملیات روانی
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">
                      {highRiskChannels.reduce((sum, c) => sum + (c.psyop_count || 0), 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      میانگین نرخ PsyOp
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      {highRiskChannels.length > 0
                        ? (
                            (highRiskChannels.reduce((sum, c) => sum + (c.psyop_rate || 0), 0) /
                              highRiskChannels.length) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* High Risk Channels Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-red-600" />
                    کانال‌های پرخطر (Facebook, Telegram, YouTube)
                  </CardTitle>
                  <CardDescription>
                    کانال‌های شبکه‌های اجتماعی با بالاترین نرخ عملیات روانی (مرتب شده بر اساس درصد PsyOp)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {highRiskChannels.map((channel, index) => (
                      <div
                        key={`${channel.channel_name}-${index}`}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getRiskLevelEmoji(channel.risk_level)}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-lg">{channel.channel_name}</div>
                                <Badge
                                  className={cn(
                                    channel.platform === 'Facebook' && 'bg-blue-600 text-white',
                                    channel.platform === 'Telegram' && 'bg-cyan-600 text-white',
                                    channel.platform === 'YouTube' && 'bg-red-600 text-white',
                                    channel.platform === 'Other' && 'bg-gray-600 text-white'
                                  )}
                                >
                                  {channel.platform}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                سطح خطر: {channel.risk_level}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">نرخ PsyOp</div>
                            <div className="text-2xl font-bold text-red-600">
                              {(channel.psyop_rate * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">عملیات روانی</div>
                            <div className="text-xl font-bold text-orange-600">
                              {channel.psyop_count}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">کل مطالب</div>
                            <div className="text-xl font-bold">{channel.total_posts}</div>
                          </div>
                          <div className="text-center min-w-[80px]">
                            <div className="text-xs text-muted-foreground">بحرانی</div>
                            <div className="text-xl font-bold text-red-700">{channel.critical}</div>
                          </div>
                          <div className="text-center min-w-[80px]">
                            <div className="text-xs text-muted-foreground">تهدید بالا</div>
                            <div className="text-xl font-bold text-orange-700">{channel.high}</div>
                          </div>
                          <div className="text-center min-w-[120px]">
                            <div className="text-xs text-muted-foreground">آخرین پست</div>
                            <div className="text-sm font-medium">
                              {channel.last_post ? formatPersianDate(channel.last_post) : 'نامشخص'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* PsyOp Rate Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>توزیع نرخ عملیات روانی کانال‌ها</CardTitle>
                  <CardDescription>مقایسه نرخ PsyOp کانال‌های مختلف</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={highRiskChannels.slice(0, 15)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="channel_name" type="category" width={150} />
                      <Tooltip
                        contentStyle={{ direction: 'rtl' }}
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                      />
                      <Bar
                        dataKey={(d) => (d.psyop_rate * 100).toFixed(1)}
                        fill={COLORS.critical}
                        name="نرخ PsyOp (%)"
                      >
                        {highRiskChannels.slice(0, 15).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.platform === 'Facebook'
                                ? '#3b5998'
                                : entry.platform === 'Telegram'
                                ? '#0088cc'
                                : entry.platform === 'YouTube'
                                ? '#FF0000'
                                : COLORS.critical
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab 9: Monthly Reports */}
        <TabsContent value="monthly-reports" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : monthlyStats.length === 0 ? (
            <EmptyState message="هیچ گزارش ماهانه‌ای یافت نشد" />
          ) : (
            <>
              {/* Monthly Comparison Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>مقایسه ماهانه</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip contentStyle={{ direction: 'rtl' }} />
                      <Legend />
                      <Bar dataKey="totalPosts" fill={COLORS.primary} name="کل پست‌ها" />
                      <Bar dataKey="psyopPosts" fill={COLORS.critical} name="PsyOps" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monthly Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {monthlyStats.slice(0, 12).map((stat) => (
                  <Card key={stat.month}>
                    <CardHeader>
                      <CardTitle className="text-lg">{stat.month}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">کل پست‌ها:</span>
                        <span className="font-bold">{stat.totalPosts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">PsyOps:</span>
                        <span className="font-bold text-red-600">{stat.psyopPosts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">نرخ PsyOp:</span>
                        <span className="font-bold">
                          {stat.totalPosts > 0
                            ? ((stat.psyopPosts / stat.totalPosts) * 100).toFixed(1)
                            : 0}
                          %
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 10: Overall Statistics */}
        <TabsContent value="overall-stats" className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      کل پست‌های آرشیو
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold">{significantPosts.length}</div>
                    <p className="text-xs text-muted-foreground mt-2">
                      در {dailyDigests.length} روز
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Network className="w-4 h-4" />
                      کمپین‌های شناسایی شده
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold">{campaigns.length}</div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {campaigns.filter((c) => c.status === 'Active').length} فعال
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      اهداف تحت حمله
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold">{targetHistory.length}</div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {targetHistory.filter((t) => t.target_type === 'Person').length} فرد
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Megaphone className="w-4 h-4" />
                      روایت‌های فعال
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold">{narratives.length}</div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {attackVectors.length} بردار حمله
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Trend Indicators */}
              <Card>
                <CardHeader>
                  <CardTitle>شاخص‌های روند</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 rounded-lg bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">تهدیدات بحرانی</h3>
                        <Flame className="w-6 h-6 text-red-600" />
                      </div>
                      <div className="text-4xl font-bold text-red-600 mb-2">
                        {significantPosts.filter((p) => p.threat_level === 'Critical').length}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4" />
                        <span>روند صعودی</span>
                      </div>
                    </div>

                    <div className="p-6 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">نرخ شناسایی</h3>
                        <Eye className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="text-4xl font-bold text-blue-600 mb-2">
                        {monthlyStats.length > 0 &&
                        monthlyStats[monthlyStats.length - 1].totalPosts > 0
                          ? (
                              (monthlyStats[monthlyStats.length - 1].psyopPosts /
                                monthlyStats[monthlyStats.length - 1].totalPosts) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Activity className="w-4 h-4" />
                        <span>ماه جاری</span>
                      </div>
                    </div>

                    <div className="p-6 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">پوشش منابع</h3>
                        <Radio className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="text-4xl font-bold text-green-600 mb-2">
                        {
                          new Set(sourceTimelines.map((s) => s.source_name)).size
                        }
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4" />
                        <span>منابع فعال</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OperationsHistory;
