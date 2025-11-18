import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { 
  Database, 
  Trash2, 
  Archive, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';
import { formatDistanceToNowIran } from '@/lib/dateUtils';

interface DataStats {
  total_posts: number;
  new_posts: number;
  analyzed_posts: number;
  archived_posts: number;
  psyop_count: number;
  non_psyop_count: number;
  high_critical_count: number;
  low_medium_count: number;
  deletable_posts: number;
  old_posts: number;
  posts_24h_ago: number;
  posts_7d_ago: number;
}

interface CleanupHistory {
  id: string;
  executed_at: string;
  posts_deleted: number;
  posts_archived: number;
  success: boolean;
}

const DataManagement = () => {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [cleanupHistory, setCleanupHistory] = useState<CleanupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      // 🔥 فقط اگه صفحه visible باشه
      if (!document.hidden) {
        loadData();
      } else {
        console.log('[DataManagement] ⏸️ Skipping refresh - page hidden');
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadStats(),
        loadCleanupHistory(),
        loadLastCleanup()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'خطا در بارگذاری داده‌ها',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      // 🔥 Use Promise.allSettled instead of Promise.all
      // This ensures loading state will be set to false even if some queries fail
      const results = await Promise.allSettled([
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'New'),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'Analyzed'),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'Archived'),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_psyop', true),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_psyop', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }).in('threat_level', ['High', 'Critical']),
        supabase.from('posts').select('*', { count: 'exact', head: true }).in('threat_level', ['Low', 'Medium']),
        // ✅ استفاده از published_at به جای created_at
        supabase.from('posts').select('*', { count: 'exact', head: true }).lt('published_at', cutoff24h),
        supabase.from('posts').select('*', { count: 'exact', head: true })
          .lt('published_at', cutoff24h)
          .neq('status', 'Archived')
          .in('threat_level', ['Low', 'Medium'])
          .eq('is_psyop', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }).gt('published_at', cutoff24h),
        supabase.from('posts').select('*', { count: 'exact', head: true }).gt('published_at', cutoff7d),
      ]);

      // 🔥 Extract counts safely
      const getCount = (index: number) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          return result.value?.count || 0;
        }
        console.warn(`Query ${index} failed:`, result.reason);
        return 0;
      };

      setStats({
        total_posts: getCount(0),
        new_posts: getCount(1),
        analyzed_posts: getCount(2),
        archived_posts: getCount(3),
        psyop_count: getCount(4),
        non_psyop_count: getCount(5),
        high_critical_count: getCount(6),
        low_medium_count: getCount(7),
        old_posts: getCount(8),
        deletable_posts: getCount(9),
        posts_24h_ago: getCount(10),
        posts_7d_ago: getCount(11),
      });
    } catch (error) {
      console.error('[DataManagement] Error:', error);
      // Set zeros on complete failure
      setStats({
        total_posts: 0,
        new_posts: 0,
        analyzed_posts: 0,
        archived_posts: 0,
        psyop_count: 0,
        non_psyop_count: 0,
        high_critical_count: 0,
        low_medium_count: 0,
        old_posts: 0,
        deletable_posts: 0,
        posts_24h_ago: 0,
        posts_7d_ago: 0,
      });
    }
  };

  const loadCleanupHistory = async () => {
    const { data } = await supabase
      .from('cleanup_history')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(10);

    if (data) setCleanupHistory(data);
  };

  const loadLastCleanup = async () => {
    const { data } = await supabase
      .from('cleanup_history')
      .select('executed_at')
      .order('executed_at', { ascending: false })
      .limit(1)
      .single();

    if (data) setLastCleanup(data.executed_at);
  };

  const runCleanup = async () => {
    setCleanupRunning(true);
    
    try {
      toast({
        title: '🧹 شروع پاکسازی خودکار',
        description: 'در حال حذف و آرشیو پست‌ها...'
      });

      const { data, error } = await supabase.functions.invoke('auto-cleanup', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: '✅ پاکسازی کامل شد',
        description: `${data.posts_deleted} پست حذف شد، ${data.posts_archived} پست آرشیو شد`,
      });

      // Reload data
      await loadData();

    } catch (error) {
      console.error('Cleanup error:', error);
      toast({
        title: '❌ خطا در پاکسازی',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setCleanupRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Prepare chart data
  const statusData = [
    { name: 'جدید', value: stats.new_posts, color: '#3b82f6' },
    { name: 'تحلیل شده', value: stats.analyzed_posts, color: '#10b981' },
    { name: 'آرشیو شده', value: stats.archived_posts, color: '#f59e0b' },
  ];

  const psyopData = [
    { name: 'جنگ روانی', value: stats.psyop_count, color: '#ef4444' },
    { name: 'معمولی', value: stats.non_psyop_count, color: '#10b981' },
  ];

  const threatData = [
    { name: 'High/Critical', value: stats.high_critical_count, color: '#dc2626' },
    { name: 'Low/Medium', value: stats.low_medium_count, color: '#3b82f6' },
  ];

  const ageData = [
    { name: '< 24 ساعت', value: stats.posts_24h_ago, color: '#10b981' },
    { name: '> 24 ساعت', value: stats.old_posts, color: '#f59e0b' },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="w-8 h-8" />
            مدیریت داده‌ها و پاکسازی
          </h1>
          <p className="text-muted-foreground mt-1">
            مانیتورینگ و مدیریت کامل پست‌های سیستم
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {lastCleanup && (
            <div className="text-sm text-muted-foreground">
              آخرین پاکسازی: {formatDistanceToNowIran(new Date(lastCleanup))}
            </div>
          )}
          <Button 
            onClick={loadData} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            بروزرسانی
          </Button>
          <Button 
            onClick={runCleanup} 
            disabled={cleanupRunning}
            className="gap-2"
          >
            {cleanupRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            اجرای پاکسازی
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              کل پست‌ها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_posts.toLocaleString('fa')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.posts_7d_ago.toLocaleString('fa')} پست در 7 روز اخیر
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Archive className="w-4 h-4 text-orange-500" />
              آرشیو شده
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.archived_posts.toLocaleString('fa')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((stats.archived_posts / stats.total_posts) * 100).toFixed(1)}% از کل
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              قدیمی‌تر از 24 ساعت
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.old_posts.toLocaleString('fa')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.deletable_posts.toLocaleString('fa')} قابل حذف
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              آماده حذف
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {stats.deletable_posts.toLocaleString('fa')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              پست‌های Low/Medium غیر PsyOp
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              توزیع بر اساس وضعیت
            </CardTitle>
            <CardDescription>
              توزیع پست‌ها بر اساس status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString('fa')}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* PsyOp Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              توزیع جنگ روانی
            </CardTitle>
            <CardDescription>
              نسبت پست‌های PsyOp به معمولی
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={psyopData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {psyopData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString('fa')}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Threat Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              توزیع سطح تهدید
            </CardTitle>
            <CardDescription>
              نسبت تهدیدات بالا به پایین
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={threatData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString('fa')}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {threatData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              توزیع بر اساس سن
            </CardTitle>
            <CardDescription>
              پست‌های جدید vs قدیمی
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString('fa')}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {ageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cleanup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            تاریخچه پاکسازی
          </CardTitle>
          <CardDescription>
            آخرین عملیات پاکسازی خودکار
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cleanupHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              هنوز هیچ عملیات پاکسازی انجام نشده است
            </div>
          ) : (
            <div className="space-y-2">
              {cleanupHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {item.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium">
                        {formatDistanceToNowIran(new Date(item.executed_at))}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(item.executed_at).toLocaleString('fa-IR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="destructive" className="gap-1">
                      <Trash2 className="w-3 h-3" />
                      {item.posts_deleted.toLocaleString('fa')} حذف
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Archive className="w-3 h-3" />
                      {item.posts_archived.toLocaleString('fa')} آرشیو
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📦 استراتژی آرشیو</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>• پست‌های High/Critical آرشیو می‌شوند</p>
            <p>• پست‌های PsyOp نگه‌داری می‌شوند</p>
            <p>• مدت: 24 ساعت از زمان انتشار خبر</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🗑️ استراتژی حذف</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>• پست‌های Low/Medium حذف می‌شوند</p>
            <p>• فقط پست‌های غیر PsyOp</p>
            <p>• بعد از 24 ساعت از انتشار اصلی</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">✅ نکته مهم</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>• محاسبه بر اساس published_at</p>
            <p>• نه created_at (زمان ایمپورت)</p>
            <p>• خبرهای قدیمی سریع‌تر حذف می‌شوند</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataManagement;
