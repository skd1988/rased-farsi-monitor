// src/pages/PerformanceDashboard.tsx
// Main Performance Monitoring Dashboard

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Zap, Clock, Activity, AlertTriangle, TrendingUp,
  RefreshCw, Download, Info, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  PerformanceMetric,
  PerformanceSummary,
  WebVitalsData,
  PagePerformance,
  PerformanceRecommendation,
  getRating,
  getMetricLabel,
  getMetricUnit,
  calculateOverallScore,
  getHealthStatus,
  formatBytes,
  WEB_VITALS_THRESHOLDS
} from '@/types/performance';
import { getCurrentMetrics } from '@/utils/performanceMonitor';

const PerformanceDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<Partial<PerformanceMetric>>({});
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Fetch historical metrics from Supabase
  const fetchMetrics = async () => {
    try {
      const rangeMap = {
        '1h': 1,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30
      };

      const hoursAgo = rangeMap[timeRange];
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMetrics(data || []);
      console.log(`[Performance Dashboard] Loaded ${data?.length || 0} metrics`);
    } catch (error: any) {
      console.error('[Performance Dashboard] Error:', error);
      toast({
        title: 'خطا در بارگذاری داده‌ها',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Get current page metrics
    const current = getCurrentMetrics();
    setCurrentMetrics(current);
  }, [timeRange]);

  // Calculate summary statistics
  const summary: PerformanceSummary = useMemo(() => {
    if (metrics.length === 0) {
      return {
        overall_score: 0,
        total_pages_measured: 0,
        avg_page_load: 0,
        avg_fcp: 0,
        avg_lcp: 0,
        avg_cls: 0,
        avg_fid: 0,
        avg_ttfb: 0,
        health_status: 'poor',
        critical_issues: 0,
        warnings: 0
      };
    }

    const validMetrics = metrics.filter(m => m.fcp && m.lcp);
    const count = validMetrics.length;

    const avgFcp = validMetrics.reduce((sum, m) => sum + (m.fcp || 0), 0) / count;
    const avgLcp = validMetrics.reduce((sum, m) => sum + (m.lcp || 0), 0) / count;
    const avgCls = validMetrics.reduce((sum, m) => sum + (m.cls || 0), 0) / count;
    const avgFid = validMetrics.reduce((sum, m) => sum + (m.fid || 0), 0) / count;
    const avgTtfb = validMetrics.reduce((sum, m) => sum + (m.ttfb || 0), 0) / count;
    const avgLoad = validMetrics.reduce((sum, m) => sum + (m.page_load_time || 0), 0) / count;

    // Calculate score based on averages
    const score = calculateOverallScore({
      fcp: avgFcp,
      lcp: avgLcp,
      cls: avgCls,
      fid: avgFid,
      ttfb: avgTtfb
    });

    // Count issues
    let critical = 0;
    let warnings = 0;

    validMetrics.forEach(m => {
      if (m.lcp && m.lcp > WEB_VITALS_THRESHOLDS.LCP.needsImprovement) critical++;
      if (m.fcp && m.fcp > WEB_VITALS_THRESHOLDS.FCP.needsImprovement) warnings++;
      if (m.cls && m.cls > WEB_VITALS_THRESHOLDS.CLS.needsImprovement) warnings++;
    });

    return {
      overall_score: Math.round(score),
      total_pages_measured: new Set(metrics.map(m => m.page_path)).size,
      avg_page_load: Math.round(avgLoad),
      avg_fcp: Math.round(avgFcp),
      avg_lcp: Math.round(avgLcp),
      avg_cls: Number(avgCls.toFixed(3)),
      avg_fid: Math.round(avgFid),
      avg_ttfb: Math.round(avgTtfb),
      health_status: getHealthStatus(score),
      critical_issues: critical,
      warnings
    };
  }, [metrics]);

  // Current page Web Vitals
  const currentWebVitals: WebVitalsData[] = useMemo(() => {
    const vitals: WebVitalsData[] = [];

    if (currentMetrics.fcp) {
      vitals.push({
        name: 'FCP',
        value: Math.round(currentMetrics.fcp),
        rating: getRating('FCP', currentMetrics.fcp),
        unit: 'ms',
        label: 'اولین نمایش محتوا'
      });
    }

    if (currentMetrics.lcp) {
      vitals.push({
        name: 'LCP',
        value: Math.round(currentMetrics.lcp),
        rating: getRating('LCP', currentMetrics.lcp),
        unit: 'ms',
        label: 'بزرگترین نمایش محتوا'
      });
    }

    if (currentMetrics.cls !== undefined) {
      vitals.push({
        name: 'CLS',
        value: Number(currentMetrics.cls.toFixed(3)),
        rating: getRating('CLS', currentMetrics.cls),
        unit: 'score',
        label: 'تغییر جابجایی بصری'
      });
    }

    if (currentMetrics.fid) {
      vitals.push({
        name: 'FID',
        value: Math.round(currentMetrics.fid),
        rating: getRating('FID', currentMetrics.fid),
        unit: 'ms',
        label: 'تاخیر اولین تعامل'
      });
    }

    if (currentMetrics.ttfb) {
      vitals.push({
        name: 'TTFB',
        value: Math.round(currentMetrics.ttfb),
        rating: getRating('TTFB', currentMetrics.ttfb),
        unit: 'ms',
        label: 'زمان پاسخ سرور'
      });
    }

    return vitals;
  }, [currentMetrics]);

  // Page performance breakdown
  const pagePerformance: PagePerformance[] = useMemo(() => {
    const pageMap = new Map<string, {
      totalLoad: number;
      totalLcp: number;
      totalFcp: number;
      count: number;
      issues: Set<string>;
    }>();

    metrics.forEach(m => {
      if (!pageMap.has(m.page_path)) {
        pageMap.set(m.page_path, {
          totalLoad: 0,
          totalLcp: 0,
          totalFcp: 0,
          count: 0,
          issues: new Set()
        });
      }

      const page = pageMap.get(m.page_path)!;
      page.count++;

      if (m.page_load_time) page.totalLoad += m.page_load_time;
      if (m.lcp) {
        page.totalLcp += m.lcp;
        if (m.lcp > WEB_VITALS_THRESHOLDS.LCP.needsImprovement) {
          page.issues.add('LCP کند');
        }
      }
      if (m.fcp) {
        page.totalFcp += m.fcp;
        if (m.fcp > WEB_VITALS_THRESHOLDS.FCP.needsImprovement) {
          page.issues.add('FCP کند');
        }
      }
      if (m.cls && m.cls > WEB_VITALS_THRESHOLDS.CLS.needsImprovement) {
        page.issues.add('CLS بالا');
      }
    });

    return Array.from(pageMap.entries())
      .map(([path, data]) => ({
        path,
        title: path === '/' ? 'صفحه اصلی' : path.replace(/^\//, '').replace(/-/g, ' '),
        avgLoadTime: Math.round(data.totalLoad / data.count),
        avgLCP: Math.round(data.totalLcp / data.count),
        avgFCP: Math.round(data.totalFcp / data.count),
        visits: data.count,
        issues: Array.from(data.issues)
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
  }, [metrics]);

  // Trend data (last 7 days)
  const trendData = useMemo(() => {
    const dayMap = new Map<string, {
      load: number[];
      fcp: number[];
      lcp: number[];
    }>();

    metrics.forEach(m => {
      const day = new Date(m.created_at).toLocaleDateString('fa-IR', {
        month: 'short',
        day: 'numeric'
      });

      if (!dayMap.has(day)) {
        dayMap.set(day, { load: [], fcp: [], lcp: [] });
      }

      const dayData = dayMap.get(day)!;
      if (m.page_load_time) dayData.load.push(m.page_load_time);
      if (m.fcp) dayData.fcp.push(m.fcp);
      if (m.lcp) dayData.lcp.push(m.lcp);
    });

    return Array.from(dayMap.entries()).map(([day, data]) => ({
      day,
      avgLoad: data.load.length > 0
        ? Math.round(data.load.reduce((a, b) => a + b, 0) / data.load.length)
        : 0,
      avgFcp: data.fcp.length > 0
        ? Math.round(data.fcp.reduce((a, b) => a + b, 0) / data.fcp.length)
        : 0,
      avgLcp: data.lcp.length > 0
        ? Math.round(data.lcp.reduce((a, b) => a + b, 0) / data.lcp.length)
        : 0
    })).reverse().slice(0, 7);
  }, [metrics]);

  // Resource breakdown
  const resourceData = useMemo(() => {
    if (metrics.length === 0) return [];

    const latest = metrics[0];
    if (!latest) return [];

    return [
      { name: 'JavaScript', value: latest.js_count || 0, fill: '#3b82f6' },
      { name: 'CSS', value: latest.css_count || 0, fill: '#8b5cf6' },
      { name: 'تصاویر', value: latest.image_count || 0, fill: '#ec4899' },
      { name: 'فونت‌ها', value: latest.font_count || 0, fill: '#f59e0b' }
    ].filter(item => item.value > 0);
  }, [metrics]);

  // Generate recommendations
  const recommendations: PerformanceRecommendation[] = useMemo(() => {
    const recs: PerformanceRecommendation[] = [];

    if (summary.avg_lcp > WEB_VITALS_THRESHOLDS.LCP.needsImprovement) {
      recs.push({
        severity: 'critical',
        title: 'LCP بیش از حد کند',
        description: `میانگین LCP شما ${summary.avg_lcp}ms است. استفاده از lazy loading برای تصاویر و بهینه‌سازی فونت‌ها توصیه می‌شود.`,
        impact: 'high',
        category: 'loading'
      });
    }

    if (summary.avg_cls > WEB_VITALS_THRESHOLDS.CLS.needsImprovement) {
      recs.push({
        severity: 'warning',
        title: 'CLS بالا - ناپایداری بصری',
        description: 'تغییرات جابجایی بصری زیاد است. از ابعاد مشخص برای تصاویر و iframe ها استفاده کنید.',
        impact: 'medium',
        category: 'visual-stability'
      });
    }

    const latest = metrics[0];
    if (latest && latest.total_resources && latest.total_resources > 50) {
      recs.push({
        severity: 'warning',
        title: 'تعداد درخواست‌های زیاد',
        description: `${latest.total_resources} درخواست در هر بارگذاری. استفاده از bundling و minification پیشنهاد می‌شود.`,
        impact: 'medium',
        category: 'resources'
      });
    }

    if (latest && latest.total_size && latest.total_size > 3 * 1024 * 1024) {
      recs.push({
        severity: 'critical',
        title: 'حجم صفحه بیش از حد',
        description: `حجم کل ${formatBytes(latest.total_size)}. فشرده‌سازی و استفاده از CDN توصیه می‌شود.`,
        impact: 'high',
        category: 'resources'
      });
    }

    if (summary.avg_ttfb > WEB_VITALS_THRESHOLDS.TTFB.needsImprovement) {
      recs.push({
        severity: 'warning',
        title: 'زمان پاسخ سرور بالا',
        description: 'پاسخ سرور کند است. بررسی کش سرور و بهینه‌سازی query های دیتابیس را در نظر بگیرید.',
        impact: 'high',
        category: 'network'
      });
    }

    return recs;
  }, [summary, metrics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMetrics();
    toast({
      title: '✅ بروزرسانی شد',
      description: 'داده‌ها با موفقیت بروزرسانی شدند'
    });
  };

  const handleExport = () => {
    const csv = [
      ['تاریخ', 'صفحه', 'FCP', 'LCP', 'CLS', 'FID', 'TTFB', 'زمان بارگذاری'].join(','),
      ...metrics.map(m => [
        new Date(m.created_at).toLocaleString('fa-IR'),
        m.page_path,
        m.fcp || '',
        m.lcp || '',
        m.cls || '',
        m.fid || '',
        m.ttfb || '',
        m.page_load_time || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-metrics-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: '✅ فایل ذخیره شد',
      description: 'گزارش CSV با موفقیت دانلود شد'
    });
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600 dark:text-green-400';
      case 'needs-improvement': return 'text-yellow-600 dark:text-yellow-400';
      case 'poor': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600';
    }
  };

  const getRatingBg = (rating: string) => {
    switch (rating) {
      case 'good': return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'needs-improvement': return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'poor': return 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default: return 'bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'good': return <CheckCircle2 className="w-4 h-4" />;
      case 'needs-improvement': return <AlertCircle className="w-4 h-4" />;
      case 'poor': return <XCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">در حال بارگذاری معیارهای عملکرد...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="text-yellow-500" />
            داشبورد عملکرد
          </h1>
          <p className="text-muted-foreground mt-2">
            مانیتورینگ لحظه‌ای سرعت و عملکرد سیستم رصد فارسی
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {(['1h', '24h', '7d', '30d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="text-xs"
              >
                {range === '1h' ? 'ساعت اخیر' :
                 range === '24h' ? '24 ساعت' :
                 range === '7d' ? '7 روز' : '30 روز'}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ml-2 ${refreshing ? 'animate-spin' : ''}`} />
            بروزرسانی
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 ml-2" />
            خروجی CSV
          </Button>
        </div>
      </div>

      {/* Overall Score Card */}
      <Card className="mb-6 border-2">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">امتیاز کلی عملکرد</p>
              <div className="flex items-baseline gap-3">
                <span className={`text-5xl font-bold ${getHealthColor(summary.health_status)}`}>
                  {summary.overall_score}
                </span>
                <span className="text-2xl text-muted-foreground">/100</span>
              </div>
              <p className="text-sm mt-2">
                وضعیت:
                <Badge
                  variant="outline"
                  className={`mr-2 ${getHealthColor(summary.health_status)}`}
                >
                  {summary.health_status === 'excellent' ? 'عالی' :
                   summary.health_status === 'good' ? 'خوب' :
                   summary.health_status === 'needs-improvement' ? 'نیاز به بهبود' : 'ضعیف'}
                </Badge>
              </p>
            </div>

            <div className="text-left space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm">{summary.critical_issues} مشکل بحرانی</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm">{summary.warnings} هشدار</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-sm">{summary.total_pages_measured} صفحه بررسی شده</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              زمان بارگذاری میانگین
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(summary.avg_page_load / 1000).toFixed(2)}s
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              از شروع تا اتمام بارگذاری
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4" />
              FCP میانگین
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getRatingColor(getRating('FCP', summary.avg_fcp))}`}>
              {(summary.avg_fcp / 1000).toFixed(2)}s
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              اولین نمایش محتوا
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" />
              LCP میانگین
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getRatingColor(getRating('LCP', summary.avg_lcp))}`}>
              {(summary.avg_lcp / 1000).toFixed(2)}s
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              بزرگترین نمایش محتوا
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              CLS میانگین
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getRatingColor(getRating('CLS', summary.avg_cls))}`}>
              {summary.avg_cls.toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              تغییر جابجایی بصری
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Current Page Web Vitals */}
        <Card>
          <CardHeader>
            <CardTitle>Core Web Vitals - صفحه فعلی</CardTitle>
          </CardHeader>
          <CardContent>
            {currentWebVitals.length > 0 ? (
              <div className="space-y-4">
                {currentWebVitals.map((vital) => (
                  <div
                    key={vital.name}
                    className={`p-4 rounded-lg border-2 ${getRatingBg(vital.rating)}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className={getRatingColor(vital.rating)}>
                          {getRatingIcon(vital.rating)}
                        </span>
                        <span className="font-medium">{vital.label}</span>
                      </div>
                      <span className={`font-bold text-lg ${getRatingColor(vital.rating)}`}>
                        {vital.value}{vital.unit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          vital.rating === 'good' ? 'bg-green-600' :
                          vital.rating === 'needs-improvement' ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{
                          width: `${Math.min((vital.value / (vital.name === 'CLS' ? 0.25 : 4000)) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                در حال جمع‌آوری معیارها...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Resource Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>توزیع منابع</CardTitle>
          </CardHeader>
          <CardContent>
            {resourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={resourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {resourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                داده‌ای موجود نیست
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend */}
      {trendData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>روند عملکرد</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgLoad"
                  stroke="#3b82f6"
                  name="زمان بارگذاری (ms)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="avgFcp"
                  stroke="#10b981"
                  name="FCP (ms)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="avgLcp"
                  stroke="#f59e0b"
                  name="LCP (ms)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Page Performance Table */}
      {pagePerformance.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>عملکرد صفحات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3 font-semibold">صفحه</th>
                    <th className="text-center p-3 font-semibold">بازدید</th>
                    <th className="text-center p-3 font-semibold">زمان بارگذاری</th>
                    <th className="text-center p-3 font-semibold">FCP</th>
                    <th className="text-center p-3 font-semibold">LCP</th>
                    <th className="text-center p-3 font-semibold">مشکلات</th>
                  </tr>
                </thead>
                <tbody>
                  {pagePerformance.map((page, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{page.title}</div>
                          <div className="text-xs text-muted-foreground">{page.path}</div>
                        </div>
                      </td>
                      <td className="text-center p-3">{page.visits}</td>
                      <td className="text-center p-3">
                        <Badge variant="outline">
                          {(page.avgLoadTime / 1000).toFixed(2)}s
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        <Badge
                          variant="outline"
                          className={getRatingColor(getRating('FCP', page.avgFCP))}
                        >
                          {(page.avgFCP / 1000).toFixed(2)}s
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        <Badge
                          variant="outline"
                          className={getRatingColor(getRating('LCP', page.avgLCP))}
                        >
                          {(page.avgLCP / 1000).toFixed(2)}s
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        {page.issues.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {page.issues.map((issue, i) => (
                              <Badge key={i} variant="destructive" className="text-xs">
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle2 className="w-3 h-3 ml-1" />
                            خوب
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>توصیه‌های بهینه‌سازی</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-r-4 ${
                    rec.severity === 'critical'
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-600'
                      : rec.severity === 'warning'
                      ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-600'
                      : 'bg-blue-50 dark:bg-blue-900/10 border-blue-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${
                      rec.severity === 'critical' ? 'text-red-600' :
                      rec.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                    }`}>
                      {rec.severity === 'critical' ? <XCircle className="w-5 h-5" /> :
                       rec.severity === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                       <Info className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{rec.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          تأثیر: {rec.impact === 'high' ? 'بالا' : rec.impact === 'medium' ? 'متوسط' : 'کم'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rec.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PerformanceDashboard;
