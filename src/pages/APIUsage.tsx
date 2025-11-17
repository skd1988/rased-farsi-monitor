// src/pages/settings/APIUsage.tsx
// ✅ صفحه کامل با دو تب: DeepSeek و Inoreader

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
  BarChart,
  Bar,
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

// ============================================
// Types & Interfaces
// ============================================

interface DeepSeekUsageLog {
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

interface InoreaderUsageLog {
  id: string;
  created_at: string;
  endpoint: string;
  http_method: string;
  zone: number;
  response_time_ms: number;
  status_code: number;
  success: boolean;
  request_type: string;
  folder_id: string | null;
  sync_log_id: string | null;
  error_message: string | null;
  zone1_limit: number | null;
  zone2_limit: number | null;
  zone1_usage: number | null;
  zone2_usage: number | null;
  limits_reset_after: number | null;
}

interface DeepSeekStats {
  today: { requests: number; cost: number; trend: number };
  week: { requests: number; cost: number; trend: number };
  month: { requests: number; cost: number; trend: number };
  avgCost: number;
}

interface InoreaderStats {
  today: { calls: number; zone1: number; zone2: number };
  week: { calls: number; zone1: number; zone2: number };
  month: { calls: number; zone1: number; zone2: number };
  currentUsage: { zone1: number; zone2: number; zone1Limit: number; zone2Limit: number };
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

// ============================================
// Main Component
// ============================================

const APIUsage = () => {
  const [activeTab, setActiveTab] = useState<'deepseek' | 'inoreader'>('deepseek');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // DeepSeek State
  const [deepseekStats, setDeepseekStats] = useState<DeepSeekStats>({
    today: { requests: 0, cost: 0, trend: 0 },
    week: { requests: 0, cost: 0, trend: 0 },
    month: { requests: 0, cost: 0, trend: 0 },
    avgCost: 0
  });
  const [deepseekLineChartData, setDeepseekLineChartData] = useState<any[]>([]);
  const [deepseekPieChartData, setDeepseekPieChartData] = useState<any[]>([]);
  const [deepseekRecentLogs, setDeepseekRecentLogs] = useState<DeepSeekUsageLog[]>([]);
  const [deepseekEndpointStats, setDeepseekEndpointStats] = useState<any[]>([]);
  
  // Inoreader State
  const [inoreaderStats, setInoreaderStats] = useState<InoreaderStats>({
    today: { calls: 0, zone1: 0, zone2: 0 },
    week: { calls: 0, zone1: 0, zone2: 0 },
    month: { calls: 0, zone1: 0, zone2: 0 },
    currentUsage: { zone1: 0, zone2: 0, zone1Limit: 100, zone2Limit: 5000 }
  });
  const [inoreaderLineChartData, setInoreaderLineChartData] = useState<any[]>([]);
  const [inoreaderBarChartData, setInoreaderBarChartData] = useState<any[]>([]);
  const [inoreaderFolderDistribution, setInoreaderFolderDistribution] = useState<any[]>([]);
  const [inoreaderRecentLogs, setInoreaderRecentLogs] = useState<InoreaderUsageLog[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchAllData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // ============================================
  // Fetch Functions
  // ============================================

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDeepSeekData(),
      fetchInoreaderData()
    ]);
    setLoading(false);
  };

  const fetchDeepSeekData = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: logs, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .gte('created_at', monthStart.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!logs || logs.length === 0) return;

      const todayLogs = logs.filter(log => new Date(log.created_at) >= todayStart);
      const weekLogs = logs.filter(log => new Date(log.created_at) >= weekStart);
      
      const todayCost = todayLogs.reduce((sum, log) => sum + log.cost_usd, 0);
      const weekCost = weekLogs.reduce((sum, log) => sum + log.cost_usd, 0);
      const monthCost = logs.reduce((sum, log) => sum + log.cost_usd, 0);

      setDeepseekStats({
        today: { requests: todayLogs.length, cost: todayCost, trend: 12 },
        week: { requests: weekLogs.length, cost: weekCost, trend: 8 },
        month: { requests: logs.length, cost: monthCost, trend: -3 },
        avgCost: logs.length > 0 ? monthCost / logs.length : 0
      });

      // Line chart data (last 7 days)
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
      setDeepseekLineChartData(chartData);

      // Pie chart
      const totalCost = logs.reduce((sum, log) => sum + log.cost_usd, 0);
      setDeepseekPieChartData([
        { name: 'DeepSeek Chat', value: 100, label: 'DeepSeek Chat' }
      ]);

      // Endpoint stats
      const successLogs = logs.filter(log => log.status === 'success');
      setDeepseekEndpointStats([
        {
          endpoint: 'AI Analysis',
          requests: successLogs.length,
          tokens: successLogs.reduce((sum, log) => sum + log.total_tokens, 0),
          avg: successLogs.length > 0 ? Math.round(successLogs.reduce((sum, log) => sum + log.total_tokens, 0) / successLogs.length) : 0,
          cost: successLogs.reduce((sum, log) => sum + log.cost_usd, 0)
        }
      ]);

      setDeepseekRecentLogs(logs.slice(0, 10));

    } catch (error) {
      console.error('Error fetching DeepSeek data:', error);
    }
  };

  const fetchInoreaderData = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // ✅ Correct table name
      const { data: logs, error } = await supabase
        .from('inoreader_api_usage_logs')
        .select('*')
        .gte('created_at', monthStart.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!logs || logs.length === 0) return;

      const todayLogs = logs.filter(log => new Date(log.created_at) >= todayStart);
      const weekLogs = logs.filter(log => new Date(log.created_at) >= weekStart);

      // Get latest zone usage
      const latestLog = logs[0];
      const zone1Usage = latestLog?.zone1_usage || 0;
      const zone2Usage = latestLog?.zone2_usage || 0;
      const zone1Limit = latestLog?.zone1_limit || 100;
      const zone2Limit = latestLog?.zone2_limit || 5000;

      setInoreaderStats({
        today: { calls: todayLogs.length, zone1: todayLogs.filter(l => l.zone === 1).length, zone2: todayLogs.filter(l => l.zone === 2).length },
        week: { calls: weekLogs.length, zone1: weekLogs.filter(l => l.zone === 1).length, zone2: weekLogs.filter(l => l.zone === 2).length },
        month: { calls: logs.length, zone1: logs.filter(l => l.zone === 1).length, zone2: logs.filter(l => l.zone === 2).length },
        currentUsage: { zone1: zone1Usage, zone2: zone2Usage, zone1Limit, zone2Limit }
      });

      // Line chart data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
        return date.toISOString().split('T')[0];
      });

      const lineData = last7Days.map(date => {
        const dayLogs = logs.filter(log => log.created_at.split('T')[0] === date);
        return {
          date: new Date(date).toLocaleDateString('fa-IR', { month: 'numeric', day: 'numeric' }),
          zone1: dayLogs.filter(l => l.zone === 1).length,
          zone2: dayLogs.filter(l => l.zone === 2).length,
          total: dayLogs.length
        };
      });
      setInoreaderLineChartData(lineData);

      // Bar chart by operation type
      const operationTypes = ['stream_contents', 'subscription_list', 'folder_list'];
      const barData = operationTypes.map(type => ({
        operation: type,
        count: logs.filter(l => l.request_type === type).length
      }));
      setInoreaderBarChartData(barData);

      setInoreaderRecentLogs(logs.slice(0, 20));

      // Fetch folder distribution (posts count per folder)
      const { data: folders, error: foldersError } = await supabase
        .from('inoreader_folders')
        .select(`
          id,
          folder_name,
          posts:posts(count)
        `);

      if (!foldersError && folders) {
        const folderData = folders
          .map(f => ({
            name: f.folder_name,
            value: f.posts?.[0]?.count || 0
          }))
          .filter(f => f.value > 0)
          .sort((a, b) => b.value - a.value);
        
        setInoreaderFolderDistribution(folderData);
      }

    } catch (error) {
      console.error('Error fetching Inoreader data:', error);
    }
  };

  // ============================================
  // Export Functions
  // ============================================

  const handleExportDeepSeekCSV = () => {
    if (deepseekRecentLogs.length === 0) {
      toast({ title: "خطا", description: "هیچ داده‌ای برای خروجی وجود ندارد", variant: "destructive" });
      return;
    }

    const csv = [
      ['Timestamp', 'Model', 'Tokens', 'Input', 'Output', 'Cost', 'Time', 'Status'].join(','),
      ...deepseekRecentLogs.map(log => [
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

    downloadCSV(csv, `deepseek-usage-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportInoreaderCSV = () => {
    if (inoreaderRecentLogs.length === 0) {
      toast({ title: "خطا", description: "هیچ داده‌ای برای خروجی وجود ندارد", variant: "destructive" });
      return;
    }

    const csv = [
      ['Timestamp', 'Endpoint', 'Method', 'Zone', 'Status', 'Time', 'Zone1', 'Zone2'].join(','),
      ...inoreaderRecentLogs.map(log => [
        log.created_at,
        log.endpoint,
        log.http_method,
        log.zone,
        log.status_code,
        log.response_time_ms,
        log.zone1_usage || 'N/A',
        log.zone2_usage || 'N/A'
      ].join(','))
    ].join('\n');

    downloadCSV(csv, `inoreader-usage-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    toast({ title: "✅ فایل ذخیره شد", description: "CSV با موفقیت دانلود شد" });
  };

  // ============================================
  // Render
  // ============================================

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
    <div className="min-h-screen bg-background p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">مصرف API</h1>
          <p className="text-muted-foreground">آمار و جزئیات استفاده از DeepSeek و Inoreader API</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <Label htmlFor="auto-refresh" className="text-sm">بروزرسانی خودکار</Label>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
            بروزرسانی
          </Button>
          <Button variant="outline" size="sm" onClick={activeTab === 'deepseek' ? handleExportDeepSeekCSV : handleExportInoreaderCSV}>
            <Download className="h-4 w-4 ml-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="deepseek" onValueChange={(v) => setActiveTab(v as 'deepseek' | 'inoreader')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="deepseek">
            <Zap className="h-4 w-4 ml-2" />
            DeepSeek API
          </TabsTrigger>
          <TabsTrigger value="inoreader">
            <Activity className="h-4 w-4 ml-2" />
            Inoreader API
          </TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* DeepSeek Tab */}
        {/* ============================================ */}
        <TabsContent value="deepseek" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">درخواست‌های امروز</p>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-2">{deepseekStats.today.requests.toLocaleString()}</p>
              <div className="flex items-center text-xs text-success mt-1">
                <TrendingUp className="h-3 w-3 ml-1" />
                +{deepseekStats.today.trend}%
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">هزینه امروز</p>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-2">${deepseekStats.today.cost.toFixed(4)}</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-muted-foreground">هزینه هفته</p>
              <p className="text-2xl font-bold mt-2">${deepseekStats.week.cost.toFixed(4)}</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-muted-foreground">هزینه ماه</p>
              <p className="text-2xl font-bold mt-2">${deepseekStats.month.cost.toFixed(2)}</p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">روند استفاده (7 روز اخیر)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={deepseekLineChartData}>
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
              <h3 className="text-lg font-semibold mb-4">جزئیات هزینه</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Input Tokens:</span>
                  <span className="font-mono">$0.14 / 1M</span>
                </div>
                <div className="flex justify-between">
                  <span>Output Tokens:</span>
                  <span className="font-mono">$0.28 / 1M</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>تخمین ماهانه:</span>
                  <span className="font-mono">${(deepseekStats.month.cost * 30 / new Date().getDate()).toFixed(2)}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Logs Table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">آخرین درخواست‌ها</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3">زمان</th>
                    <th className="text-right p-3">Model</th>
                    <th className="text-right p-3">Tokens</th>
                    <th className="text-right p-3">هزینه</th>
                    <th className="text-right p-3">زمان پاسخ</th>
                  </tr>
                </thead>
                <tbody>
                  {deepseekRecentLogs.map(log => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">{new Date(log.created_at).toLocaleTimeString('fa-IR')}</td>
                      <td className="p-3">{log.model_used}</td>
                      <td className="p-3">{log.total_tokens.toLocaleString()}</td>
                      <td className="p-3">${log.cost_usd.toFixed(6)}</td>
                      <td className="p-3">{log.response_time_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* Inoreader Tab */}
        {/* ============================================ */}
        <TabsContent value="inoreader" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">درخواست‌های امروز</p>
              <p className="text-2xl font-bold mt-2">{inoreaderStats.today.calls.toLocaleString()}</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-muted-foreground">Zone 1 Usage</p>
              <p className="text-2xl font-bold mt-2">{inoreaderStats.currentUsage.zone1}/{inoreaderStats.currentUsage.zone1Limit}</p>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${(inoreaderStats.currentUsage.zone1 / inoreaderStats.currentUsage.zone1Limit) * 100}%` }} />
              </div>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-muted-foreground">Zone 2 Usage</p>
              <p className="text-2xl font-bold mt-2">{inoreaderStats.currentUsage.zone2}/{inoreaderStats.currentUsage.zone2Limit}</p>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div className="bg-chart-2 h-2 rounded-full" style={{ width: `${(inoreaderStats.currentUsage.zone2 / inoreaderStats.currentUsage.zone2Limit) * 100}%` }} />
              </div>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-muted-foreground">تماس‌های ماه</p>
              <p className="text-2xl font-bold mt-2">{inoreaderStats.month.calls.toLocaleString()}</p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">روند استفاده (7 روز اخیر)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={inoreaderLineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="zone1" stroke="hsl(var(--primary))" name="Zone 1" />
                  <Line type="monotone" dataKey="zone2" stroke="hsl(var(--chart-2))" name="Zone 2" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">عملیات به تفکیک</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inoreaderBarChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="operation" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">توزیع محتوا به تفکیک Folder</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={inoreaderFolderDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {inoreaderFolderDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Stats below chart */}
              <div className="mt-4 space-y-2 text-sm">
                {inoreaderFolderDistribution.slice(0, 5).map((folder, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span>{folder.name}</span>
                    </div>
                    <span className="font-mono font-semibold">{folder.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Recent Logs Table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">آخرین عملیات‌ها</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3">زمان</th>
                    <th className="text-right p-3">Endpoint</th>
                    <th className="text-right p-3">Zone</th>
                    <th className="text-right p-3">Status</th>
                    <th className="text-right p-3">Zone1</th>
                    <th className="text-right p-3">Zone2</th>
                  </tr>
                </thead>
                <tbody>
                  {inoreaderRecentLogs.map(log => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">{new Date(log.created_at).toLocaleTimeString('fa-IR')}</td>
                      <td className="p-3">{log.endpoint}</td>
                      <td className="p-3">Zone {log.zone}</td>
                      <td className="p-3">
                        <span className={log.success ? 'text-success' : 'text-destructive'}>
                          {log.status_code}
                        </span>
                      </td>
                      <td className="p-3">{log.zone1_usage || 'N/A'}</td>
                      <td className="p-3">{log.zone2_usage || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default APIUsage;
