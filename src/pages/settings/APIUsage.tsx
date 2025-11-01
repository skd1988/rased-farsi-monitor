import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, DollarSign, Zap, Download, RefreshCw, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface UsageLog {
  id: string;
  created_at: string;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  response_time_ms: number;
  status: string;
  error_message: string | null;
}

interface Stats {
  today: {
    requests: number;
    cost: number;
    trend: number;
  };
  week: {
    requests: number;
    cost: number;
    trend: number;
  };
  month: {
    requests: number;
    cost: number;
    trend: number;
  };
  avgCost: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

const APIUsage = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    today: { requests: 0, cost: 0, trend: 0 },
    week: { requests: 0, cost: 0, trend: 0 },
    month: { requests: 0, cost: 0, trend: 0 },
    avgCost: 0
  });
  const [lineChartData, setLineChartData] = useState<any[]>([]);
  const [pieChartData, setPieChartData] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<UsageLog[]>([]);
  const [endpointStats, setEndpointStats] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsageData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchUsageData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      
      // Calculate date ranges
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch all logs for the month
      const { data: logs, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .gte('created_at', monthStart.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!logs || logs.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate stats
      const todayLogs = logs.filter(log => new Date(log.created_at) >= todayStart);
      const weekLogs = logs.filter(log => new Date(log.created_at) >= weekStart);
      
      const todayCost = todayLogs.reduce((sum, log) => sum + log.cost_usd, 0);
      const weekCost = weekLogs.reduce((sum, log) => sum + log.cost_usd, 0);
      const monthCost = logs.reduce((sum, log) => sum + log.cost_usd, 0);

      setStats({
        today: {
          requests: todayLogs.length,
          cost: todayCost,
          trend: 12 // TODO: Calculate real trend
        },
        week: {
          requests: weekLogs.length,
          cost: weekCost,
          trend: 8
        },
        month: {
          requests: logs.length,
          cost: monthCost,
          trend: -3
        },
        avgCost: logs.length > 0 ? monthCost / logs.length : 0
      });

      // Prepare line chart data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
        return date.toISOString().split('T')[0];
      });

      const chartData = last7Days.map(date => {
        const dayLogs = logs.filter(log => log.created_at.split('T')[0] === date);
        return {
          date: new Date(date).toLocaleDateString('fa-IR', { month: 'numeric', day: 'numeric' }),
          requests: dayLogs.length,
          tokens: dayLogs.reduce((sum, log) => sum + log.total_tokens, 0)
        };
      });
      setLineChartData(chartData);

      // Prepare pie chart data (cost by model)
      const totalCost = logs.reduce((sum, log) => sum + log.cost_usd, 0);
      setPieChartData([
        {
          name: 'DeepSeek Chat',
          value: Math.round((totalCost / totalCost) * 100),
          label: 'DeepSeek Chat'
        }
      ]);

      // Endpoint stats (group by status/type)
      const successLogs = logs.filter(log => log.status === 'success');
      setEndpointStats([
        {
          endpoint: 'AI Analysis',
          requests: successLogs.length,
          tokens: successLogs.reduce((sum, log) => sum + log.total_tokens, 0),
          avg: successLogs.length > 0 ? Math.round(successLogs.reduce((sum, log) => sum + log.total_tokens, 0) / successLogs.length) : 0,
          cost: successLogs.reduce((sum, log) => sum + log.cost_usd, 0)
        }
      ]);

      // Recent logs (last 10)
      setRecentLogs(logs.slice(0, 10));

      setLoading(false);

      if (autoRefresh) {
        toast({
          title: "داده‌ها بروزرسانی شدند",
          description: new Date().toLocaleTimeString('fa-IR'),
        });
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
      toast({
        title: "خطا",
        description: "خطا در دریافت داده‌ها",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (recentLogs.length === 0) {
      toast({
        title: "خطا",
        description: "هیچ داده‌ای برای خروجی وجود ندارد",
        variant: "destructive"
      });
      return;
    }

    const csv = [
      ['Timestamp', 'Model', 'Tokens', 'Input Tokens', 'Output Tokens', 'Cost (USD)', 'Processing Time (ms)', 'Status'].join(','),
      ...recentLogs.map(log => [
        log.created_at,
        log.model_used,
        log.total_tokens,
        log.input_tokens,
        log.output_tokens,
        log.cost_usd.toFixed(6),
        log.response_time_ms,
        log.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-usage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    toast({
      title: "✅ فایل ذخیره شد",
      description: "CSV با موفقیت دانلود شد"
    });
  };

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">مصرف API</h1>
          <p className="text-muted-foreground">آمار و جزئیات استفاده از DeepSeek API</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">بروزرسانی خودکار</Label>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsageData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
            بروزرسانی
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 ml-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading && stats.today.requests === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-20 bg-muted rounded"></div>
            </Card>
          ))}
        </div>
      ) : stats.today.requests === 0 && stats.month.requests === 0 ? (
        <Card className="p-6 mb-6">
          <div className="text-center space-y-2">
            <p className="text-lg">هنوز درخواستی ثبت نشده است.</p>
            <p className="text-sm text-muted-foreground">
              با استفاده از Chat، اولین درخواست خود را ارسال کنید تا آمار اینجا نمایش داده شود.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">امروز</p>
                  <p className="text-3xl font-bold mb-1">{stats.today.requests}</p>
                  <p className="text-sm text-muted-foreground">${stats.today.cost.toFixed(4)}</p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-green-600 mt-2">+{stats.today.trend}%</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">این هفته</p>
                  <p className="text-3xl font-bold mb-1">{stats.week.requests}</p>
                  <p className="text-sm text-muted-foreground">${stats.week.cost.toFixed(4)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-green-600 mt-2">+{stats.week.trend}%</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">این ماه</p>
                  <p className="text-3xl font-bold mb-1">{stats.month.requests.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">${stats.month.cost.toFixed(4)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
              <p className={`text-sm ${stats.month.trend >= 0 ? 'text-green-600' : 'text-red-600'} mt-2`}>
                {stats.month.trend >= 0 ? '+' : ''}{stats.month.trend}%
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">میانگین هزینه</p>
                  <p className="text-3xl font-bold mb-1">${stats.avgCost.toFixed(6)}</p>
                  <p className="text-sm text-muted-foreground">به ازای هر request</p>
                </div>
                <Zap className="h-8 w-8 text-primary" />
              </div>
            </Card>
          </div>

          {/* Smart Alerts */}
          <div className="space-y-3 mb-6">
            {stats.month.cost > 40 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-destructive">
                    ⚠️ هشدار: با روند فعلی، هزینه ماهانه از بودجه تعیین‌شده ($50) فراتر می‌رود
                  </p>
                </div>
              </div>
            )}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-green-900 dark:text-green-100">
                  ✅ شما در محدوده بودجه هستید: ${stats.month.cost.toFixed(2)} / $50.00
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">درخواست‌ها در طول زمان</h3>
          <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="requests" stroke="hsl(var(--primary))" name="درخواست‌ها" />
                <Line type="monotone" dataKey="tokens" stroke="hsl(var(--chart-2))" name="توکن‌ها" />
              </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">توزیع هزینه</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className="p-6 mb-6">
        <Tabs defaultValue="endpoints" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="endpoints">بر اساس Endpoint</TabsTrigger>
            <TabsTrigger value="activity">فعالیت‌های اخیر</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3 font-semibold">Endpoint</th>
                    <th className="text-right p-3 font-semibold">درخواست‌ها</th>
                    <th className="text-right p-3 font-semibold">Tokens</th>
                    <th className="text-right p-3 font-semibold">میانگین</th>
                    <th className="text-right p-3 font-semibold">هزینه</th>
                  </tr>
                </thead>
                <tbody>
                  {endpointStats.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3">{row.endpoint}</td>
                      <td className="p-3">{row.requests.toLocaleString()}</td>
                      <td className="p-3">{row.tokens.toLocaleString()}</td>
                      <td className="p-3">{row.avg}</td>
                      <td className="p-3">${row.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3 font-semibold">زمان</th>
                    <th className="text-right p-3 font-semibold">Endpoint</th>
                    <th className="text-right p-3 font-semibold">سوال</th>
                    <th className="text-right p-3 font-semibold">Tokens</th>
                    <th className="text-right p-3 font-semibold">هزینه</th>
                    <th className="text-right p-3 font-semibold">زمان پردازش</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3">{new Date(row.created_at).toLocaleTimeString('fa-IR')}</td>
                      <td className="p-3">{row.model_used}</td>
                      <td className="p-3 max-w-xs truncate">تحلیل AI</td>
                      <td className="p-3">{row.total_tokens}</td>
                      <td className="p-3">${row.cost_usd.toFixed(6)}</td>
                      <td className="p-3">{row.response_time_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-muted/50">
          <p className="text-sm text-muted-foreground mb-1">Input Tokens</p>
          <p className="text-2xl font-bold mb-1">{recentLogs.reduce((sum, log) => sum + log.input_tokens, 0).toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">≈ ${(recentLogs.reduce((sum, log) => sum + log.input_tokens, 0) * 0.27 / 1000000).toFixed(4)}</p>
        </Card>

        <Card className="p-6 bg-muted/50">
          <p className="text-sm text-muted-foreground mb-1">Output Tokens</p>
          <p className="text-2xl font-bold mb-1">{recentLogs.reduce((sum, log) => sum + log.output_tokens, 0).toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">≈ ${(recentLogs.reduce((sum, log) => sum + log.output_tokens, 0) * 1.10 / 1000000).toFixed(4)}</p>
        </Card>

        <Card className="p-6 bg-primary/10">
          <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
          <p className="text-2xl font-bold text-primary mb-1">${stats.month.cost.toFixed(4)}</p>
          <p className="text-sm text-primary">تخمین ماهانه: ${(stats.month.cost * 30 / new Date().getDate()).toFixed(2)}</p>
        </Card>
      </div>
    </div>
  );
};

export default APIUsage;
