import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';

type TimeRange = '7' | '30' | 'custom';

const Trends = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [loading, setLoading] = useState(true);
  const [keywordData, setKeywordData] = useState<any[]>([]);
  const [trendingKeywords, setTrendingKeywords] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [topicData, setTopicData] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [sentimentByTopic, setSentimentByTopic] = useState<any[]>([]);

  useEffect(() => {
    fetchAllData();
  }, [timeRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchKeywordData(),
        fetchTrendingKeywords(),
        fetchTimelineData(),
        fetchSentimentData(),
        fetchTopicData(),
        fetchSourceData(),
        fetchSentimentByTopic()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInterval = () => {
    return timeRange === '7' ? 7 : 30;
  };

  const fetchKeywordData = async () => {
    const days = getDaysInterval();
    const { data, error } = await supabase
      .from('posts')
      .select('keywords')
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .not('keywords', 'is', null);

    if (!error && data) {
      const keywordMap: Record<string, number> = {};
      data.forEach(post => {
        if (post.keywords && Array.isArray(post.keywords)) {
          post.keywords.forEach(keyword => {
            keywordMap[keyword] = (keywordMap[keyword] || 0) + 1;
          });
        }
      });

      const sorted = Object.entries(keywordMap)
        .map(([keyword, frequency]) => ({ keyword, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 30);

      setKeywordData(sorted);
    }
  };

  const fetchTrendingKeywords = async () => {
    // Compare last 3 days vs previous 3 days
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const { data: recent } = await supabase
      .from('posts')
      .select('keywords')
      .gte('published_at', threeDaysAgo.toISOString())
      .not('keywords', 'is', null);

    const { data: previous } = await supabase
      .from('posts')
      .select('keywords')
      .gte('published_at', sixDaysAgo.toISOString())
      .lt('published_at', threeDaysAgo.toISOString())
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

      const trending = Object.keys(recentMap)
        .map(keyword => {
          const recentCount = recentMap[keyword] || 0;
          const prevCount = previousMap[keyword] || 0;
          const growth = prevCount > 0 ? ((recentCount - prevCount) / prevCount) * 100 : 100;
          return { keyword, frequency: recentCount, growth };
        })
        .filter(item => item.growth > 0)
        .sort((a, b) => b.growth - a.growth)
        .slice(0, 8);

      setTrendingKeywords(trending);
    }
  };

  const fetchTimelineData = async () => {
    const days = getDaysInterval();
    const { data, error } = await supabase
      .from('posts')
      .select('published_at, threat_level')
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('published_at', { ascending: true });

    if (!error && data) {
      const dateMap: Record<string, any> = {};
      
      data.forEach(post => {
        const date = new Date(post.published_at).toISOString().split('T')[0];
        if (!dateMap[date]) {
          dateMap[date] = { date, Critical: 0, High: 0, Medium: 0, Low: 0, total: 0 };
        }
        dateMap[date].total++;
        if (post.threat_level) {
          dateMap[date][post.threat_level] = (dateMap[date][post.threat_level] || 0) + 1;
        }
      });

      setTimelineData(Object.values(dateMap));
    }
  };

  const fetchSentimentData = async () => {
    const days = getDaysInterval();
    const { data, error } = await supabase
      .from('posts')
      .select('published_at, sentiment')
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .not('sentiment', 'is', null)
      .order('published_at', { ascending: true });

    if (!error && data) {
      const dateMap: Record<string, any> = {};
      
      data.forEach(post => {
        const date = new Date(post.published_at).toISOString().split('T')[0];
        if (!dateMap[date]) {
          dateMap[date] = { date, positive: 0, neutral: 0, negative: 0 };
        }
        
        const sentiment = post.sentiment?.toLowerCase();
        if (sentiment?.includes('مثبت') || sentiment?.includes('positive')) {
          dateMap[date].positive++;
        } else if (sentiment?.includes('منفی') || sentiment?.includes('negative')) {
          dateMap[date].negative++;
        } else {
          dateMap[date].neutral++;
        }
      });

      // Convert to percentages
      const percentageData = Object.values(dateMap).map((day: any) => {
        const total = day.positive + day.neutral + day.negative;
        return {
          date: day.date,
          positive: total > 0 ? (day.positive / total) * 100 : 0,
          neutral: total > 0 ? (day.neutral / total) * 100 : 0,
          negative: total > 0 ? (day.negative / total) * 100 : 0,
        };
      });

      setSentimentData(percentageData);
    }
  };

  const fetchTopicData = async () => {
    const days = getDaysInterval();
    const { data, error } = await supabase
      .from('posts')
      .select('main_topic')
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .not('main_topic', 'is', null);

    if (!error && data) {
      const topicMap: Record<string, number> = {};
      data.forEach(post => {
        if (post.main_topic) {
          topicMap[post.main_topic] = (topicMap[post.main_topic] || 0) + 1;
        }
      });

      const sorted = Object.entries(topicMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      setTopicData(sorted);
    }
  };

  const fetchSourceData = async () => {
    const days = getDaysInterval();
    const { data, error } = await supabase
      .from('posts')
      .select('source')
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .not('source', 'is', null);

    if (!error && data) {
      const sourceMap: Record<string, number> = {};
      data.forEach(post => {
        if (post.source) {
          sourceMap[post.source] = (sourceMap[post.source] || 0) + 1;
        }
      });

      const sorted = Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      setSourceData(sorted);
    }
  };

  const fetchSentimentByTopic = async () => {
    const days = getDaysInterval();
    const { data, error } = await supabase
      .from('posts')
      .select('main_topic, sentiment')
      .gte('published_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .not('main_topic', 'is', null)
      .not('sentiment', 'is', null);

    if (!error && data) {
      const topicSentimentMap: Record<string, any> = {};
      
      data.forEach(post => {
        if (!post.main_topic || !post.sentiment) return;
        
        if (!topicSentimentMap[post.main_topic]) {
          topicSentimentMap[post.main_topic] = { topic: post.main_topic, positive: 0, neutral: 0, negative: 0 };
        }
        
        const sentiment = post.sentiment.toLowerCase();
        if (sentiment.includes('مثبت') || sentiment.includes('positive')) {
          topicSentimentMap[post.main_topic].positive++;
        } else if (sentiment.includes('منفی') || sentiment.includes('negative')) {
          topicSentimentMap[post.main_topic].negative++;
        } else {
          topicSentimentMap[post.main_topic].neutral++;
        }
      });

      const sorted = Object.values(topicSentimentMap)
        .sort((a: any, b: any) => (b.positive + b.neutral + b.negative) - (a.positive + a.neutral + a.negative))
        .slice(0, 10);

      setSentimentByTopic(sorted);
    }
  };

  const getKeywordColor = (frequency: number, maxFrequency: number) => {
    const ratio = frequency / maxFrequency;
    if (ratio > 0.7) return 'hsl(var(--destructive))';
    if (ratio > 0.4) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--muted))'];

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">ترندها و تحلیل الگوها</h1>
          <p className="text-muted-foreground mt-2">شناسایی روندها، الگوها و موضوعات پرتکرار</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={timeRange === '7' ? 'default' : 'outline'}
            onClick={() => setTimeRange('7')}
          >
            7 روز اخیر
          </Button>
          <Button
            variant={timeRange === '30' ? 'default' : 'outline'}
            onClick={() => setTimeRange('30')}
          >
            30 روز اخیر
          </Button>
        </div>
      </div>

      {/* Section 1: Keyword Trends */}
      <Card>
        <CardHeader>
          <CardTitle>کلیدواژه‌های پرتکرار</CardTitle>
          <CardDescription>30 کلیدواژه برتر در بازه زمانی انتخاب شده</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={600}>
            <BarChart data={keywordData} layout="vertical" margin={{ left: 120, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" />
              <YAxis dataKey="keyword" type="category" width={100} className="text-sm" />
              <Tooltip />
              <Bar dataKey="frequency" fill="hsl(var(--primary))">
                {keywordData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getKeywordColor(entry.frequency, keywordData[0]?.frequency || 1)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Trending Keywords */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            کلیدواژه‌های در حال رشد
          </CardTitle>
          <CardDescription>کلیدواژه‌هایی با بیشترین رشد در 3 روز اخیر</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {trendingKeywords.map((item, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-lg">{item.keyword}</span>
                  <Badge variant="default" className="gap-1">
                    <ArrowUp className="w-3 h-3" />
                    {item.growth.toFixed(0)}%
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-primary">{item.frequency}</p>
                <p className="text-xs text-muted-foreground">تکرار</p>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Temporal Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>تحلیل زمانی - حجم مطالب</CardTitle>
          <CardDescription>روند انتشار مطالب بر اساس سطح تهدید</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickFormatter={(value) => formatPersianDate(value)} />
              <YAxis />
              <Tooltip labelFormatter={(value) => formatPersianDate(value)} />
              <Legend />
              <Line type="monotone" dataKey="Critical" stroke="hsl(var(--destructive))" strokeWidth={2} name="بحرانی" />
              <Line type="monotone" dataKey="High" stroke="hsl(var(--warning))" strokeWidth={2} name="بالا" />
              <Line type="monotone" dataKey="Medium" stroke="hsl(var(--primary))" strokeWidth={2} name="متوسط" />
              <Line type="monotone" dataKey="Low" stroke="hsl(var(--success))" strokeWidth={2} name="پایین" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Section 3: Source Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>تحلیل منابع</CardTitle>
          <CardDescription>15 منبع برتر بر اساس تعداد مطالب</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={sourceData} layout="vertical" margin={{ left: 150, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" />
              <YAxis dataKey="source" type="category" width={130} className="text-sm" />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Section 4: Sentiment Flow */}
      <Card>
        <CardHeader>
          <CardTitle>جریان احساسات</CardTitle>
          <CardDescription>توزیع درصدی احساسات در طول زمان</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={sentimentData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickFormatter={(value) => formatPersianDate(value)} />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => formatPersianDate(value)}
                formatter={(value: any) => `${value.toFixed(1)}%`}
              />
              <Legend />
              <Area type="monotone" dataKey="positive" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success))" name="مثبت" />
              <Area type="monotone" dataKey="neutral" stackId="1" stroke="hsl(var(--muted))" fill="hsl(var(--muted))" name="خنثی" />
              <Area type="monotone" dataKey="negative" stackId="1" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" name="منفی" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sentiment by Topic */}
      <Card>
        <CardHeader>
          <CardTitle>احساسات بر اساس موضوع</CardTitle>
          <CardDescription>توزیع احساسات در موضوعات مختلف</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={sentimentByTopic} layout="vertical" margin={{ left: 120, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" />
              <YAxis dataKey="topic" type="category" width={100} className="text-sm" />
              <Tooltip />
              <Legend />
              <Bar dataKey="positive" fill="hsl(var(--success))" name="مثبت" />
              <Bar dataKey="neutral" fill="hsl(var(--muted))" name="خنثی" />
              <Bar dataKey="negative" fill="hsl(var(--destructive))" name="منفی" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Section 5: Topic Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>توزیع موضوعات</CardTitle>
            <CardDescription>درصد هر موضوع از کل مطالب</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topicData.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {topicData.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>جدول موضوعات</CardTitle>
            <CardDescription>موضوعات برتر با تعداد مطالب</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {topicData.slice(0, 15).map((topic, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium">{topic.name}</span>
                  <Badge variant="secondary">{topic.value} مطلب</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Trends;
