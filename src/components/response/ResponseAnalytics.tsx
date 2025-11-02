import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ResponseAnalytics = () => {
  // Mock data
  const metricsData = [
    { name: 'کل پاسخ‌ها', value: 124 },
    { name: 'میانگین زمان پاسخ', value: '4.5 ساعت' },
    { name: 'نرخ پاسخ به‌موقع', value: '87%' },
    { name: 'استفاده از قالب', value: '68 بار' }
  ];

  const responseTimeData = [
    { urgency: 'فوری', avgTime: 1.5 },
    { urgency: 'بالا', avgTime: 6 },
    { urgency: 'متوسط', avgTime: 24 },
    { urgency: 'کم', avgTime: 72 }
  ];

  const channelData = [
    { name: 'بیانیه رسمی', value: 45 },
    { name: 'شبکه‌های اجتماعی', value: 35 },
    { name: 'کنفرانس مطبوعاتی', value: 20 }
  ];

  const volumeData = [
    { month: 'فروردین', count: 12 },
    { month: 'اردیبهشت', count: 18 },
    { month: 'خرداد', count: 24 },
    { month: 'تیر', count: 20 },
    { month: 'مرداد', count: 28 },
    { month: 'شهریور', count: 22 }
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {metricsData.map((metric) => (
          <Card key={metric.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Response Time by Urgency */}
      <Card>
        <CardHeader>
          <CardTitle>زمان پاسخ بر اساس سطح فوریت</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="urgency" />
              <YAxis label={{ value: 'ساعت', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="avgTime" fill="#8884d8" name="میانگین زمان (ساعت)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Channels Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>توزیع پاسخ‌ها بر اساس کانال</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Response Volume Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>حجم پاسخ‌ها در طول زمان</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#8884d8" name="تعداد پاسخ" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>بینش‌های بهبود</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>نرخ پاسخ به‌موقع به پست‌های فوری 95% است - عملکرد عالی</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold">⚠</span>
              <span>پاسخ به اتهامات حقوق بشری در میانگین 8 ساعت طول می‌کشد - نیاز به بهبود</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">ℹ</span>
              <span>شبکه‌های اجتماعی مؤثرترین کانال برای پاسخ سریع هستند</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">ℹ</span>
              <span>استفاده از قالب‌ها زمان آماده‌سازی را 40% کاهش می‌دهد</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResponseAnalytics;
