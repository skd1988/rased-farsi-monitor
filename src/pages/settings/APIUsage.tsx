import React, { useState } from 'react';
import { Activity, TrendingUp, DollarSign, Zap, Download, RefreshCw, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

// Mock data for charts
const lineChartData = [
  { date: '۱ دی', query: 45, answer: 67 },
  { date: '۲ دی', query: 52, answer: 78 },
  { date: '۳ دی', query: 48, answer: 71 },
  { date: '۴ دی', query: 61, answer: 89 },
  { date: '۵ دی', query: 55, answer: 82 },
  { date: '۶ دی', query: 49, answer: 74 },
  { date: '۷ دی', query: 58, answer: 85 },
];

const pieChartData = [
  { name: 'query_analysis', value: 35, label: 'تحلیل سوال' },
  { name: 'generate_answer', value: 55, label: 'تولید پاسخ' },
  { name: 'chat', value: 10, label: 'چت' },
];

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

const endpointData = [
  { endpoint: 'query_analysis', requests: 423, tokens: 45234, avg: 107, cost: 0.0234 },
  { endpoint: 'generate_answer', requests: 687, tokens: 234567, avg: 341, cost: 0.4567 },
  { endpoint: 'chat', requests: 133, tokens: 23456, avg: 176, cost: 0.0987 },
];

const activityData = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  time: new Date(Date.now() - i * 3600000).toLocaleTimeString('fa-IR'),
  endpoint: ['query_analysis', 'generate_answer', 'chat'][Math.floor(Math.random() * 3)],
  question: 'مطالب امروز با threat level بالا رو نشون بده',
  tokens: Math.floor(Math.random() * 500) + 100,
  cost: (Math.random() * 0.01).toFixed(4),
  time_ms: Math.floor(Math.random() * 2000) + 500,
}));

const APIUsage = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);

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
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 ml-2" />
            بروزرسانی
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 ml-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">امروز</p>
              <p className="text-3xl font-bold mb-1">42</p>
              <p className="text-sm text-muted-foreground">$0.0234</p>
            </div>
            <Activity className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-green-600 mt-2">+12%</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">این هفته</p>
              <p className="text-3xl font-bold mb-1">287</p>
              <p className="text-sm text-muted-foreground">$0.1567</p>
            </div>
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-green-600 mt-2">+8%</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">این ماه</p>
              <p className="text-3xl font-bold mb-1">1,243</p>
              <p className="text-sm text-muted-foreground">$0.6789</p>
            </div>
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-red-600 mt-2">-3%</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">میانگین هزینه</p>
              <p className="text-3xl font-bold mb-1">$0.0005</p>
              <p className="text-sm text-muted-foreground">به ازای هر request</p>
            </div>
            <Zap className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Smart Alerts */}
      <div className="space-y-3 mb-6">
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="text-sm">
              💡 پیشنهاد: ۶۷٪ از سوالات می‌توانند از نتایج cache شده استفاده کنند
            </p>
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-900 dark:text-green-100">
              ✅ شما در محدوده بودجه هستید: $0.68 / $50.00
            </p>
          </div>
        </div>
      </div>

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
              <Line type="monotone" dataKey="query" stroke="hsl(var(--primary))" name="تحلیل سوال" />
              <Line type="monotone" dataKey="answer" stroke="hsl(var(--chart-2))" name="تولید پاسخ" />
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
                  {endpointData.map((row, idx) => (
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
                  {activityData.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3">{row.time}</td>
                      <td className="p-3">{row.endpoint}</td>
                      <td className="p-3 max-w-xs truncate">{row.question}</td>
                      <td className="p-3">{row.tokens}</td>
                      <td className="p-3">${row.cost}</td>
                      <td className="p-3">{row.time_ms}ms</td>
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
          <p className="text-2xl font-bold mb-1">145,678</p>
          <p className="text-sm text-muted-foreground">≈ $0.0393</p>
        </Card>

        <Card className="p-6 bg-muted/50">
          <p className="text-sm text-muted-foreground mb-1">Output Tokens</p>
          <p className="text-2xl font-bold mb-1">97,118</p>
          <p className="text-sm text-muted-foreground">≈ $0.1068</p>
        </Card>

        <Card className="p-6 bg-primary/10">
          <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
          <p className="text-2xl font-bold text-primary mb-1">$0.1461</p>
          <p className="text-sm text-primary">تخمین ماهانه: $4.38</p>
        </Card>
      </div>
    </div>
  );
};

export default APIUsage;
