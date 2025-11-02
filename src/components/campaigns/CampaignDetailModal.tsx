import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  X,
  Target,
  Users,
  Calendar,
  TrendingUp,
  MessageSquare,
  FileText,
  Edit,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CampaignDetailModalProps {
  campaign: any;
  isOpen: boolean;
  onClose: () => void;
}

const CampaignDetailModal: React.FC<CampaignDetailModalProps> = ({
  campaign,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!campaign) return null;

  // Mock activity data
  const activityData = Array.from({ length: 30 }, (_, i) => ({
    date: format(new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000), 'MM/dd'),
    posts: Math.floor(Math.random() * 10) + 1,
  }));

  // Mock posts data
  const mockPosts = [
    { id: '1', title: 'مطلب نمونه ۱', source: 'توییتر', date: new Date(), threat: 'High' },
    { id: '2', title: 'مطلب نمونه ۲', source: 'تلگرام', date: new Date(), threat: 'Critical' },
    { id: '3', title: 'مطلب نمونه ۳', source: 'اینستاگرام', date: new Date(), threat: 'Medium' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold">
                {campaign.campaign_name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge>{campaign.status}</Badge>
                <Badge variant="outline">{campaign.campaign_type}</Badge>
                {campaign.orchestrator && (
                  <Badge variant="destructive">{campaign.orchestrator}</Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 ml-2" />
                ویرایش
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 ml-2" />
                گزارش
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">نمای کلی</TabsTrigger>
            <TabsTrigger value="posts" className="flex-1">مطالب</TabsTrigger>
            <TabsTrigger value="analysis" className="flex-1">تحلیل</TabsTrigger>
            <TabsTrigger value="counter" className="flex-1">روایت مقابل</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">24</div>
                <div className="text-sm text-muted-foreground">مجموع مطالب</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-3xl font-bold">
                  {Math.floor((new Date().getTime() - new Date(campaign.start_date).getTime()) / (1000 * 60 * 60 * 24))}
                </div>
                <div className="text-sm text-muted-foreground">روز فعال</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-3xl font-bold">{campaign.impact_assessment}/10</div>
                <div className="text-sm text-muted-foreground">میزان تاثیر</div>
              </Card>
              <Card className="p-4 text-center">
                <Badge className="text-lg px-4 py-2">
                  {campaign.counter_campaign_status}
                </Badge>
                <div className="text-sm text-muted-foreground mt-2">وضعیت پاسخ</div>
              </Card>
            </div>

            {/* Activity Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">روند فعالیت</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="posts" stroke="#DC2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Targets */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-danger" />
                اهداف کمپین
              </h3>
              
              {campaign.main_target && (
                <div>
                  <span className="text-sm text-muted-foreground mb-2 block">هدف اصلی</span>
                  <Badge className="text-lg px-4 py-2 bg-danger text-white">
                    {campaign.main_target}
                  </Badge>
                </div>
              )}

              {campaign.target_persons && Array.isArray(campaign.target_persons) && campaign.target_persons.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground mb-2 block">افراد هدف</span>
                  <div className="flex flex-wrap gap-2">
                    {campaign.target_persons.map((person: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="gap-2">
                        <Users className="h-3 w-3" />
                        {person}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Notes */}
            {campaign.notes && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-3">یادداشت‌ها</h3>
                <p className="text-muted-foreground leading-relaxed">{campaign.notes}</p>
              </Card>
            )}
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">عنوان</TableHead>
                    <TableHead className="text-right">منبع</TableHead>
                    <TableHead className="text-right">تاریخ</TableHead>
                    <TableHead className="text-right">سطح تهدید</TableHead>
                    <TableHead className="text-right">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockPosts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="font-medium">{post.title}</TableCell>
                      <TableCell>{post.source}</TableCell>
                      <TableCell>{format(post.date, 'PP', { locale: faIR })}</TableCell>
                      <TableCell>
                        <Badge
                          variant={post.threat === 'Critical' ? 'destructive' : 'secondary'}
                        >
                          {post.threat}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">مشاهده</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4">
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">تحلیل کمپین</h3>
              
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium">نوع کمپین</span>
                  <p className="text-muted-foreground mt-1">{campaign.campaign_type}</p>
                </div>

                <Separator />

                <div>
                  <span className="text-sm font-medium">متهم به سازماندهی</span>
                  <p className="text-muted-foreground mt-1">{campaign.orchestrator || 'نامشخص'}</p>
                </div>

                <Separator />

                <div>
                  <span className="text-sm font-medium">ارزیابی تاثیر</span>
                  <div className="mt-2">
                    <Progress value={campaign.impact_assessment * 10} className="h-3" />
                    <p className="text-sm text-muted-foreground mt-1">
                      {campaign.impact_assessment}/10 - 
                      {campaign.impact_assessment >= 7 ? ' تاثیر بالا' : 
                       campaign.impact_assessment >= 4 ? ' تاثیر متوسط' : ' تاثیر پایین'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Counter-Campaign Tab */}
          <TabsContent value="counter" className="space-y-4">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  برنامه روایت مقابل
                </h3>
                <Badge>{campaign.counter_campaign_status}</Badge>
              </div>

              {campaign.counter_campaign_status === 'Not Started' ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground mb-4">
                    هنوز برنامه روایت مقابلی برای این کمپین تهیه نشده است
                  </p>
                  <Button>
                    شروع آماده‌سازی روایت مقابل
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium">وضعیت</span>
                    <p className="text-muted-foreground mt-1">
                      {campaign.counter_campaign_status === 'In Progress' && 'در حال آماده‌سازی'}
                      {campaign.counter_campaign_status === 'Launched' && 'راه‌اندازی شده'}
                      {campaign.counter_campaign_status === 'Successful' && 'موفق'}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <Button className="w-full">
                      مشاهده جزئیات برنامه روایت مقابل
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignDetailModal;
