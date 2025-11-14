import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDistanceToNowIran } from '@/lib/dateUtils';
import { Activity, Clock, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface InoreaderLog {
  id: string;
  created_at: string;
  endpoint: string;
  http_method: string;
  zone: number;
  response_time_ms: number;
  status_code: number;
  success: boolean;
  request_type: string;
  zone1_limit?: number;
  zone2_limit?: number;
  zone1_usage?: number;
  zone2_usage?: number;
  limits_reset_after?: number;
}

interface LatestLimits {
  zone1_limit: number;
  zone2_limit: number;
  zone1_usage: number;
  zone2_usage: number;
  limits_reset_after: number;
}

const requestTypeLabels: Record<string, string> = {
  'oauth_exchange': 'احراز هویت',
  'oauth_refresh': 'تمدید توکن',
  'folders_list': 'لیست پوشه‌ها',
  'folders_sync': 'همگام‌سازی',
  'rss_ingestion': 'دریافت اخبار',
};

const InoreaderAPIUsageTab = () => {
  const [logs, setLogs] = useState<InoreaderLog[]>([]);
  const [latestLimits, setLatestLimits] = useState<LatestLimits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // دریافت logs از 30 روز اخیر
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logsData, error: logsError } = await supabase
        .from('inoreader_api_usage_logs')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;

      setLogs(logsData || []);

      // دریافت آخرین limits
      const { data: limitsData, error: limitsError } = await supabase
        .rpc('get_latest_inoreader_limits');

      if (limitsError) {
        console.error('Error fetching limits:', limitsError);
      } else if (limitsData && limitsData.length > 0) {
        setLatestLimits(limitsData[0]);
      }
    } catch (error) {
      console.error('Error fetching Inoreader data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getZoneColor = (percentage: number) => {
    if (percentage < 70) return 'bg-green-500';
    if (percentage < 90) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getZoneStatus = (percentage: number) => {
    if (percentage < 70) return { label: 'سالم', variant: 'default' as const, icon: CheckCircle };
    if (percentage < 90) return { label: 'هشدار', variant: 'secondary' as const, icon: AlertTriangle };
    return { label: 'خطرناک', variant: 'destructive' as const, icon: AlertCircle };
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'oauth_exchange':
        return 'default';
      case 'oauth_refresh':
        return 'secondary';
      case 'folders_list':
        return 'outline';
      case 'folders_sync':
        return 'default';
      case 'rss_ingestion':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'default';
      case 'POST':
        return 'secondary';
      case 'PUT':
        return 'outline';
      case 'DELETE':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // محاسبه آمار
  const zone1Limit = latestLimits?.zone1_limit || 100;
  const zone2Limit = latestLimits?.zone2_limit || 100;
  const zone1Usage = latestLimits?.zone1_usage || 0;
  const zone2Usage = latestLimits?.zone2_usage || 0;
  const zone1Percentage = (zone1Usage / zone1Limit) * 100;
  const zone2Percentage = (zone2Usage / zone2Limit) * 100;

  const zone1Status = getZoneStatus(zone1Percentage);
  const zone2Status = getZoneStatus(zone2Percentage);

  const resetAfter = latestLimits?.limits_reset_after || 0;
  const hours = Math.floor(resetAfter / 3600);
  const minutes = Math.floor((resetAfter % 3600) / 60);

  // آماده‌سازی داده برای نمودار
  const getChartData = () => {
    const data: { date: string; zone1: number; zone2: number }[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });

      const dayLogs = logs.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate.toDateString() === date.toDateString();
      });

      data.push({
        date: dateStr,
        zone1: dayLogs.filter(log => log.zone === 1).length,
        zone2: dayLogs.filter(log => log.zone === 2).length,
      });
    }

    return data;
  };

  // آمار کلی
  const totalRequests = logs.length;
  const avgResponseTime = logs.length > 0
    ? logs.reduce((sum, log) => sum + log.response_time_ms, 0) / logs.length
    : 0;
  const successfulRequests = logs.filter(log => log.success).length;
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

  // توزیع request types
  const getRequestTypeDistribution = () => {
    const distribution: Record<string, number> = {};
    logs.forEach(log => {
      distribution[log.request_type] = (distribution[log.request_type] || 0) + 1;
    });

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    return Object.entries(distribution).map(([type, count], index) => ({
      name: requestTypeLabels[type] || type,
      value: count,
      color: colors[index % colors.length],
    }));
  };

  const chartData = getChartData();
  const requestTypeDistribution = getRequestTypeDistribution();

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
    <div className="space-y-6">
      {/* Zone Usage KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Zone 1 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Zone 1</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">{zone1Usage} / {zone1Limit}</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>میزان مصرف</span>
                <span className="font-medium">{zone1Percentage.toFixed(1)}%</span>
              </div>
              <Progress
                value={zone1Percentage}
                className={`h-2`}
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={zone1Status.variant}>
                <zone1Status.icon className="h-3 w-3 ml-1" />
                {zone1Status.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Zone 2 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Zone 2</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">{zone2Usage} / {zone2Limit}</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>میزان مصرف</span>
                <span className="font-medium">{zone2Percentage.toFixed(1)}%</span>
              </div>
              <Progress
                value={zone2Percentage}
                className={`h-2`}
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={zone2Status.variant}>
                <zone2Status.icon className="h-3 w-3 ml-1" />
                {zone2Status.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Reset Countdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">بازنشانی محدودیت‌ها</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hours > 0 && `${hours} ساعت `}
              {minutes} دقیقه
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              زمان باقیمانده تا reset
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>مصرف 30 روز اخیر</CardTitle>
            <CardDescription>تعداد درخواست‌ها به تفکیک Zone</CardDescription>
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
                    dataKey="zone1"
                    stroke="#3b82f6"
                    name="Zone 1"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="zone2"
                    stroke="#ef4444"
                    name="Zone 2"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>آمار کلی (30 روز)</CardTitle>
            <CardDescription>خلاصه عملکرد API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">تعداد کل درخواست‌ها:</span>
              <span className="text-2xl font-bold">{totalRequests.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">میانگین زمان پاسخ:</span>
              <span className="text-2xl font-bold">{Math.round(avgResponseTime)}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">نرخ موفقیت:</span>
              <span className="text-2xl font-bold">{successRate.toFixed(1)}%</span>
            </div>
            {/* Request Types Mini Pie Chart */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">توزیع انواع درخواست</p>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={requestTypeDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={50}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {requestTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle>آخرین درخواست‌های API</CardTitle>
          <CardDescription>50 درخواست اخیر</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">زمان</TableHead>
                  <TableHead className="text-right">Endpoint</TableHead>
                  <TableHead className="text-right">Method</TableHead>
                  <TableHead className="text-right">Zone</TableHead>
                  <TableHead className="text-right">زمان پاسخ</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                  <TableHead className="text-right">نوع درخواست</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 50).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-right">
                      {formatDistanceToNowIran(log.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <code className="text-xs">
                        {log.endpoint.length > 40
                          ? log.endpoint.substring(0, 40) + '...'
                          : log.endpoint}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={getMethodBadgeColor(log.http_method)}>
                        {log.http_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={log.zone === 1 ? 'default' : 'secondary'}>
                        Zone {log.zone}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {log.response_time_ms}ms
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={log.success ? 'default' : 'destructive'}>
                        {log.success ? 'موفق' : 'خطا'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={getBadgeVariant(log.request_type)}>
                        {requestTypeLabels[log.request_type] || log.request_type}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InoreaderAPIUsageTab;
