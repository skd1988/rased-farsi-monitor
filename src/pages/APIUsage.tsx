import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, DollarSign, Zap, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNowIran } from '@/lib/dateUtils';
import InoreaderAPIUsageTab from '@/components/api-usage/InoreaderAPIUsageTab';

interface UsageLog {
  id: string;
  created_at: string;
  post_id: string;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  response_time_ms: number;
  status: string;
  error_message?: string;
}

interface UsageStats {
  totalTokensToday: number;
  totalCallsMonth: number;
  totalCostMonth: number;
  avgResponseTime: number;
  yesterdayTokens: number;
}

const APIUsage = () => {
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [stats, setStats] = useState<UsageStats>({
    totalTokensToday: 0,
    totalCallsMonth: 0,
    totalCostMonth: 0,
    avgResponseTime: 0,
    yesterdayTokens: 0,
  });
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      setLoading(true);

      // Fetch all usage logs from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsageLogs(logs || []);

      // Calculate statistics
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayLogs = logs?.filter(log => new Date(log.created_at) >= today) || [];
      const yesterdayLogs = logs?.filter(log => {
        const date = new Date(log.created_at);
        return date >= yesterday && date < today;
      }) || [];
      const monthLogs = logs?.filter(log => new Date(log.created_at) >= monthStart) || [];

      const totalTokensToday = todayLogs.reduce((sum, log) => sum + log.total_tokens, 0);
      const yesterdayTokens = yesterdayLogs.reduce((sum, log) => sum + log.total_tokens, 0);
      const totalCostMonth = monthLogs.reduce((sum, log) => sum + Number(log.cost_usd), 0);
      const avgResponseTime = monthLogs.length > 0
        ? monthLogs.reduce((sum, log) => sum + log.response_time_ms, 0) / monthLogs.length
        : 0;

      setStats({
        totalTokensToday,
        totalCallsMonth: monthLogs.length,
        totalCostMonth,
        avgResponseTime,
        yesterdayTokens,
      });
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const getChartData = () => {
    const days = chartPeriod === 'week' ? 7 : 30;
    const data: { date: string; tokens: number; cost: number; calls: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });

      const dayLogs = usageLogs.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate.toDateString() === date.toDateString();
      });

      data.push({
        date: dateStr,
        tokens: dayLogs.reduce((sum, log) => sum + log.total_tokens, 0),
        cost: dayLogs.reduce((sum, log) => sum + Number(log.cost_usd), 0),
        calls: dayLogs.length,
      });
    }

    return data;
  };

  // Token distribution data
  const getTokenDistribution = () => {
    const totalInput = usageLogs.reduce((sum, log) => sum + log.input_tokens, 0);
    const totalOutput = usageLogs.reduce((sum, log) => sum + log.output_tokens, 0);

    return [
      { name: 'توکن‌های ورودی', value: totalInput, color: '#3b82f6' },
      { name: 'توکن‌های خروجی', value: totalOutput, color: '#10b981' },
    ];
  };

  const chartData = getChartData();
  const tokenDistribution = getTokenDistribution();
  const percentageChange = stats.yesterdayTokens > 0
    ? ((stats.totalTokensToday - stats.yesterdayTokens) / stats.yesterdayTokens) * 100
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">مصرف API</h1>
        <p className="text-muted-foreground">
          رصد مصرف و هزینه‌های APIهای هوش مصنوعی و Inoreader
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="deepseek" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="deepseek">DeepSeek API</TabsTrigger>
          <TabsTrigger value="inoreader">Inoreader API</TabsTrigger>
        </TabsList>

        <TabsContent value="deepseek" className="space-y-6 mt-6">
          {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">توکن‌های امروز</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTokensToday.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {percentageChange > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 ml-1 text-success" />
                  <span className="text-success">+{percentageChange.toFixed(1)}%</span>
                </>
              ) : percentageChange < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 ml-1 text-destructive" />
                  <span className="text-destructive">{percentageChange.toFixed(1)}%</span>
                </>
              ) : (
                <span>بدون تغییر</span>
              )}
              <span className="mr-1">نسبت به دیروز</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">درخواست‌های ماه</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCallsMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">تعداد کل تحلیل‌ها</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">هزینه ماه</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCostMonth.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">
              میانگین: ${stats.totalCallsMonth > 0 ? (stats.totalCostMonth / stats.totalCallsMonth).toFixed(6) : '0'} / تحلیل
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">زمان پاسخ میانگین</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.avgResponseTime)}ms</div>
            <p className="text-xs text-muted-foreground">سرعت API</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Line Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>مصرف در طول زمان</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={chartPeriod === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartPeriod('week')}
                >
                  هفته
                </Button>
                <Button
                  variant={chartPeriod === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartPeriod('month')}
                >
                  ماه
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="tokens"
                    stroke="#3b82f6"
                    name="توکن‌ها"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>توزیع توکن‌ها</CardTitle>
            <CardDescription>نسبت توکن‌های ورودی و خروجی</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tokenDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {tokenDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Info */}
      <Card>
        <CardHeader>
          <CardTitle>اطلاعات قیمت‌گذاری DeepSeek</CardTitle>
          <CardDescription>قیمت‌های فعلی API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span>توکن‌های ورودی:</span>
            <span className="font-mono">$0.14 / 1M توکن</span>
          </div>
          <div className="flex justify-between items-center">
            <span>توکن‌های خروجی:</span>
            <span className="font-mono">$0.28 / 1M توکن</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-semibold">تخمین هزینه ماهانه:</span>
            <span className="font-mono font-semibold">
              ${(stats.totalCostMonth * 30 / new Date().getDate()).toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Usage Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>آخرین درخواست‌های API</CardTitle>
              <CardDescription>50 تحلیل اخیر</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              خروجی CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">زمان</TableHead>
                  <TableHead className="text-right">مدل</TableHead>
                  <TableHead className="text-right">توکن ورودی</TableHead>
                  <TableHead className="text-right">توکن خروجی</TableHead>
                  <TableHead className="text-right">مجموع</TableHead>
                  <TableHead className="text-right">هزینه</TableHead>
                  <TableHead className="text-right">زمان پاسخ</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageLogs.slice(0, 50).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-right">
                      {formatDistanceToNowIran(log.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <code className="text-xs">{log.model_used}</code>
                    </TableCell>
                    <TableCell className="text-right">{log.input_tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{log.output_tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      {log.total_tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${Number(log.cost_usd).toFixed(6)}
                    </TableCell>
                    <TableCell className="text-right">{log.response_time_ms}ms</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status === 'success' ? 'موفق' : 'خطا'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="inoreader" className="space-y-6 mt-6">
          <InoreaderAPIUsageTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default APIUsage;
