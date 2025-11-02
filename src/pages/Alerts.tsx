import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  FileText,
  Search,
  StickyNote,
} from 'lucide-react';
import { formatDistanceToNowIran, formatPersianDateTime } from '@/lib/dateUtils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  post_id: string;
  alert_type: string;
  severity: string;
  status: string;
  triggered_reason: string;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  posts?: {
    title: string;
    contents: string;
  };
}

const Alerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesText, setNotesText] = useState('');

  const [stats, setStats] = useState({
    critical: 0,
    high: 0,
    medium: 0,
    total: 0,
  });

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select(`
          *,
          posts (
            title,
            contents
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAlerts(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت هشدارها',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (alertsData: Alert[]) => {
    const activeAlerts = alertsData.filter((a) => a.status !== 'Resolved' && a.status !== 'Dismissed');
    setStats({
      critical: activeAlerts.filter((a) => a.severity === 'Critical').length,
      high: activeAlerts.filter((a) => a.severity === 'High').length,
      medium: activeAlerts.filter((a) => a.severity === 'Medium').length,
      total: activeAlerts.length,
    });
  };

  useEffect(() => {
    let filtered = [...alerts];

    if (severityFilter !== 'All') {
      filtered = filtered.filter((a) => a.severity === severityFilter);
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.posts?.title?.toLowerCase().includes(query) ||
          a.triggered_reason?.toLowerCase().includes(query)
      );
    }

    setFilteredAlerts(filtered);
  }, [alerts, severityFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateAlertStatus = async (alertId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'Resolved') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('alerts')
        .update(updateData)
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'وضعیت هشدار به‌روزرسانی شد',
      });

      fetchAlerts();
    } catch (error) {
      console.error('Error updating alert:', error);
      toast({
        title: 'خطا',
        description: 'خطا در به‌روزرسانی وضعیت',
        variant: 'destructive',
      });
    }
  };

  const saveNotes = async () => {
    if (!selectedAlert) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .update({ notes: notesText })
        .eq('id', selectedAlert.id);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'یادداشت ذخیره شد',
      });

      setShowNotesModal(false);
      fetchAlerts();
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ذخیره یادداشت',
        variant: 'destructive',
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'text-red-500 bg-red-500/10 border-red-500';
      case 'High':
        return 'text-orange-500 bg-orange-500/10 border-orange-500';
      case 'Medium':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500';
      case 'Low':
        return 'text-green-500 bg-green-500/10 border-green-500';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New':
        return 'bg-blue-500/10 text-blue-500';
      case 'Acknowledged':
        return 'bg-purple-500/10 text-purple-500';
      case 'In Progress':
        return 'bg-orange-500/10 text-orange-500';
      case 'Resolved':
        return 'bg-green-500/10 text-green-500';
      case 'Dismissed':
        return 'bg-gray-500/10 text-gray-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'New':
        return 'جدید';
      case 'Acknowledged':
        return 'تایید شده';
      case 'In Progress':
        return 'در حال رسیدگی';
      case 'Resolved':
        return 'حل شده';
      case 'Dismissed':
        return 'رد شده';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">در حال بارگذاری هشدارها...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold mb-2">هشدارها</h1>
        <p className="text-muted-foreground">مانیتورینگ محتوای بحرانی و اولویت‌دار</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={cn(stats.critical > 0 && 'animate-pulse')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">هشدارهای بحرانی</p>
                <p className="text-3xl font-bold text-red-500">{stats.critical}</p>
              </div>
              <div className="text-4xl p-3 rounded-lg bg-red-500/10 text-red-500">
                <AlertTriangle />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">اولویت بالا</p>
                <p className="text-3xl font-bold text-orange-500">{stats.high}</p>
              </div>
              <div className="text-4xl p-3 rounded-lg bg-orange-500/10 text-orange-500">
                <AlertTriangle />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">اولویت متوسط</p>
                <p className="text-3xl font-bold text-yellow-500">{stats.medium}</p>
              </div>
              <div className="text-4xl p-3 rounded-lg bg-yellow-500/10 text-yellow-500">
                <AlertTriangle />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">کل هشدارهای فعال</p>
                <p className="text-3xl font-bold text-blue-500">{stats.total}</p>
              </div>
              <div className="text-4xl p-3 rounded-lg bg-blue-500/10 text-blue-500">
                <FileText />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">شدت</label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">همه</SelectItem>
                  <SelectItem value="Critical">بحرانی</SelectItem>
                  <SelectItem value="High">بالا</SelectItem>
                  <SelectItem value="Medium">متوسط</SelectItem>
                  <SelectItem value="Low">پایین</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">وضعیت</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">همه</SelectItem>
                  <SelectItem value="New">جدید</SelectItem>
                  <SelectItem value="Acknowledged">تایید شده</SelectItem>
                  <SelectItem value="In Progress">در حال رسیدگی</SelectItem>
                  <SelectItem value="Resolved">حل شده</SelectItem>
                  <SelectItem value="Dismissed">رد شده</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block text-right">جستجو</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                <Input
                  placeholder="جستجو در عنوان و دلیل هشدار..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pe-10 text-right"
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">✨ هیچ هشدار فعالی وجود ندارد</h3>
              <p className="text-muted-foreground">همه چیز عالی است!</p>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={cn(
                'border-r-4 transition-all hover:shadow-lg',
                getSeverityColor(alert.severity)
              )}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <AlertTriangle className={cn('h-6 w-6 mt-1', getSeverityColor(alert.severity).split(' ')[0])} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                          <Badge variant="outline">{alert.alert_type}</Badge>
                          <Badge className={getStatusColor(alert.status)}>{getStatusLabel(alert.status)}</Badge>
                        </div>
                        <h3 className="font-semibold text-lg mb-1">{alert.posts?.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {alert.posts?.contents?.substring(0, 100)}...
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">دلیل ایجاد هشدار:</p>
                    <p className="text-sm">{alert.triggered_reason}</p>
                  </div>

                  {alert.notes && (
                    <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-1 flex items-center gap-2">
                        <StickyNote className="h-4 w-4" />
                        یادداشت:
                      </p>
                      <p className="text-sm">{alert.notes}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatDistanceToNowIran(alert.created_at)}
                    </span>
                    <span>•</span>
                    <span>{formatPersianDateTime(alert.created_at)}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {alert.status === 'New' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAlertStatus(alert.id, 'Acknowledged')}
                      >
                        بررسی کردم
                      </Button>
                    )}
                    {(alert.status === 'New' || alert.status === 'Acknowledged') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAlertStatus(alert.id, 'In Progress')}
                      >
                        رسیدگی می‌شود
                      </Button>
                    )}
                    {alert.status !== 'Resolved' && alert.status !== 'Dismissed' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => updateAlertStatus(alert.id, 'Resolved')}
                        >
                          <CheckCircle2 className="h-4 w-4 ms-1" />
                          حل شد
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-600"
                          onClick={() => updateAlertStatus(alert.id, 'Dismissed')}
                        >
                          <XCircle className="h-4 w-4 ms-1" />
                          رد می‌کنم
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAlert(alert);
                        setShowPostModal(true);
                      }}
                    >
                      <Eye className="h-4 w-4 ms-1" />
                      مشاهده پست
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAlert(alert);
                        setNotesText(alert.notes || '');
                        setShowNotesModal(true);
                      }}
                    >
                      <StickyNote className="h-4 w-4 ml-1" />
                      افزودن یادداشت
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showPostModal} onOpenChange={setShowPostModal}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>جزئیات پست</DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedAlert.posts?.title}</h3>
                <p className="text-sm whitespace-pre-wrap">{selectedAlert.posts?.contents}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>افزودن یادداشت</DialogTitle>
            <DialogDescription>یادداشت‌های خود را برای همکاری تیمی بنویسید</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="یادداشت خود را اینجا بنویسید..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={6}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNotesModal(false)}>
                انصراف
              </Button>
              <Button onClick={saveNotes}>ذخیره یادداشت</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alerts;
