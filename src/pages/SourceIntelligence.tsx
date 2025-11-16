import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle, TrendingUp, Users, Shield, Search,
  ArrowUpDown, Filter, Download, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ScatterChart,
  Scatter, Legend, LineChart, Line
} from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface SourceProfile {
  id: string;
  source_name: string;
  source_type: string;
  political_alignment: string;
  reach_score: number;
  credibility_score: number;
  virality_coefficient: number;
  threat_multiplier: number;
  historical_psyop_count: number;
  last_30days_psyop_count: number;
  country: string;
  active: boolean;
}

export default function SourceIntelligence() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sources, setSources] = useState<SourceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [alignmentFilter, setAlignmentFilter] = useState('all');

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('source_profiles')
        .select('*')
        .order('threat_multiplier', { ascending: false });

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      console.error('Error fetching sources:', error);
      toast({
        title: "خطا در دریافت داده‌ها",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const critical = sources.filter(s => s.threat_multiplier >= 2.0).length;
    const avgViral = sources.length > 0
      ? (sources.reduce((sum, s) => sum + s.virality_coefficient, 0) / sources.length).toFixed(1)
      : '0';
    const enemySources = sources.filter(s =>
      ['Anti-Resistance', 'Western-Aligned', 'Israeli-Affiliated', 'Saudi-Aligned']
        .includes(s.political_alignment)
    ).length;
    const total30d = sources.reduce((sum, s) => sum + s.last_30days_psyop_count, 0);

    return { critical, avgViral, enemySources, total30d };
  }, [sources]);

  // Filtered sources
  const filteredSources = useMemo(() => {
    return sources.filter(s => {
      const matchesSearch = s.source_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAlignment = alignmentFilter === 'all' || s.political_alignment === alignmentFilter;
      return matchesSearch && matchesAlignment;
    });
  }, [sources, searchTerm, alignmentFilter]);

  // Top threat sources for bar chart
  const topThreatSources = useMemo(() => {
    return [...sources]
      .sort((a, b) => b.threat_multiplier - a.threat_multiplier)
      .slice(0, 15)
      .map(s => ({
        source_name: s.source_name,
        threat_score: Math.round(s.threat_multiplier * s.reach_score * s.virality_coefficient)
      }));
  }, [sources]);

  const getThreatColor = (multiplier: number) => {
    if (multiplier >= 2.0) return 'hsl(var(--destructive))';
    if (multiplier >= 1.5) return 'hsl(var(--warning))';
    if (multiplier >= 1.0) return 'hsl(var(--primary))';
    return 'hsl(var(--success))';
  };

  const getAlignmentBadge = (alignment: string) => {
    const variants: Record<string, any> = {
      'Anti-Resistance': 'destructive',
      'Western-Aligned': 'destructive',
      'Israeli-Affiliated': 'destructive',
      'Saudi-Aligned': 'destructive',
      'Neutral': 'secondary',
      'Pro-Resistance': 'default',
      'Unknown': 'outline'
    };
    return variants[alignment] || 'default';
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
        <h1 className="text-2xl font-bold">🎯 تحلیل و وزن‌دهی منابع</h1>
        <p className="text-muted-foreground">ارزیابی اعتبار و تأثیرگذاری منابع خبری</p>
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              منابع با تهدید بحرانی
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{kpis.critical}</div>
            <p className="text-xs text-muted-foreground">ضریب تهدید ≥ 2.0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              میانگین ضریب وایرال
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{kpis.avgViral}x</div>
            <p className="text-xs text-muted-foreground">توانایی وایرال‌سازی</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-600" />
              منابع دشمن
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{kpis.enemySources}</div>
            <p className="text-xs text-muted-foreground">ضدمحور مقاومت</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              PsyOp در 30 روز
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{kpis.total30d}</div>
            <p className="text-xs text-muted-foreground">از تمام منابع</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Threat Sources Chart */}
      <Card>
        <CardHeader>
          <CardTitle>⚠️ رتبه‌بندی منابع پرخطر</CardTitle>
          <CardDescription>Top 15 منبع با بیشترین امتیاز تهدید</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={topThreatSources} layout="vertical" margin={{ left: 150 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="source_name" type="category" width={140} />
              <Tooltip />
              <Bar dataKey="threat_score" fill="hsl(var(--destructive))">
                {topThreatSources.map((entry, index) => {
                  const source = sources.find(s => s.source_name === entry.source_name);
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={getThreatColor(source?.threat_multiplier || 1.0)}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>📊 جدول کامل منابع</CardTitle>
          <CardDescription>
            <div className="flex gap-4 mt-3">
              <div className="flex-1">
                <Input
                  placeholder="جستجوی منبع..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <select
                value={alignmentFilter}
                onChange={(e) => setAlignmentFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">همه جهت‌گیری‌ها</option>
                <option value="Anti-Resistance">ضد مقاومت</option>
                <option value="Western-Aligned">همسو با غرب</option>
                <option value="Neutral">بی‌طرف</option>
                <option value="Pro-Resistance">طرفدار مقاومت</option>
              </select>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-3">منبع</th>
                  <th className="text-right p-3">جهت‌گیری</th>
                  <th className="text-right p-3">دسترسی</th>
                  <th className="text-right p-3">اعتبار</th>
                  <th className="text-right p-3">ضریب وایرال</th>
                  <th className="text-right p-3">ضریب تهدید</th>
                  <th className="text-right p-3">PsyOp (30د)</th>
                  <th className="text-right p-3">کشور</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map(source => (
                  <tr key={source.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-medium">{source.source_name}</td>
                    <td className="p-3">
                      <Badge variant={getAlignmentBadge(source.political_alignment)}>
                        {source.political_alignment}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${source.reach_score}%` }}
                          />
                        </div>
                        <span className="text-sm">{source.reach_score}</span>
                      </div>
                    </td>
                    <td className="p-3">{source.credibility_score}/100</td>
                    <td className="p-3 font-bold text-purple-600">
                      {source.virality_coefficient.toFixed(1)}x
                    </td>
                    <td className="p-3">
                      <div className={`flex items-center gap-2 font-bold ${
                        source.threat_multiplier >= 2.0 ? 'text-red-600' :
                        source.threat_multiplier >= 1.5 ? 'text-orange-600' :
                        'text-gray-600'
                      }`}>
                        {source.threat_multiplier >= 2.0 && <AlertTriangle className="w-4 h-4" />}
                        {source.threat_multiplier.toFixed(1)}x
                      </div>
                    </td>
                    <td className="p-3 font-bold">{source.last_30days_psyop_count}</td>
                    <td className="p-3 text-sm text-muted-foreground">{source.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredSources.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              نتیجه‌ای یافت نشد
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
