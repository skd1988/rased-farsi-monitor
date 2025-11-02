import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Upload, Save, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ResponsePreparationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: any;
}

const ResponsePreparationModal = ({ open, onOpenChange, post }: ResponsePreparationModalProps) => {
  const { toast } = useToast();
  const [counterPoints, setCounterPoints] = useState<string[]>([
    'توضیح واقعیت موضوع',
    'ارائه شواهد و مستندات',
    'تاریخچه موضوع'
  ]);
  const [newPoint, setNewPoint] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('official');

  if (!post) return null;

  const aiAnalysis = post.ai_analysis?.[0];

  const addCounterPoint = () => {
    if (newPoint.trim()) {
      setCounterPoints([...counterPoints, newPoint]);
      setNewPoint('');
    }
  };

  const removeCounterPoint = (index: number) => {
    setCounterPoints(counterPoints.filter((_, i) => i !== index));
  };

  const handleSaveDraft = () => {
    toast({
      title: 'پیش‌نویس ذخیره شد',
      description: 'پاسخ به عنوان پیش‌نویس ذخیره شد'
    });
  };

  const handleSubmitForReview = () => {
    toast({
      title: 'ارسال برای بررسی',
      description: 'پاسخ برای بررسی و تأیید ارسال شد'
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl">آماده‌سازی پاسخ</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="summary" dir="rtl" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="summary">خلاصه تهدید</TabsTrigger>
            <TabsTrigger value="narrative">روایت متقابل</TabsTrigger>
            <TabsTrigger value="evidence">شواهد</TabsTrigger>
            <TabsTrigger value="strategy">استراتژی</TabsTrigger>
            <TabsTrigger value="draft">پیش‌نویس محتوا</TabsTrigger>
          </TabsList>

          {/* Tab 1: Threat Summary */}
          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>محتوای پست</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">{post.contents || post.title}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>تحلیل جنگ روانی</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="destructive">{post.threat_level}</Badge>
                  <Badge>{aiAnalysis?.psyop_type || 'نامشخص'}</Badge>
                  <Badge variant="outline">{aiAnalysis?.narrative_theme || 'نامشخص'}</Badge>
                </div>
                <p className="text-sm">{post.analysis_summary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>اتهامات/ادعاهای کلیدی</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {aiAnalysis?.attack_vectors?.map((vector: string, idx: number) => (
                    <li key={idx} className="text-sm">{vector}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Counter-Narrative Builder */}
          <TabsContent value="narrative" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>نکات روایت متقابل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {counterPoints.map((point, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <span className="font-bold text-primary">{index + 1}.</span>
                    <Textarea
                      value={point}
                      onChange={(e) => {
                        const updated = [...counterPoints];
                        updated[index] = e.target.value;
                        setCounterPoints(updated);
                      }}
                      className="flex-1"
                      rows={2}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCounterPoint(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                
                <div className="flex gap-2">
                  <Input
                    placeholder="افزودن نکته جدید..."
                    value={newPoint}
                    onChange={(e) => setNewPoint(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCounterPoint()}
                  />
                  <Button onClick={addCounterPoint}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {aiAnalysis?.counter_narrative_points && (
              <Card>
                <CardHeader>
                  <CardTitle>پیشنهادات هوش مصنوعی</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {aiAnalysis.counter_narrative_points.map((point: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span className="text-sm">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 3: Evidence Library */}
          <TabsContent value="evidence" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>کتابخانه شواهد</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    فایل‌های پشتیبان را اینجا بکشید یا کلیک کنید
                  </p>
                  <Button variant="outline" size="sm">انتخاب فایل</Button>
                </div>

                <div className="space-y-2">
                  <Label>لینک‌های شواهد</Label>
                  <Input placeholder="https://..." />
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 ml-2" />
                    افزودن لینک
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Response Strategy */}
          <TabsContent value="strategy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>استراتژی پاسخ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>سخنگویان</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب سخنگو" />
                    </SelectTrigger>
                    <SelectContent>
                      {aiAnalysis?.suggested_spokespeople?.map((person: string) => (
                        <SelectItem key={person} value={person}>{person}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>کانال‌های انتشار</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {aiAnalysis?.response_channels?.map((channel: string) => (
                      <div key={channel} className="flex items-center gap-2">
                        <input type="checkbox" id={channel} />
                        <label htmlFor={channel} className="text-sm">{channel}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>جدول زمانی</Label>
                  <Input type="datetime-local" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 5: Content Draft */}
          <TabsContent value="draft" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>پیش‌نویس محتوا</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedChannel} onValueChange={setSelectedChannel}>
                  <TabsList>
                    <TabsTrigger value="official">بیانیه رسمی</TabsTrigger>
                    <TabsTrigger value="social">شبکه‌های اجتماعی</TabsTrigger>
                    <TabsTrigger value="press">نکات خبری</TabsTrigger>
                  </TabsList>

                  <TabsContent value="official" className="space-y-4">
                    <Textarea
                      placeholder="متن بیانیه رسمی..."
                      rows={12}
                      className="font-sans"
                    />
                    <p className="text-sm text-muted-foreground">تعداد کلمات: 0</p>
                  </TabsContent>

                  <TabsContent value="social" className="space-y-4">
                    <Textarea
                      placeholder="متن برای شبکه‌های اجتماعی..."
                      rows={8}
                      className="font-sans"
                    />
                    <p className="text-sm text-muted-foreground">تعداد کاراکتر: 0 / 280</p>
                  </TabsContent>

                  <TabsContent value="press" className="space-y-4">
                    <Textarea
                      placeholder="نکات کلیدی برای مطبوعات..."
                      rows={10}
                      className="font-sans"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            لغو
          </Button>
          <Button variant="outline" onClick={handleSaveDraft}>
            <Save className="w-4 h-4 ml-2" />
            ذخیره پیش‌نویس
          </Button>
          <Button onClick={handleSubmitForReview}>
            <Send className="w-4 h-4 ml-2" />
            ارسال برای تأیید
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResponsePreparationModal;
