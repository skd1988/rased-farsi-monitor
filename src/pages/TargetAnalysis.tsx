import React, { useState, useMemo, useEffect } from 'react';
import { translatePsyopTechnique } from '@/utils/psyopTranslations';
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
import { Loader2, Target as TargetIcon, Users, TrendingUp, AlertTriangle, Activity, Wand2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import AttackIntensityMatrix from '@/components/targets/AttackIntensityMatrix';
import EntityCard from '@/components/targets/EntityCard';
import PersonCard from '@/components/targets/PersonCard';
import InsightsPanel, { generateInsights } from '@/components/targets/InsightsPanel';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subDays } from 'date-fns';
import { faIR } from 'date-fns/locale';

console.log('🔴 [TargetAnalysis] FILE LOADED');

const TargetAnalysis = () => {
  console.log('🟡 [TargetAnalysis] FUNCTION CALLED');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('entities');
  const [posts, setPosts] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [targetProfiles, setTargetProfiles] = useState<any[]>([]);
  
  // Filters
  const [timeRange, setTimeRange] = useState('30d');
  const [entityType, setEntityType] = useState('All');
  const [location, setLocation] = useState('All');
  const [minAttacks, setMinAttacks] = useState([0]);
  const [personRole, setPersonRole] = useState('همه');
  const [categorizing, setCategorizing] = useState(false);

  // Mount effect
  useEffect(() => {
    console.log('🟢 [TargetAnalysis] COMPONENT MOUNTED!');
    console.log('🟢 [TargetAnalysis] Location:', window.location.href);

    return () => {
      console.log('🔵 [TargetAnalysis] COMPONENT UNMOUNTING');
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('📊 [TargetAnalysis] Fetching data...');
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

        // Fetch target profiles (for photos)
        const { data: profilesData, error: profilesError } = await supabase
          .from('target_profiles')
          .select('name_persian, name_english, name_arabic, photo_url, photo_source');

        if (profilesError) throw profilesError;

        setPosts(postsData || []);
        setEntities(entitiesData || []);
        setPersons(personsData || []);
        setTargetProfiles(profilesData || []);
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

  // Run automatic categorization
  const runCategorization = async () => {
    const confirmed = confirm(
      'این عملیات تمام اهداف موجود را دسته‌بندی می‌کند. ادامه می‌دهید؟'
    );
    
    if (!confirmed) return;
    
    setCategorizing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('categorize-targets');
      
      if (error) throw error;
      
      toast({
        title: "✅ دسته‌بندی تکمیل شد!",
        description: `${data.updated} پست به‌روز شد. ${data.alreadyCategorized} هدف قبلاً دسته‌بندی شده بود.`,
      });
      
      // Refresh all data (posts, persons, entities, profiles)
      const [postsResult, personsResult, entitiesResult, profilesResult] = await Promise.all([
        supabase
          .from('posts')
          .select('*')
          .eq('is_psyop', true)
          .order('published_at', { ascending: false }),
        supabase
          .from('resistance_persons')
          .select('*')
          .eq('active', true),
        supabase
          .from('resistance_entities')
          .select('*')
          .eq('active', true),
        supabase
          .from('target_profiles')
          .select('name_persian, name_english, name_arabic, photo_url, photo_source')
      ]);

      setPosts(postsResult.data || []);
      setPersons(personsResult.data || []);
      setEntities(entitiesResult.data || []);
      setTargetProfiles(profilesResult.data || []);
      
    } catch (error) {
      console.error('Categorization failed:', error);
      toast({
        title: "خطا در دسته‌بندی",
        description: error instanceof Error ? error.message : 'خطای نامشخص',
        variant: "destructive",
      });
    } finally {
      setCategorizing(false);
    }
  };

  // Process entity data - handles both string and object formats
  const entityStats = useMemo(() => {
    const stats = new Map();

    posts.forEach(post => {
      const targets: any[] = [];

      // 1) Add primary_target if present
      if (post.primary_target) {
        const rawName = String(post.primary_target).trim();
        if (rawName) {
          const matchedEntity = entities.find(e =>
            e.name_english === rawName || e.name_persian === rawName
          );

          const primaryParsed = {
            name_persian: matchedEntity?.name_persian || rawName,
            name_english: matchedEntity?.name_english || '',
            name_arabic: matchedEntity?.name_arabic || '',
          };

          targets.push(primaryParsed);
        }
      }

      // 2) Add legacy target_entity entries if present
      if (post.target_entity && Array.isArray(post.target_entity)) {
        targets.push(...post.target_entity);
      }

      // 3) Process all targets (new + legacy) with existing logic
      targets.forEach((entityName: any) => {
        // Parse entity - handle both string and object formats
        let parsedEntity = entityName;
        if (typeof entityName === 'string') {
          try {
            parsedEntity = JSON.parse(entityName);
          } catch {
            parsedEntity = { name_persian: entityName };
          }
        }

        // Extract names from parsed entity
        const namePersian = parsedEntity.name_persian?.trim() || '';
        const nameEnglish = parsedEntity.name_english?.trim() || '';
        const nameArabic = parsedEntity.name_arabic?.trim() || '';

        // Skip invalid names
        if (!namePersian && !nameEnglish && !nameArabic) {
          return;
        }

        if (namePersian === 'نامشخص' || namePersian === 'Unknown' ||
            nameEnglish === 'Unknown' || namePersian.includes('{')) {
          return;
        }

        // Find entity in resistance_entities table
        const entity = entities.find(e =>
          e.name_persian === namePersian ||
          e.name_english === nameEnglish
        );

        // Use the first available name as key
        const entityKey = namePersian || nameEnglish || nameArabic;
        const entityInfo = {
          name_persian: namePersian || entity?.name_persian || '',
          name_english: nameEnglish || entity?.name_english || '',
          name_arabic: nameArabic || entity?.name_arabic || '',
          entity_type: entity?.entity_type || 'Organization',
          location: entity?.location || 'نامشخص'
        };

        if (!stats.has(entityKey)) {
          stats.set(entityKey, {
            ...entityInfo,
            totalAttacks: 0,
            weekAttacks: 0,
            threatDistribution: { Critical: 0, High: 0, Medium: 0, Low: 0 },
            topVectors: new Map<string, number>(),
            timeline: Array(30).fill(0),

            // NEW: 3-level analysis counts
            quickOnlyCount: 0,
            deepCount: 0,
            deepestCount: 0,
            hasDeepest: false,
          });
        }

        const stat = stats.get(entityKey);

        // Total attacks
        stat.totalAttacks++;

        // Week attacks
        const weekAgo = subDays(new Date(), 7);
        if (new Date(post.published_at) >= weekAgo) {
          stat.weekAttacks++;
        }

        // NEW: 3-level stage counters for PsyOp posts
        if (post.is_psyop) {
          if (post.analysis_stage === 'quick') {
            stat.quickOnlyCount++;
          }
          if (post.analysis_stage === 'deep') {
            stat.deepCount++;
          }
          if (post.analysis_stage === 'deepest' || post.deepest_analysis_completed_at) {
            stat.deepestCount++;
            stat.hasDeepest = true;
          }
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
    });

    // Convert to array and process
    return Array.from(stats.values()).map(stat => {
      // Find matching photo from target_profiles
      const profile = targetProfiles.find(p =>
        (p.name_persian && stat.name_persian && p.name_persian === stat.name_persian) ||
        (p.name_english && stat.name_english && p.name_english === stat.name_english) ||
        (p.name_arabic && stat.name_arabic && p.name_arabic === stat.name_arabic)
      );

      return {
        ...stat,
        photo_url: profile?.photo_url,
        photo_source: profile?.photo_source,
        topVectors: Array.from(stat.topVectors.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([vector]) => translatePsyopTechnique(vector)),
        weekTrend: stat.weekAttacks > 0
          ? Math.round(((stat.weekAttacks - (stat.totalAttacks - stat.weekAttacks) / 4) / stat.weekAttacks) * 100)
          : 0,
      };
    }).sort((a, b) => b.totalAttacks - a.totalAttacks);
  }, [posts, entities, targetProfiles]);

  // Process person data - handles both string and object formats
  const personStats = useMemo(() => {
    const stats = new Map();
    
    // List of organization/entity keywords to filter out (not persons)
    const organizationKeywords = [
      'جمهوری اسلامی',
      'حماس',
      'حزب‌الله',
      'حزب الله',
      'انصارالله',
      'حشد',
      'حشدالشعبی',
      'سپاه',
      'ارتش',
      'جهاد اسلامی',
      'فلسطین',
      'لبنان',
      'ایران',
      'یمن',
      'عراق',
      'سوریه',
      'syria',
      'iran',
      'iraq',
      'lebanon',
      'palestine',
      'yemen',
      'hamas',
      'hezbollah',
      'pmu',
      'pmf'
    ];

    posts.forEach(post => {
      if (post.target_persons && Array.isArray(post.target_persons)) {
        post.target_persons.forEach((personName: any) => {
          // Parse person - handle both string and object formats
          let parsedPerson = personName;
          if (typeof personName === 'string') {
            try {
              parsedPerson = JSON.parse(personName);
            } catch {
              parsedPerson = { name_persian: personName };
            }
          }

          // Extract names from parsed person
          const namePersian = parsedPerson.name_persian?.trim() || '';
          const nameEnglish = parsedPerson.name_english?.trim() || '';
          const nameArabic = parsedPerson.name_arabic?.trim() || '';

          // Skip invalid names
          if (!namePersian && !nameEnglish && !nameArabic) {
            return;
          }

          if (namePersian === 'نامشخص' || namePersian === 'Unknown' ||
              nameEnglish === 'Unknown' || namePersian.includes('{')) {
            return;
          }

          // Filter out organization/entity names (not persons)
          const checkName = (namePersian || nameEnglish || nameArabic).toLowerCase();
          const isOrganization = organizationKeywords.some(keyword =>
            checkName.includes(keyword.toLowerCase())
          );

          if (isOrganization) {
            return; // Skip organizations
          }

          // Find person in resistance_persons table
          const person = persons.find(p =>
            p.name_persian === namePersian ||
            p.name_english === nameEnglish ||
            p.name_arabic === nameArabic
          );

          // Use the first available name as key
          const personKey = namePersian || nameEnglish || nameArabic;
          const personInfo = {
            name_persian: namePersian || person?.name_persian || '',
            name_english: nameEnglish || person?.name_english || '',
            name_arabic: nameArabic || person?.name_arabic || '',
            entity_type: 'Individual',
            position: person?.role || 'نامشخص',
            organization: person?.entity_id || 'نامشخص',
            category: person?.role || 'نامشخص',
            country: 'نامشخص',
            attack_nature: 'Personal'
          };
          
          if (!stats.has(personKey)) {
            stats.set(personKey, {
              ...personInfo,
              totalAttacks: 0,
              weekAttacks: 0,
              threatLevels: { Critical: 0, High: 0, Medium: 0, Low: 0 },
              topAccusations: new Map<string, number>(),
              narratives: new Map<string, number>(),
              sources: new Set<string>(),
              timeline: Array(14).fill(0),
              firstAttack: post.published_at,
              lastAttack: post.published_at,

              // NEW: 3-level analysis counts
              quickOnlyCount: 0,
              deepCount: 0,
              deepestCount: 0,
              hasDeepest: false,
            });
          }

          const stat = stats.get(personKey);

          // Total attacks
          stat.totalAttacks++;

          // Week attacks
          const weekAgo = subDays(new Date(), 7);
          if (new Date(post.published_at) >= weekAgo) {
            stat.weekAttacks++;
          }

          // NEW: 3-level stage counters for PsyOp posts
          if (post.is_psyop) {
            if (post.analysis_stage === 'quick') {
              stat.quickOnlyCount++;
            }
            if (post.analysis_stage === 'deep') {
              stat.deepCount++;
            }
            if (post.analysis_stage === 'deepest' || post.deepest_analysis_completed_at) {
              stat.deepestCount++;
              stat.hasDeepest = true;
            }
          }

          // Threat levels
          if (post.threat_level) {
            stat.threatLevels[post.threat_level]++;
          }

          // Accusations
          if (post.psyop_technique && Array.isArray(post.psyop_technique)) {
            post.psyop_technique.forEach((tech: string) => {
              stat.topAccusations.set(tech, (stat.topAccusations.get(tech) || 0) + 1);
            });
          }

          // Narratives
          if (post.narrative_theme) {
            stat.narratives.set(post.narrative_theme, (stat.narratives.get(post.narrative_theme) || 0) + 1);
          }

          // Sources
          stat.sources.add(post.source);

          // Last attack
          if (new Date(post.published_at) > new Date(stat.lastAttack)) {
            stat.lastAttack = post.published_at;
          }

          // Timeline
          const daysDiff = Math.floor((new Date().getTime() - new Date(post.published_at).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff < 14) {
            stat.timeline[13 - daysDiff]++;
          }
        });
      }
    });

    return Array.from(stats.values()).map(stat => {
      // Calculate risk score
      let riskScore = 0;
      riskScore += stat.totalAttacks * 5;
      riskScore += stat.threatLevels.Critical * 20;
      riskScore += stat.threatLevels.High * 10;
      riskScore += stat.threatLevels.Medium * 5;
      riskScore += stat.sources.size * 3;

      const daysSinceLastAttack = (Date.now() - new Date(stat.lastAttack).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastAttack < 7) riskScore += 30;
      else if (daysSinceLastAttack < 30) riskScore += 15;

      // Find matching photo from target_profiles
      const profile = targetProfiles.find(p =>
        (p.name_persian && stat.name_persian && p.name_persian === stat.name_persian) ||
        (p.name_english && stat.name_english && p.name_english === stat.name_english) ||
        (p.name_arabic && stat.name_arabic && p.name_arabic === stat.name_arabic)
      );

      return {
        ...stat,
        photo_url: profile?.photo_url,
        photo_source: profile?.photo_source,
        topAccusations: Array.from(stat.topAccusations.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([acc]) => translatePsyopTechnique(acc)),
        dominantNarrative: Array.from(stat.narratives.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'نامشخص',
        sources: Array.from(stat.sources),
        riskScore: Math.min(riskScore, 100),
        severity: riskScore >= 80 ? 'Critical' :
                  riskScore >= 50 ? 'High' :
                  riskScore >= 30 ? 'Medium' : 'Low',
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [posts, persons, targetProfiles]);

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
      .map(([name, count]) => ({ name: translatePsyopTechnique(name), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [posts]);

  // High priority persons
  const highPriorityPersons = personStats.filter(p => p.weekAttacks > 5);

  // Category statistics for persons
  const categoryStats = useMemo(() => {
    return {
      'همه': personStats.length,
      'رهبر سیاسی': personStats.filter(p => p.category === 'رهبر سیاسی').length,
      'فرمانده نظامی': personStats.filter(p => p.category === 'فرمانده نظامی').length,
      'مرجع دینی': personStats.filter(p => p.category === 'مرجع دینی').length,
      'سخنگو': personStats.filter(p => p.category === 'سخنگو').length,
      'فعال': personStats.filter(p => p.category === 'فعال').length,
      'نامشخص': personStats.filter(p => p.category === 'نامشخص').length,
    };
  }, [personStats]);

  // Filter persons by role
  const filteredPersons = useMemo(() => {
    if (personRole === 'همه') return personStats;
    return personStats.filter(p => p.category === personRole);
  }, [personStats, personRole]);

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
                  .map((entity) => (
                    <div
                      key={`${entity.name_persian}-${entity.name_english || ''}`}
                      className="space-y-1"
                    >
                      <EntityCard
                        entity={entity}
                        onExpand={() => {
                          toast({
                            title: "جزئیات نهاد",
                            description: entity.name_persian,
                          });
                        }}
                      />
                      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-3 pr-1">
                        <span>Quick: {entity.quickOnlyCount ?? 0}</span>
                        <span>Deep: {entity.deepCount ?? 0}</span>
                        <span>Deepest: {entity.deepestCount ?? 0}</span>
                        {entity.hasDeepest && (
                          <span className="font-bold text-red-500">
                            🔥 دارای حملات سطح بحران (Deepest)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </TabsContent>

            {/* Tab 2: Persons */}
            <TabsContent value="persons" className="space-y-6">
              {/* Category Statistics */}
              <div className="grid grid-cols-7 gap-3">
                {Object.entries(categoryStats).map(([category, count]) => (
                  <button
                    key={category}
                    onClick={() => setPersonRole(category)}
                    className={`
                      p-4 rounded-lg border-2 transition-all hover:shadow-md
                      ${personRole === category
                        ? 'border-primary bg-primary/10 shadow-lg'
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <div className="text-3xl font-bold mb-1">{count}</div>
                    <div className="text-xs font-medium">{category}</div>
                  </button>
                ))}
              </div>

              {/* Filters */}
              <Card className="p-4">
                <div className="flex flex-wrap gap-3 items-center">
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

                  <div className="flex-1" />

                  <Button
                    onClick={runCategorization}
                    disabled={categorizing}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    {categorizing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    دسته‌بندی خودکار اهداف
                  </Button>
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
                {filteredPersons.map((person) => (
                  <div
                    key={`${person.name_persian}-${person.name_english || ''}`}
                    className="space-y-1"
                  >
                    <PersonCard
                      person={person}
                      onViewDetails={() => {
                        toast({
                          title: "جزئیات فرد",
                          description: person.name_persian || person.name_english,
                        });
                      }}
                    />
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-3 pr-1">
                      <span>Quick: {person.quickOnlyCount ?? 0}</span>
                      <span>Deep: {person.deepCount ?? 0}</span>
                      <span>Deepest: {person.deepestCount ?? 0}</span>
                      {person.hasDeepest && (
                        <span className="font-bold text-red-500">
                          🔥 تحت حملات سطح بحران (Deepest)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filteredPersons.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  هیچ فردی در این دسته‌بندی یافت نشد
                </div>
              )}
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
