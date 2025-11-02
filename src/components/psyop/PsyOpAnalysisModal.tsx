import React, { useState } from 'react';
import { translatePsyopTechnique } from '@/utils/psyopTranslations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  X,
  MessageSquare,
  Download,
  Share2,
  ExternalLink,
  Target,
  Users,
  AlertTriangle,
  Shield,
  Flame,
  Clock,
  TrendingUp,
  FileText,
  Copy,
  ChevronDown,
  RefreshCw,
  XCircle,
  FolderPlus,
  CheckCircle2,
  Zap,
  Eye,
  Brain,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import ActivityTimeline from './ActivityTimeline';
import NotesSection from './NotesSection';

interface PsyOpAnalysisModalProps {
  post: any;
  isOpen: boolean;
  onClose: () => void;
}

const PsyOpAnalysisModal: React.FC<PsyOpAnalysisModalProps> = ({
  post,
  isOpen,
  onClose,
}) => {
  const [responseOpen, setResponseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Mock activity events - in production, fetch from database
  const mockActivityEvents = [
    {
      id: '1',
      type: 'detected' as const,
      timestamp: post?.published_at || new Date().toISOString(),
      details: 'جنگ روانی تشخیص داده شد',
    },
    {
      id: '2',
      type: 'status_change' as const,
      timestamp: new Date().toISOString(),
      user: 'سیستم',
      details: 'وضعیت تغییر کرد',
      status: 'Unresolved',
    },
  ];

  // Mock notes - in production, fetch from database
  const [notes, setNotes] = useState<any[]>([]);

  const handleAddNote = (content: string) => {
    const newNote = {
      id: Date.now().toString(),
      content,
      author: 'کاربر فعلی',
      timestamp: new Date().toISOString(),
    };
    setNotes([newNote, ...notes]);
    toast({
      title: "یادداشت اضافه شد",
      description: "یادداشت با موفقیت ذخیره شد",
    });
  };

  if (!post) return null;

  const threatColors = {
    Critical: { bg: 'bg-danger', text: 'text-white', icon: 'bg-danger/20' },
    High: { bg: 'bg-orange-600', text: 'text-white', icon: 'bg-orange-600/20' },
    Medium: { bg: 'bg-yellow-600', text: 'text-white', icon: 'bg-yellow-600/20' },
    Low: { bg: 'bg-success', text: 'text-white', icon: 'bg-success/20' },
  };

  const threatLevel = post.threat_level || 'Medium';
  const colors = threatColors[threatLevel as keyof typeof threatColors] || threatColors.Medium;

  const handleExport = () => {
    toast({
      title: "صادر کردن تحلیل",
      description: "این ویژگی به زودی اضافه خواهد شد",
    });
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: "لینک کپی شد",
      description: "لینک در کلیپبورد کپی شد",
    });
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "کپی شد",
      description: "متن در کلیپبورد کپی شد",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-2xl font-bold flex-1 text-right leading-relaxed">
              {post.title}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            {(post.urgency_level === 'Immediate' || post.urgency_level === 'High') && (
              <Button className="gap-2">
                <MessageSquare className="h-4 w-4" />
                آماده‌سازی پاسخ
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" />
              صادر کردن PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              اشتراک‌گذاری
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* SECTION 1: POST DETAILS */}
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              جزئیات مطلب
            </h3>
            
            <div className="prose prose-sm max-w-none" dir="rtl">
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {post.contents || 'محتوای کامل در دسترس نیست'}
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">منبع</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-base">
                    {post.source}
                  </Badge>
                  {post.source_url && (
                    <a 
                      href={post.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">تاریخ انتشار</span>
                <div className="text-base font-medium">
                  {format(new Date(post.published_at), 'PPPp', { locale: faIR })}
                </div>
              </div>

              {post.source_credibility && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">اعتبار منبع</span>
                  <Badge 
                    className={cn(
                      'text-base',
                      post.source_credibility === 'Known Enemy Source' && 'bg-danger text-white'
                    )}
                  >
                    {post.source_credibility}
                  </Badge>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">زبان</span>
                <Badge variant="secondary" className="text-base">
                  {post.language}
                </Badge>
              </div>
            </div>

            {post.keywords && Array.isArray(post.keywords) && post.keywords.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">کلمات کلیدی</span>
                <div className="flex flex-wrap gap-2">
                  {post.keywords.map((keyword: string, idx: number) => (
                    <Badge key={idx} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* SECTION 2: PSYOP ASSESSMENT */}
          <Card className="p-6 space-y-4 bg-danger/5 border-danger">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-danger/20 rounded-lg">
                <AlertTriangle className="h-8 w-8 text-danger" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-danger">
                  عملیات جنگ روانی تشخیص داده شد
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  تشخیص داده شده توسط سیستم هوش مصنوعی
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 text-center">
                <div className="text-sm text-muted-foreground mb-2">میزان اطمینان</div>
                <div className="relative inline-flex items-center justify-center w-24 h-24">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      className="text-muted stroke-current"
                      strokeWidth="10"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                    />
                    <circle
                      className="text-danger stroke-current"
                      strokeWidth="10"
                      strokeLinecap="round"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      strokeDasharray={`${((post.psyop_confidence || 0) / 100) * 251.2} 251.2`}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <span className="absolute text-2xl font-bold">
                    {post.psyop_confidence || 0}%
                  </span>
                </div>
              </Card>

              <Card className="p-4 text-center">
                <div className="text-sm text-muted-foreground mb-2">نوع عملیات</div>
                <Badge className="text-lg px-4 py-2 bg-danger text-white mt-4">
                  {post.psyop_type || 'نامشخص'}
                </Badge>
              </Card>

              <Card className="p-4 text-center">
                <div className="text-sm text-muted-foreground mb-2">زمان تشخیص</div>
                <div className="text-sm mt-4">
                  {post.analyzed_at 
                    ? format(new Date(post.analyzed_at), 'PPp', { locale: faIR })
                    : 'نامشخص'}
                </div>
              </Card>
            </div>
          </Card>

          {/* SECTION 3: TARGET ANALYSIS */}
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-danger" />
              تحلیل اهداف
            </h3>

            {post.target_entity && Array.isArray(post.target_entity) && post.target_entity.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground mb-2 block">هدف اصلی</span>
                  <Card className="p-4 bg-danger/10 border-danger">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-danger/20 rounded-lg">
                        <Target className="h-6 w-6 text-danger" />
                      </div>
                      <div>
                        <div className="text-xl font-bold">{post.target_entity[0]}</div>
                        {post.target_category && (
                          <Badge variant="outline" className="mt-1">
                            {post.target_category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>

                {post.target_entity.length > 1 && (
                  <div>
                    <span className="text-sm text-muted-foreground mb-2 block">اهداف ثانویه</span>
                    <div className="grid grid-cols-3 gap-2">
                      {post.target_entity.slice(1).map((entity: string, idx: number) => (
                        <Card key={idx} className="p-3 text-center">
                          <div className="font-medium">{entity}</div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">اطلاعات هدف در دسترس نیست</p>
            )}

            {post.target_persons && Array.isArray(post.target_persons) && post.target_persons.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground mb-2 block">افراد هدف</span>
                <div className="flex flex-wrap gap-2">
                  {post.target_persons.map((person: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="gap-2">
                      <Users className="h-3 w-3" />
                      {person}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* SECTION 4: ATTACK ANALYSIS */}
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-600" />
              تحلیل حمله
            </h3>

            {post.psyop_technique && Array.isArray(post.psyop_technique) && post.psyop_technique.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground mb-2 block">بردارهای حمله</span>
                <div className="space-y-2">
                  {post.psyop_technique.map((technique: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium">{translatePsyopTechnique(technique)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {post.narrative_theme && (
              <div>
                <span className="text-sm text-muted-foreground mb-2 block">موضوع روایت</span>
                <Badge className="text-base px-4 py-2 bg-orange-600 text-white">
                  {post.narrative_theme}
                </Badge>
              </div>
            )}

            {post.evidence_type && Array.isArray(post.evidence_type) && post.evidence_type.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground mb-2 block">نوع شواهد</span>
                <div className="flex flex-wrap gap-2">
                  {post.evidence_type.map((type: string, idx: number) => (
                    <Badge key={idx} variant="destructive">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* SECTION 5: THREAT ASSESSMENT */}
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              ارزیابی تهدید
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <Card className={cn('p-6 text-center', colors.bg, colors.text)}>
                <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                <div className="text-sm mb-1">سطح تهدید</div>
                <div className="text-3xl font-bold">{threatLevel}</div>
              </Card>

              <Card className="p-6 text-center">
                <Flame className="h-12 w-12 mx-auto mb-2 text-orange-600" />
                <div className="text-sm text-muted-foreground mb-2">پتانسیل ویروس</div>
                <div className="text-2xl font-bold">{post.virality_potential || 0}/10</div>
                <Progress value={(post.virality_potential || 0) * 10} className="mt-2" />
              </Card>

              <Card className="p-6 text-center">
                <Clock className="h-12 w-12 mx-auto mb-2 text-primary" />
                <div className="text-sm text-muted-foreground mb-2">فوریت</div>
                <Badge className="text-base">
                  {post.urgency_level || 'متوسط'}
                </Badge>
              </Card>
            </div>
          </Card>

          {/* SECTION 6: COORDINATION INDICATORS */}
          {post.coordination_indicators && Array.isArray(post.coordination_indicators) && post.coordination_indicators.length > 0 && (
            <Card className="p-6 space-y-4 bg-orange-600/5 border-orange-600">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-600/20 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-orange-600">
                    نشانه‌های هماهنگی کمپین تشخیص داده شد
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    این محتوا احتمالاً بخشی از یک کمپین هماهنگ است
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {post.coordination_indicators.map((indicator: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-background rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <span>{indicator}</span>
                  </div>
                ))}
              </div>

              {post.campaign_indicators?.campaign_name_suggestion && (
                <div>
                  <span className="text-sm text-muted-foreground mb-2 block">نام پیشنهادی کمپین</span>
                  <Badge variant="secondary" className="text-base px-4 py-2">
                    {post.campaign_indicators.campaign_name_suggestion}
                  </Badge>
                </div>
              )}
            </Card>
          )}

          {/* SECTION 7: AI SUMMARY */}
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              خلاصه و تحلیل هوش مصنوعی
            </h3>

            {post.analysis_summary && (
              <div className="prose prose-sm max-w-none" dir="rtl">
                <p className="text-base leading-relaxed">{post.analysis_summary}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {post.sentiment && (
                <div>
                  <span className="text-sm text-muted-foreground">احساسات</span>
                  <Badge variant="secondary" className="mt-1">
                    {post.sentiment}
                  </Badge>
                </div>
              )}

              {post.main_topic && (
                <div>
                  <span className="text-sm text-muted-foreground">موضوع اصلی</span>
                  <Badge variant="secondary" className="mt-1">
                    {post.main_topic}
                  </Badge>
                </div>
              )}
            </div>
          </Card>

          {/* SECTION 8: RECOMMENDED RESPONSE */}
          {post.recommended_response && (
            <Collapsible open={responseOpen} onOpenChange={setResponseOpen}>
              <Card className="p-6 space-y-4">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      استراتژی پاسخ پیشنهادی
                    </h3>
                    <ChevronDown className={cn(
                      'h-5 w-5 transition-transform',
                      responseOpen && 'transform rotate-180'
                    )} />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-4">
                  <div className="prose prose-sm max-w-none p-4 bg-muted/30 rounded-lg" dir="rtl">
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {post.recommended_response}
                    </p>
                  </div>

                  {post.counter_narrative_points && Array.isArray(post.counter_narrative_points) && post.counter_narrative_points.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground mb-2 block">نکات روایت مقابل</span>
                      <div className="space-y-2">
                        {post.counter_narrative_points.map((point: string, idx: number) => (
                          <Card key={idx} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <span className="font-bold text-primary ml-2">{idx + 1}.</span>
                                {point}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyText(point)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {post.suggested_spokespeople && Array.isArray(post.suggested_spokespeople) && post.suggested_spokespeople.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground mb-2 block">سخنگویان پیشنهادی</span>
                      <div className="flex flex-wrap gap-2">
                        {post.suggested_spokespeople.map((person: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="gap-2">
                            <Users className="h-3 w-3" />
                            {person}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {post.response_channels && Array.isArray(post.response_channels) && post.response_channels.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground mb-2 block">کانال‌های پاسخ</span>
                      <div className="flex flex-wrap gap-2">
                        {post.response_channels.map((channel: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {channel}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* SECTION 9: METADATA */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">تحلیل کامل</TabsTrigger>
              <TabsTrigger value="activity">تاریخچه فعالیت</TabsTrigger>
              <TabsTrigger value="notes">یادداشت‌ها</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              <Card className="p-4 bg-muted/30">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">مدل تحلیل</span>
                    <div className="font-medium">{post.analysis_model || 'DeepSeek'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">زمان پردازش</span>
                    <div className="font-medium">
                      {post.processing_time ? `${post.processing_time.toFixed(2)}s` : 'نامشخص'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">تاریخ تحلیل</span>
                    <div className="font-medium">
                      {post.analyzed_at 
                        ? format(new Date(post.analyzed_at), 'PP', { locale: faIR })
                        : 'نامشخص'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">آخرین به‌روزرسانی</span>
                    <div className="font-medium">
                      {format(new Date(post.updated_at || post.created_at), 'PP', { locale: faIR })}
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <History className="h-5 w-5" />
                  تاریخچه فعالیت
                </h3>
                <ActivityTimeline events={mockActivityEvents} />
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-6">
              <Card className="p-6">
                <NotesSection notes={notes} onAddNote={handleAddNote} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* FOOTER */}
        <div className="flex gap-2 pt-6 border-t">
          <Button className="flex-1 gap-2">
            <MessageSquare className="h-4 w-4" />
            شروع آماده‌سازی پاسخ
          </Button>
          <Button variant="outline" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            افزودن به کمپین
          </Button>
          <Button variant="outline" className="gap-2">
            <XCircle className="h-4 w-4" />
            مثبت کاذب
          </Button>
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            تحلیل مجدد
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PsyOpAnalysisModal;
