import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Target as TargetIcon, Users, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import AttackIntensityMatrix from '@/components/targets/AttackIntensityMatrix';
import EntityCard from '@/components/targets/EntityCard';
import PersonCard from '@/components/targets/PersonCard';
import InsightsPanel, { generateInsights } from '@/components/targets/InsightsPanel';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subDays } from 'date-fns';
import { faIR } from 'date-fns/locale';

const TargetAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('entities');
  const [posts, setPosts] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  
  // Filters
  const [timeRange, setTimeRange] = useState('30d');
  const [entityType, setEntityType] = useState('All');
  const [location, setLocation] = useState('All');
  const [minAttacks, setMinAttacks] = useState([0]);
  const [personRole, setPersonRole] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch posts with PsyOp data
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('is_psyop', true)
          .order('published_at', { ascending: false });
        
        if (postsError) throw postsError;

        // Fetch entities
        const { data: entitiesData, error: entitiesError } = await supabase
          .from('resistance_entities')
          .select('*')
          .eq('active', true);
        
        if (entitiesError) throw entitiesError;

        // Fetch persons
        const { data: personsData, error: personsError } = await supabase
          .from('resistance_persons')
          .select('*')
          .eq('active', true);
        
        if (personsError) throw personsError;

        setPosts(postsData || []);
        setEntities(entitiesData || []);
        setPersons(personsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "خطا در دریافت داده‌ها",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Process entity data
  const entityStats = useMemo(() => {
    const stats = new Map();

    posts.forEach(post => {
      if (post.target_entity && Array.isArray(post.target_entity)) {
        post.target_entity.forEach((entityName: string) => {
          const entity = entities.find(e => e.name_persian === entityName);
          if (!entity) return;

          if (!stats.has(entityName)) {
            stats.set(entityName, {
              ...entity,
              totalAttacks: 0,
              weekAttacks: 0,
              threatDistribution: { Critical: 0, High: 0, Medium: 0, Low: 0 },
              topVectors: new Map(),
              timeline: Array(30).fill(0),
            });
          }

          const stat = stats.get(entityName);
          stat.totalAttacks++;

          // Week attacks
          const weekAgo = subDays(new Date(), 7);
          if (new Date(post.published_at) >= weekAgo) {
            stat.weekAttacks++;
          }

          // Threat distribution
          if (post.threat_level) {
            stat.threatDistribution[post.threat_level]++;
          }

          // Top vectors
          if (post.psyop_technique && Array.isArray(post.psyop_technique)) {
            post.psyop_technique.forEach((tech: string) => {
              stat.topVectors.set(tech, (stat.topVectors.get(tech) || 0) + 1);
            });
          }

          // Timeline
          const daysDiff = Math.floor((new Date().getTime() - new Date(post.published_at).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff < 30) {
            stat.timeline[29 - daysDiff]++;
          }
        });
      }
    });

    // Convert to array and process
    return Array.from(stats.values()).map(stat => ({
      ...stat,
      topVectors: Array.from(stat.topVectors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([vector]) => vector),
      weekTrend: stat.weekAttacks > 0 
        ? Math.round(((stat.weekAttacks - (stat.totalAttacks - stat.weekAttacks) / 4) / stat.weekAttacks) * 100)
        : 0,
    })).sort((a, b) => b.totalAttacks - a.totalAttacks);
  }, [posts, entities]);

  // Process person data
  const personStats = useMemo(() => {
    const stats = new Map();

    posts.forEach(post => {
      if (post.target_persons && Array.isArray(post.target_persons)) {
        post.target_persons.forEach((personName: string) => {
          const person = persons.find(p => p.name_persian === personName);
          
          if (!stats.has(personName)) {
            stats.set(personName, {
              name_persian: personName,
              name_english: person?.name_english,
              role: person?.role || 'Unknown',
              entity: person?.entity_id || 'Unknown',
              totalAttacks: 0,
              weekAttacks: 0,
              topAccusations: new Map(),
              timeline: Array(14).fill(0),
            });
          }

          const stat = stats.get(personName);
          stat.totalAttacks++;

          const weekAgo = subDays(new Date(), 7);
          if (new Date(post.published_at) >= weekAgo) {
            stat.weekAttacks++;
          }

          // Accusations
          if (post.psyop_technique && Array.isArray(post.psyop_technique)) {
            post.psyop_technique.forEach((tech: string) => {
              stat.topAccusations.set(tech, (stat.topAccusations.get(tech) || 0) + 1);
            });
          }

          // Timeline
          const daysDiff = Math.floor((new Date().getTime() - new Date(post.published_at).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff < 14) {
            stat.timeline[13 - daysDiff]++;
          }
        });
      }
    });

    return Array.from(stats.values()).map(stat => ({
      ...stat,
      topAccusations: Array.from(stat.topAccusations.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([acc]) => acc),
      severity: stat.totalAttacks > 20 ? 'Critical' :
                stat.totalAttacks > 10 ? 'High' :
                stat.totalAttacks > 5 ? 'Medium' : 'Low',
    })).sort((a, b) => b.totalAttacks - a.totalAttacks);
  }, [posts, persons]);

  // Attack vector data
  const attackVectorData = useMemo(() => {
    const vectors = new Map();
    posts.forEach(post => {
      if (post.psyop_technique && Array.isArray(post.psyop_technique)) {
        post.psyop_technique.forEach((tech: string) => {
          vectors.set(tech, (vectors.get(tech) || 0) + 1);
        });
      }
    });

    return Array.from(vectors.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [posts]);

  // High priority persons
  const highPriorityPersons = personStats.filter(p => p.weekAttacks > 5);

  // Generate insights
  const insights = generateInsights({ entityStats, personStats, posts });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TargetIcon className="h-8 w-8 text-danger" />
          تحلیل اهداف
        </h1>
        <p className="text-muted-foreground mt-1">
          شناسایی نهادها و افراد تحت حمله جنگ روانی
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="entities" className="flex-1">
                نهادهای تحت حمله
              </TabsTrigger>
              <TabsTrigger value="persons" className="flex-1">
                افراد تحت حمله
              </TabsTrigger>
              <TabsTrigger value="patterns" className="flex-1">
                الگوهای حمله
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Entities */}
            <TabsContent value="entities" className="space-y-6">
              {/* Filters */}
              <Card className="p-4">
                <div className="flex flex-wrap gap-3">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">۲۴ ساعت</SelectItem>
                      <SelectItem value="7d">۷ روز</SelectItem>
                      <SelectItem value="30d">۳۰ روز</SelectItem>
                      <SelectItem value="90d">۹۰ روز</SelectItem>
                      <SelectItem value="all">همه زمان</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={entityType} onValueChange={setEntityType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="نوع نهاد" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">همه</SelectItem>
                      <SelectItem value="Country">کشور</SelectItem>
                      <SelectItem value="Organization">سازمان</SelectItem>
                      <SelectItem value="Movement">جنبش</SelectItem>
                      <SelectItem value="Political Party">حزب سیاسی</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="موقعیت" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">همه</SelectItem>
                      <SelectItem value="Iran">ایران</SelectItem>
                      <SelectItem value="Iraq">عراق</SelectItem>
                      <SelectItem value="Lebanon">لبنان</SelectItem>
                      <SelectItem value="Yemen">یمن</SelectItem>
                      <SelectItem value="Palestine">فلسطین</SelectItem>
                      <SelectItem value="Syria">سوریه</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">حداقل حملات:</span>
                    <Slider
                      value={minAttacks}
                      onValueChange={setMinAttacks}
                      min={0}
                      max={50}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium min-w-[30px]">{minAttacks[0]}</span>
                  </div>
                </div>
              </Card>

              {/* Attack Intensity Matrix */}
              <AttackIntensityMatrix
                data={entityStats.slice(0, 10).map(entity => ({
                  entity: entity.name_persian,
                  periods: Array.from({ length: 30 }, (_, i) => {
                    const date = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
                    return {
                      date,
                      count: entity.timeline[i] || 0,
                    };
                  }),
                }))}
                onCellClick={(entity, date) => {
                  toast({
                    title: "مطالب در این تاریخ",
                    description: `${entity} - ${format(new Date(date), 'PP', { locale: faIR })}`,
                  });
                }}
              />

              {/* Entity Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entityStats
                  .filter(e => e.totalAttacks >= minAttacks[0])
                  .filter(e => entityType === 'All' || e.entity_type === entityType)
                  .filter(e => location === 'All' || e.location === location)
                  .map((entity, idx) => (
                    <EntityCard
                      key={idx}
                      entity={entity}
                      onExpand={() => {
                        toast({
                          title: "جزئیات نهاد",
                          description: entity.name_persian,
                        });
                      }}
                    />
                  ))}
              </div>
            </TabsContent>

            {/* Tab 2: Persons */}
            <TabsContent value="persons" className="space-y-6">
              {/* Filters */}
              <Card className="p-4">
                <div className="flex flex-wrap gap-3">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">۲۴ ساعت</SelectItem>
                      <SelectItem value="7d">۷ روز</SelectItem>
                      <SelectItem value="30d">۳۰ روز</SelectItem>
                      <SelectItem value="90d">۹۰ روز</SelectItem>
                      <SelectItem value="all">همه زمان</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={personRole} onValueChange={setPersonRole}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="نقش" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">همه</SelectItem>
                      <SelectItem value="Political Leader">رهبر سیاسی</SelectItem>
                      <SelectItem value="Military Commander">فرمانده نظامی</SelectItem>
                      <SelectItem value="Religious Authority">مرجع دینی</SelectItem>
                      <SelectItem value="Spokesperson">سخنگو</SelectItem>
                      <SelectItem value="Activist">فعال</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              {/* High Priority Alert */}
              {highPriorityPersons.length > 0 && (
                <Card className="p-6 bg-danger/5 border-danger">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="h-6 w-6 text-danger" />
                    <h3 className="text-lg font-semibold text-danger">
                      اهداف پرخطر تحت حمله هماهنگ
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {highPriorityPersons.map((person, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="font-semibold">{person.name_persian}</div>
                        <div className="text-sm text-muted-foreground">{person.role}</div>
                        <Badge variant="destructive" className="mt-2">
                          {person.weekAttacks} حمله این هفته
                        </Badge>
                      </Card>
                    ))}
                  </div>
                </Card>
              )}

              {/* Person Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {personStats
                  .filter(p => personRole === 'All' || p.role === personRole)
                  .map((person, idx) => (
                    <PersonCard
                      key={idx}
                      person={person}
                      onViewDetails={() => {
                        toast({
                          title: "جزئیات فرد",
                          description: person.name_persian,
                        });
                      }}
                    />
                  ))}
              </div>
            </TabsContent>

            {/* Tab 3: Attack Patterns */}
            <TabsContent value="patterns" className="space-y-6">
              {/* Attack Vectors */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">تحلیل بردارهای حمله</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attackVectorData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#DC2626" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Timeline */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">روند حملات (۳۰ روز اخیر)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart
                    data={Array.from({ length: 30 }, (_, i) => {
                      const date = subDays(new Date(), 29 - i);
                      const count = posts.filter(p => {
                        const postDate = new Date(p.published_at);
                        return postDate.toDateString() === date.toDateString();
                      }).length;
                      return {
                        date: format(date, 'MM/dd'),
                        count,
                      };
                    })}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#DC2626" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Insights Panel */}
        <div className="lg:col-span-1">
          <InsightsPanel insights={insights} />
        </div>
      </div>
    </div>
  );
};

export default TargetAnalysis;
