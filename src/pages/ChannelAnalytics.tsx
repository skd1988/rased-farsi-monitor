import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, TrendingUp, AlertTriangle, Activity, Radio } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface SocialMediaChannel {
  id: string;
  channel_name: string;
  channel_id: string | null;
  platform: string;
  political_alignment: string;
  reach_score: number;
  credibility_score: number;
  virality_coefficient: number;
  threat_multiplier: number;
  historical_psyop_count: number;
  last_30days_psyop_count: number;
  language: string[];
  country: string | null;
  notes: string | null;
}

interface ChannelPost {
  id: string;
  title: string;
  source: string;
  channel_name: string;
  is_psyop: boolean;
  threat_level: string;
  source_impact_score: number;
  weighted_threat_level: string;
  published_at: string;
}

const ChannelAnalytics = () => {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<SocialMediaChannel[]>([]);
  const [channelPosts, setChannelPosts] = useState<ChannelPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [alignmentFilter, setAlignmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'threat' | 'psyops' | 'impact'>('threat');

  useEffect(() => {
    // Force fresh data on every page load
    console.log('🔄 Channel Analytics mounted at:', new Date().toISOString());
    fetchData();
    
    // 🔔 Real-time subscription for channel changes
    console.log('👂 Setting up real-time subscription...');
    const channel = supabase
      .channel('social_media_channels_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'social_media_channels'
        },
        (payload) => {
          console.log('🔔 Channel data changed:', payload.eventType, payload.new || payload.old);
          
          // Show toast notification
          toast({
            title: "🔄 داده‌ها به‌روزرسانی شدند",
            description: payload.eventType === 'INSERT' 
              ? "کانال جدید اضافه شد" 
              : payload.eventType === 'UPDATE'
              ? "کانال به‌روز شد"
              : "کانال حذف شد",
          });
          
          // Refresh data
          fetchData();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });
    
    // Cleanup on unmount
    return () => {
      console.log('🔌 Unsubscribing from channel changes...');
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      console.log('📡 Fetching channels from social_media_channels table...');
      
      // Fetch channels with explicit limit to avoid caching
      const { data: channelsData, error: channelsError } = await supabase
        .from('social_media_channels')
        .select('*')
        .limit(1000)
        .order('threat_multiplier', { ascending: false });
      
      console.log('📊 Received channels:', {
        total: channelsData?.length || 0,
        platforms: channelsData?.reduce((acc: any, ch: any) => {
          acc[ch.platform] = (acc[ch.platform] || 0) + 1;
          return acc;
        }, {}),
        first3: channelsData?.slice(0, 3).map((ch: any) => ({
          name: ch.channel_name,
          platform: ch.platform
        }))
      });
      
      if (channelsError) {
        console.error('❌ Error fetching channels:', channelsError);
        throw channelsError;
      }
      
      console.log('✅ Channels loaded successfully:', channelsData?.length);
      setChannels(channelsData || []);

      // Fetch posts with channel_name
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, title, source, channel_name, is_psyop, threat_level, source_impact_score, weighted_threat_level, published_at')
        .not('channel_name', 'is', null)
        .neq('status', 'Archived')
        .order('published_at', { ascending: false });
      
      if (postsError) throw postsError;
      setChannelPosts(postsData || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "خطا در دریافت داده‌ها",
        description: "لطفاً دوباره تلاش کنید",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalChannels = channels.length;
    const criticalChannels = channels.filter(c => c.threat_multiplier >= 2.0).length;
    const enemyChannels = channels.filter(c => 
      ['Anti-Resistance', 'Western-Aligned', 'Israeli-Affiliated', 'Saudi-Aligned']
        .includes(c.political_alignment)
    ).length;
    const totalPsyOps = channelPosts.filter(p => p.is_psyop).length;
    
    return { totalChannels, criticalChannels, enemyChannels, totalPsyOps };
  }, [channels, channelPosts]);

  // Filtered and sorted channels
  const filteredChannels = useMemo(() => {
    let filtered = channels.filter(c => {
      const matchesSearch = c.channel_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlatform = platformFilter === 'all' || c.platform === platformFilter;
      const matchesAlignment = alignmentFilter === 'all' || c.political_alignment === alignmentFilter;
      return matchesSearch && matchesPlatform && matchesAlignment;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'threat') return b.threat_multiplier - a.threat_multiplier;
      if (sortBy === 'psyops') return b.last_30days_psyop_count - a.last_30days_psyop_count;
      // impact
      const impactA = a.threat_multiplier * a.reach_score * a.virality_coefficient;
      const impactB = b.threat_multiplier * b.reach_score * b.virality_coefficient;
      return impactB - impactA;
    });

    return filtered;
  }, [channels, searchTerm, platformFilter, alignmentFilter, sortBy]);

  // Top threat channels for bar chart
  const topThreatChannels = useMemo(() => {
    return [...channels]
      .sort((a, b) => b.threat_multiplier - a.threat_multiplier)
      .slice(0, 10)
      .map(c => ({
        channel_name: c.channel_name,
        threat_score: Math.round(c.threat_multiplier * c.reach_score * c.virality_coefficient),
        threat_multiplier: c.threat_multiplier
      }));
  }, [channels]);

  // Platform distribution
  const platformDistribution = useMemo(() => {
    const platforms: Record<string, number> = {};
    channels.forEach(c => {
      platforms[c.platform] = (platforms[c.platform] || 0) + 1;
    });
    
    const colors: Record<string, string> = {
      'Telegram': '#0088cc',
      'Facebook': '#1877f2',
      'YouTube': '#ff0000',
      'Twitter': '#1da1f2',
      'Instagram': '#e4405f'
    };
    
    return Object.entries(platforms).map(([name, value]) => ({
      name,
      value,
      fill: colors[name] || '#94a3b8'
    }));
  }, [channels]);

  const getAlignmentColor = (alignment: string) => {
    const colors: Record<string, string> = {
      'Saudi-Aligned': 'bg-red-500',
      'Anti-Resistance': 'bg-red-600',
      'Western-Aligned': 'bg-orange-500',
      'Israeli-Affiliated': 'bg-red-700',
      'Neutral': 'bg-blue-500',
      'Local/Regional': 'bg-gray-500',
      'Pro-Resistance': 'bg-green-500',
      'Unknown': 'bg-gray-400'
    };
    return colors[alignment] || 'bg-gray-400';
  };

  const getAlignmentLabel = (alignment: string) => {
    const labels: Record<string, string> = {
      'Saudi-Aligned': 'سعودی',
      'Anti-Resistance': 'ضد مقاومت',
      'Western-Aligned': 'غرب‌گرا',
      'Israeli-Affiliated': 'صهیونیست',
      'Neutral': 'خنثی',
      'Local/Regional': 'محلی',
      'Pro-Resistance': 'مقاومت',
      'Unknown': 'نامشخص'
    };
    return labels[alignment] || alignment;
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      'Telegram': '📱',
      'Facebook': '👥',
      'YouTube': '📺',
      'Twitter': '🐦',
      'Instagram': '📷'
    };
    return icons[platform] || '🌐';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">📱 تحلیل کانال‌های Social Media</h1>
        <p className="text-muted-foreground mt-2">
          رصد و تحلیل کانال‌های تلگرام، فیسبوک، یوتیوب و سایر پلتفرم‌ها
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              کل کانال‌ها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{kpis.totalChannels}</div>
              <Radio className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              در پلتفرم‌های مختلف
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              کانال‌های بحرانی
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-red-600">{kpis.criticalChannels}</div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ضریب تهدید ≥ 2.0
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              کانال‌های دشمن
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-orange-600">{kpis.enemyChannels}</div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ضد مقاومت / غرب‌گرا
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              PsyOp از کانال‌ها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{kpis.totalPsyOps}</div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              از کل پست‌های کانال‌ها
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Threat Channels Chart */}
        <Card>
          <CardHeader>
            <CardTitle>🔥 Top 10 کانال پرخطر</CardTitle>
            <CardDescription>بر اساس امتیاز تهدید</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topThreatChannels} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="channel_name" 
                  type="category" 
                  width={120}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip />
                <Bar dataKey="threat_score" fill="#ef4444" radius={[0, 4, 4, 0]}>
                  {topThreatChannels.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.threat_multiplier >= 2.0 ? '#dc2626' : '#ef4444'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>📊 توزیع بر اساس پلتفرم</CardTitle>
            <CardDescription>تعداد کانال‌ها در هر پلتفرم</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={platformDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {platformDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Channels Table */}
      <Card>
        <CardHeader>
          <CardTitle>📋 فهرست کانال‌ها ({filteredChannels.length})</CardTitle>
          <CardDescription>جستجو و فیلتر کانال‌های Social Media</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجوی نام کانال..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="پلتفرم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه پلتفرم‌ها</SelectItem>
                <SelectItem value="Telegram">تلگرام</SelectItem>
                <SelectItem value="Facebook">فیسبوک</SelectItem>
                <SelectItem value="YouTube">یوتیوب</SelectItem>
                <SelectItem value="Twitter">توییتر</SelectItem>
                <SelectItem value="Instagram">اینستاگرام</SelectItem>
              </SelectContent>
            </Select>
            <Select value={alignmentFilter} onValueChange={setAlignmentFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="جهت‌گیری" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه جهت‌گیری‌ها</SelectItem>
                <SelectItem value="Saudi-Aligned">سعودی</SelectItem>
                <SelectItem value="Anti-Resistance">ضد مقاومت</SelectItem>
                <SelectItem value="Western-Aligned">غرب‌گرا</SelectItem>
                <SelectItem value="Neutral">خنثی</SelectItem>
                <SelectItem value="Pro-Resistance">مقاومت</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="مرتب‌سازی" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="threat">بیشترین تهدید</SelectItem>
                <SelectItem value="psyops">بیشترین PsyOp</SelectItem>
                <SelectItem value="impact">بیشترین Impact</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-3 font-semibold">کانال</th>
                  <th className="text-right p-3 font-semibold">پلتفرم</th>
                  <th className="text-right p-3 font-semibold">جهت‌گیری</th>
                  <th className="text-center p-3 font-semibold">دسترسی</th>
                  <th className="text-center p-3 font-semibold">ویرالیتی</th>
                  <th className="text-center p-3 font-semibold">تهدید</th>
                  <th className="text-center p-3 font-semibold">PsyOp (30د)</th>
                  <th className="text-center p-3 font-semibold">اقدامات</th>
                </tr>
              </thead>
              <tbody>
                {filteredChannels.map((channel) => (
                  <tr key={channel.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{channel.channel_name}</div>
                        {channel.channel_id && (
                          <div className="text-xs text-muted-foreground">{channel.channel_id}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span>{getPlatformIcon(channel.platform)}</span>
                        <span>{channel.platform}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge className={getAlignmentColor(channel.political_alignment)}>
                        {getAlignmentLabel(channel.political_alignment)}
                      </Badge>
                    </td>
                    <td className="text-center p-3">{channel.reach_score}/100</td>
                    <td className="text-center p-3">{channel.virality_coefficient.toFixed(1)}x</td>
                    <td className="text-center p-3">
                      <span className={`font-bold ${channel.threat_multiplier >= 2.0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {channel.threat_multiplier.toFixed(1)}x
                      </span>
                    </td>
                    <td className="text-center p-3">
                      {channel.last_30days_psyop_count > 0 ? (
                        <Badge variant="destructive">{channel.last_30days_psyop_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="text-center p-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/posts?channel=${encodeURIComponent(channel.channel_name)}`)}
                      >
                        مشاهده پست‌ها
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChannelAnalytics;
