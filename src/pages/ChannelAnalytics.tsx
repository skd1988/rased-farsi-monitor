import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle, Radio, Shield, Target, Search,
  ExternalLink, Loader2, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface ChannelData {
  id: string;
  channel_name: string;
  platform: string;
  channel_url: string | null;
  threat_level: string;
  total_posts: number;
  psyop_posts: number;
  last_activity: string | null;
}

export default function ChannelAnalytics() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);

      // Fetch channels directly from social_media_channels table
      const { data: channelsData, error: channelsError } = await supabase
        .from('social_media_channels')
        .select('*')
        .order('threat_multiplier', { ascending: false });

      if (channelsError) throw channelsError;

      // 🔍 DEBUG: Log first 3 channels
      console.log('📊 First 3 channels from DB:', channelsData?.slice(0, 3));

      // Map database fields to component interface
      const channelsArray = (channelsData || []).map(channel => ({
        id: channel.id,
        channel_name: channel.channel_name,
        platform: channel.platform || 'Other',
        channel_url: channel.channel_url,
        threat_level: channel.threat_level || 'Low',
        total_posts: channel.total_posts || 0,
        psyop_posts: channel.historical_psyop_count || 0,
        last_activity: channel.last_analyzed_at || channel.created_at
      }));

      setChannels(channelsArray);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast({
        title: "خطا در دریافت داده‌ها",
        description: "مشکلی در دریافت اطلاعات کانال‌ها پیش آمد",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = channels.length;
    const critical = channels.filter(c => c.threat_level === 'Critical').length;
    const enemy = channels.filter(c =>
      c.channel_name.includes('BBC') ||
      c.channel_name.includes('العربیة') ||
      c.channel_name.includes('الجزیرة')
    ).length;
    const totalPsyop = channels.reduce((sum, c) => sum + c.psyop_posts, 0);

    return { total, critical, enemy, totalPsyop };
  }, [channels]);

  // Filtered channels
  const filteredChannels = useMemo(() => {
    return channels.filter(c => {
      const matchesSearch = c.channel_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlatform = platformFilter === 'all' || c.platform === platformFilter;
      return matchesSearch && matchesPlatform;
    });
  }, [channels, searchTerm, platformFilter]);

  // Top threat channels for bar chart
  const topThreatChannels = useMemo(() => {
    return [...channels]
      .sort((a, b) => b.psyop_posts - a.psyop_posts)
      .slice(0, 10)
      .map(c => ({
        name: c.channel_name.length > 20 ? c.channel_name.substring(0, 20) + '...' : c.channel_name,
        psyops: c.psyop_posts,
        threat_level: c.threat_level
      }));
  }, [channels]);

  // Platform distribution for pie chart
  const platformData = useMemo(() => {
    const platformCounts = new Map<string, number>();

    channels.forEach(channel => {
      const count = platformCounts.get(channel.platform) || 0;
      platformCounts.set(channel.platform, count + 1);
    });

    const colors: Record<string, string> = {
      'Telegram': 'hsl(200, 98%, 39%)',
      'Twitter/X': 'hsl(203, 89%, 53%)',
      'Instagram': 'hsl(340, 75%, 55%)',
      'Facebook': 'hsl(221, 44%, 41%)',
      'YouTube': 'hsl(0, 100%, 50%)',
      'RSS Feed': 'hsl(142, 71%, 45%)',
      'Other': 'hsl(0, 0%, 60%)'
    };

    return Array.from(platformCounts.entries())
      .map(([platform, count]) => ({
        name: platform,
        value: count,
        fill: colors[platform] || colors['Other']
      }))
      .sort((a, b) => b.value - a.value);
  }, [channels]);

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'Critical': return 'hsl(var(--destructive))';
      case 'High': return 'hsl(var(--warning))';
      case 'Medium': return 'hsl(var(--primary))';
      default: return 'hsl(var(--muted))';
    }
  };

  const getThreatBadge = (level: string) => {
    const variants: Record<string, any> = {
      'Critical': 'destructive',
      'High': 'destructive',
      'Medium': 'default',
      'Low': 'secondary'
    };
    return variants[level] || 'secondary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">📡 تحلیل کانال‌های Social Media</h1>
        <p className="text-muted-foreground">رصد و ارزیابی کانال‌های رسانه‌های اجتماعی</p>
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-600" />
              کل کانال‌ها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{kpis.total}</div>
            <p className="text-xs text-muted-foreground">کانال‌های فعال</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              کانال‌های بحرانی
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{kpis.critical}</div>
            <p className="text-xs text-muted-foreground">سطح تهدید بالا</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-600" />
              کانال‌های دشمن
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{kpis.enemy}</div>
            <p className="text-xs text-muted-foreground">ضدمحور مقاومت</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-600" />
              PsyOp از کانال‌ها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{kpis.totalPsyop}</div>
            <p className="text-xs text-muted-foreground">عملیات شناسایی شده</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Threat Channels Chart */}
        <Card>
          <CardHeader>
            <CardTitle>⚠️ Top 10 کانال پرخطر</CardTitle>
            <CardDescription>کانال‌ها بر اساس تعداد PsyOp</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topThreatChannels} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="psyops">
                  {topThreatChannels.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getThreatColor(entry.threat_level)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>📊 توزیع بر اساس پلتفرم</CardTitle>
            <CardDescription>تعداد کانال‌ها در هر پلتفرم</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Channels Table */}
      <Card>
        <CardHeader>
          <CardTitle>📋 جدول کانال‌ها</CardTitle>
          <CardDescription>
            <div className="flex gap-4 mt-3">
              <div className="flex-1">
                <Input
                  placeholder="جستجوی کانال..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">همه پلتفرم‌ها</option>
                <option value="Telegram">Telegram</option>
                <option value="Twitter/X">Twitter/X</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="YouTube">YouTube</option>
                <option value="RSS Feed">RSS Feed</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-3">نام کانال</th>
                  <th className="text-right p-3">پلتفرم</th>
                  <th className="text-right p-3">کل پست‌ها</th>
                  <th className="text-right p-3">PsyOp</th>
                  <th className="text-right p-3">سطح تهدید</th>
                  <th className="text-right p-3">آخرین فعالیت</th>
                  <th className="text-right p-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredChannels.map(channel => (
                  <tr key={channel.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-medium">{channel.channel_name}</td>
                    <td className="p-3">
                      <Badge variant="outline">{channel.platform}</Badge>
                    </td>
                    <td className="p-3">{channel.total_posts}</td>
                    <td className="p-3 font-bold text-red-600">{channel.psyop_posts}</td>
                    <td className="p-3">
                      <Badge variant={getThreatBadge(channel.threat_level)}>
                        {channel.threat_level}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {channel.last_activity
                        ? new Date(channel.last_activity).toLocaleDateString('fa-IR')
                        : '—'
                      }
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/posts?source=${encodeURIComponent(channel.channel_name)}`)}
                        >
                          <ExternalLink className="w-4 h-4 ml-1" />
                          مشاهده پست‌ها
                        </Button>
                        {channel.channel_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(channel.channel_url!, '_blank')}
                          >
                            لینک
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredChannels.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              نتیجه‌ای یافت نشد
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
