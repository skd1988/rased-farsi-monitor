import React, { useState, useEffect } from 'react';
import { translatePsyopTechnique } from '@/utils/psyopTranslations';
import { Shield, AlertTriangle, Plus, List, Columns3, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ResponsePreparationModal from '@/components/response/ResponsePreparationModal';
import ResponseCard from '@/components/response/ResponseCard';
import TemplateCard from '@/components/response/TemplateCard';
import ResponseAnalytics from '@/components/response/ResponseAnalytics';
import { supabase } from '@/integrations/supabase/client';

interface PendingResponse {
  id: string;
  postId: string;
  title: string;
  targetEntity: string;
  threatLevel: string;
  urgency: 'Immediate' | 'High' | 'Medium' | 'Low';
  detectedAt: Date;
  psyopType: string;
}

const ResponseManagement = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingResponses, setPendingResponses] = useState<PendingResponse[]>([]);
  const [urgentCount, setUrgentCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');

  useEffect(() => {
    fetchPendingResponses();
  }, []);

  const fetchPendingResponses = async () => {
    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          *,
          ai_analysis (*)
        `)
        .eq('is_psyop', true)
        .in('threat_level', ['Critical', 'High'])
        .neq('status', 'حل شده')
        .order('published_at', { ascending: false });

      if (error) throw error;

      const responses: PendingResponse[] = (posts || []).map(post => {
        const hoursSince = Math.floor((Date.now() - new Date(post.published_at).getTime()) / (1000 * 60 * 60));
        let urgency: 'Immediate' | 'High' | 'Medium' | 'Low' = 'Low';
        
        if (post.threat_level === 'Critical' && hoursSince < 2) urgency = 'Immediate';
        else if (post.threat_level === 'Critical' || hoursSince < 24) urgency = 'High';
        else if (hoursSince < 48) urgency = 'Medium';

        return {
          id: post.id,
          postId: post.id,
          title: post.title,
          targetEntity: post.target_entity?.[0] || 'Unknown',
          threatLevel: post.threat_level,
          urgency,
          detectedAt: new Date(post.published_at),
          psyopType: translatePsyopTechnique(post.psyop_technique?.[0] || 'Unknown')
        };
      });

      setPendingResponses(responses);
      setUrgentCount(responses.filter(r => r.urgency === 'Immediate').length);
    } catch (error) {
      console.error('Error fetching pending responses:', error);
    }
  };

  const handleStartResponse = (response: PendingResponse) => {
    supabase
      .from('posts')
      .select('*, ai_analysis (*)')
      .eq('id', response.postId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSelectedPost(data);
          setModalOpen(true);
        }
      });
  };

  const filteredResponses = pendingResponses.filter(response => {
    const matchesSearch = response.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         response.targetEntity.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUrgency = urgencyFilter === 'all' || response.urgency === urgencyFilter;
    return matchesSearch && matchesUrgency;
  });

  const getUrgencyBadgeVariant = (urgency: string) => {
    switch (urgency) {
      case 'Immediate': return 'destructive';
      case 'High': return 'destructive';
      case 'Medium': return 'default';
      default: return 'secondary';
    }
  };

  const getTimeRemaining = (detectedAt: Date, urgency: string) => {
    const hoursSince = Math.floor((Date.now() - detectedAt.getTime()) / (1000 * 60 * 60));
    let deadline = 0;
    
    if (urgency === 'Immediate') deadline = 2;
    else if (urgency === 'High') deadline = 24;
    else if (urgency === 'Medium') deadline = 48;
    else deadline = 168;

    const remaining = deadline - hoursSince;
    if (remaining <= 0) return 'متأخر';
    if (remaining < 1) return `${Math.floor(remaining * 60)} دقیقه`;
    if (remaining < 24) return `${remaining} ساعت`;
    return `${Math.floor(remaining / 24)} روز`;
  };

  const kanbanColumns = {
    Immediate: filteredResponses.filter(r => r.urgency === 'Immediate'),
    High: filteredResponses.filter(r => r.urgency === 'High'),
    Medium: filteredResponses.filter(r => r.urgency === 'Medium'),
    Low: filteredResponses.filter(r => r.urgency === 'Low')
  };

  const oldestPending = pendingResponses.length > 0 
    ? Math.floor((Date.now() - Math.min(...pendingResponses.map(r => r.detectedAt.getTime()))) / (1000 * 60 * 60))
    : 0;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            مدیریت پاسخ‌ها
          </h1>
          <p className="text-muted-foreground mt-1">آماده‌سازی و رصد روایت‌های متقابل</p>
        </div>
      </div>

      {/* Priority Alert Bar */}
      {urgentCount > 0 && (
        <Alert variant="destructive" className="border-2">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <span className="font-bold text-lg">⚠️ {urgentCount} مورد نیاز به پاسخ فوری دارد</span>
              <span className="mr-4">قدیمی‌ترین معلق: {oldestPending} ساعت پیش</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setUrgencyFilter('Immediate')}>
              مشاهده موارد فوری
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending" className="gap-2">
            پاسخ‌های معلق
            {urgentCount > 0 && (
              <Badge variant="destructive" className="mr-2">{urgentCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">پاسخ‌های فعال</TabsTrigger>
          <TabsTrigger value="templates">قالب‌های پاسخ</TabsTrigger>
          <TabsTrigger value="analytics">تحلیل‌ها</TabsTrigger>
        </TabsList>

        {/* Tab 1: Pending Responses */}
        <TabsContent value="pending" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Input
                  placeholder="جستجو در پاسخ‌های معلق..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs"
                />
                <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="فوریت" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه</SelectItem>
                    <SelectItem value="Immediate">فوری (&lt;2 ساعت)</SelectItem>
                    <SelectItem value="High">بالا (امروز)</SelectItem>
                    <SelectItem value="Medium">متوسط (48 ساعت)</SelectItem>
                    <SelectItem value="Low">کم (این هفته)</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="mr-auto flex gap-2">
                  <Button
                    variant={viewMode === 'kanban' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('kanban')}
                  >
                    <Columns3 className="w-4 h-4 ml-2" />
                    کانبان
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4 ml-2" />
                    لیست
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(kanbanColumns).map(([urgency, responses]) => (
                <div key={urgency} className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="font-semibold">
                      {urgency === 'Immediate' && 'فوری (<2 ساعت)'}
                      {urgency === 'High' && 'بالا (امروز)'}
                      {urgency === 'Medium' && 'متوسط (48 ساعت)'}
                      {urgency === 'Low' && 'کم (این هفته)'}
                    </span>
                    <Badge variant={getUrgencyBadgeVariant(urgency)}>
                      {responses.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {responses.map((response) => (
                      <Card key={response.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                        <CardContent className="p-4 space-y-3">
                          <h4 className="font-semibold line-clamp-2">{response.title}</h4>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{response.targetEntity}</Badge>
                            <Badge variant={response.threatLevel === 'Critical' ? 'destructive' : 'default'}>
                              {response.threatLevel}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            زمان باقیمانده: {getTimeRemaining(response.detectedAt, response.urgency)}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleStartResponse(response)}
                          >
                            شروع پاسخ
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-right">عنوان</th>
                        <th className="p-3 text-right">هدف</th>
                        <th className="p-3 text-right">سطح تهدید</th>
                        <th className="p-3 text-right">فوریت</th>
                        <th className="p-3 text-right">زمان باقیمانده</th>
                        <th className="p-3 text-right">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResponses.map((response) => (
                        <tr key={response.id} className="border-t hover:bg-muted/50">
                          <td className="p-3 max-w-md">
                            <div className="line-clamp-2">{response.title}</div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{response.targetEntity}</Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={response.threatLevel === 'Critical' ? 'destructive' : 'default'}>
                              {response.threatLevel}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={getUrgencyBadgeVariant(response.urgency)}>
                              {response.urgency}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm">
                            {getTimeRemaining(response.detectedAt, response.urgency)}
                          </td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              onClick={() => handleStartResponse(response)}
                            >
                              شروع پاسخ
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Active Responses */}
        <TabsContent value="active" className="space-y-4">
          <div className="grid gap-4">
            <ResponseCard
              status="drafted"
              title="پاسخ به اتهام تروریسم علیه حزب‌الله"
              assignedTeam={['احمد رضایی', 'فاطمه کریمی']}
              channels={['بیانیه رسمی', 'شبکه‌های اجتماعی']}
            />
            <ResponseCard
              status="under-review"
              title="پاسخ به ادعای نقض حقوق بشر"
              assignedTeam={['محمد علوی']}
              channels={['کنفرانس مطبوعاتی']}
            />
          </div>
        </TabsContent>

        {/* Tab 3: Response Templates */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">کتابخانه قالب‌ها</h2>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              ایجاد قالب جدید
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TemplateCard
              title="پاسخ به برچسب تروریسم"
              category="برچسب‌زنی تروریسم"
              usageCount={24}
              lastUsed="2 روز پیش"
            />
            <TemplateCard
              title="پاسخ به اتهام نقض حقوق بشر"
              category="اتهامات حقوق بشری"
              usageCount={18}
              lastUsed="1 هفته پیش"
            />
            <TemplateCard
              title="پاسخ به ادعای فساد"
              category="اتهامات فساد"
              usageCount={12}
              lastUsed="3 روز پیش"
            />
          </div>
        </TabsContent>

        {/* Tab 4: Analytics */}
        <TabsContent value="analytics">
          <ResponseAnalytics />
        </TabsContent>
      </Tabs>

      {/* Response Preparation Modal */}
      <ResponsePreparationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        post={selectedPost}
      />
    </div>
  );
};

export default ResponseManagement;
