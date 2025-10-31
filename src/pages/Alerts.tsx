import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  AlertCircle, 
  AlertOctagon, 
  CheckCircle2,
  Clock,
  Eye,
  MessageSquare,
  X,
  CheckCheck,
  Ban,
  Search,
  Calendar,
  Filter
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

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
  posts: {
    title: string;
    contents: string;
    source: string;
  };
}

const Alerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [noteAlertId, setNoteAlertId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Stats
  const criticalCount = filteredAlerts.filter(a => a.severity === 'Critical' && a.status !== 'Resolved' && a.status !== 'Dismissed').length;
  const highCount = filteredAlerts.filter(a => a.severity === 'High' && a.status !== 'Resolved' && a.status !== 'Dismissed').length;
  const mediumCount = filteredAlerts.filter(a => a.severity === 'Medium' && a.status !== 'Resolved' && a.status !== 'Dismissed').length;
  const activeCount = filteredAlerts.filter(a => a.status !== 'Resolved' && a.status !== 'Dismissed').length;

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select(`
          *,
          posts (
            title,
            contents,
            source
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
      setFilteredAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در دریافت هشدارها',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = alerts;

    // Apply severity filter
    if (severityFilter !== 'All') {
      filtered = filtered.filter(a => a.severity === severityFilter);
    }

    // Apply status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(a => 
        a.posts.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.triggered_reason.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredAlerts(filtered);
  }, [alerts, severityFilter, statusFilter, searchQuery]);

  const updateAlertStatus = async (alertId: string, newStatus: string) => {
    try {
      const updates: any = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'Resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('alerts')
        .update(updates)
        .eq('id', alertId);

      if (error) throw error;
      
      await fetchAlerts();
      toast({
        title: 'موفق',
        description: 'وضعیت هشدار به‌روزرسانی شد',
      });
    } catch (error) {
      console.error('Error updating alert:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در به‌روزرسانی وضعیت',
      });
    }
  };

  const addNote = async (alertId: string, note: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ 
          notes: note,
          updated_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
      
      await fetchAlerts();
      setNoteAlertId(null);
      setNoteText('');
      toast({
        title: 'موفق',
        description: 'یادداشت اضافه شد',
      });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در افزودن یادداشت',
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'border-red-500 bg-red-500/10';
      case 'High': return 'border-orange-500 bg-orange-500/10';
      case 'Medium': return 'border-yellow-500 bg-yellow-500/10';
      case 'Low': return 'border-green-500 bg-green-500/10';
      default: return 'border-gray-500 bg-gray-500/10';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-500/20 text-red-500 border-red-500';
      case 'High': return 'bg-orange-500/20 text-orange-500 border-orange-500';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500';
      case 'Low': return 'bg-green-500/20 text-green-500 border-green-500';
      default: return '';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-500/20 text-blue-500 border-blue-500';
      case 'Acknowledged': return 'bg-purple-500/20 text-purple-500 border-purple-500';
      case 'In Progress': return 'bg-orange-500/20 text-orange-500 border-orange-500';
      case 'Resolved': return 'bg-green-500/20 text-green-500 border-green-500';
      case 'Dismissed': return 'bg-gray-500/20 text-gray-500 border-gray-500';
      default: return '';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'Critical': return <AlertOctagon className="h-5 w-5 text-red-500" />;
      case 'High': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'Medium': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'Low': return <AlertCircle className="h-5 w-5 text-green-500" />;
      default: return <AlertCircle className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">در حال بارگذاری هشدارها...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مانیتورینگ هشدارها</h1>
          <p className="text-muted-foreground mt-1">رصد و مدیریت محتوای بحرانی و پرخطر</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`${criticalCount > 0 ? 'animate-pulse' : ''}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">هشدارهای بحرانی</p>
                <p className="text-3xl font-bold text-red-500">{criticalCount}</p>
              </div>
              <div className="text-4xl p-3 rounded-lg bg-red-500/10 text-red-500">
                <AlertOctagon className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">اولویت بالا</p>
                <p className="text-3xl font-bold text-orange-500">{highCount}</p>
              </div>
              <div className="text-4xl p-3 rounded-lg bg-orange-500/10 text-orange-500">
                <AlertTriangle className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">اولویت متوسط</p>
                <p className="text-3xl font-bold text-yellow-500">{mediumCount}</p>
              </div>
              <div className="text-4xl p-3 rounded-lg bg-yellow-500/10 text-yellow-500">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">کل هشدارهای فعال</p>
                <p className="text-3xl font-bold text-blue-500">{activeCount}</p>
              </div>
              <div className="text-4xl p-3 rounded-lg bg-blue-500/10 text-blue-500">
                <AlertTriangle className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="شدت" />
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

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="وضعیت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">همه</SelectItem>
                  <SelectItem value="New">جدید</SelectItem>
                  <SelectItem value="Acknowledged">بررسی شده</SelectItem>
                  <SelectItem value="In Progress">در حال رسیدگی</SelectItem>
                  <SelectItem value="Resolved">حل شده</SelectItem>
                  <SelectItem value="Dismissed">رد شده</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو در عنوان یا دلیل هشدار..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Timeline */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">✨ هیچ هشدار فعالی وجود ندارد</h3>
              <p className="text-muted-foreground">همه چیز تحت کنترل است</p>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Card key={alert.id} className={`border-r-4 ${getSeverityColor(alert.severity)}`}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getSeverityBadgeColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline">{alert.alert_type}</Badge>
                          <Badge className={getStatusBadgeColor(alert.status)}>
                            {alert.status === 'New' && 'جدید'}
                            {alert.status === 'Acknowledged' && 'بررسی شده'}
                            {alert.status === 'In Progress' && 'در حال رسیدگی'}
                            {alert.status === 'Resolved' && 'حل شده'}
                            {alert.status === 'Dismissed' && 'رد شده'}
                          </Badge>
                        </div>

                        {/* Post Preview */}
                        <div className="bg-muted/50 p-3 rounded-md mb-3">
                          <h4 className="font-semibold text-sm mb-1">{alert.posts.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {alert.posts.contents?.slice(0, 100)}...
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">منبع: {alert.posts.source}</p>
                        </div>

                        {/* Triggered Reason */}
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-md mb-2">
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                            🔍 {alert.triggered_reason}
                          </p>
                        </div>

                        {/* Notes */}
                        {alert.notes && (
                          <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-md">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5" />
                              <p className="text-sm text-blue-700 dark:text-blue-400">{alert.notes}</p>
                            </div>
                          </div>
                        )}

                        {/* Timestamp */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(alert.created_at), { 
                              addSuffix: true
                            })} - {format(new Date(alert.created_at), 'yyyy/MM/dd HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {alert.status === 'New' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAlertStatus(alert.id, 'Acknowledged')}
                      >
                        <Eye className="ml-1 h-4 w-4" />
                        بررسی کردم
                      </Button>
                    )}
                    
                    {(alert.status === 'New' || alert.status === 'Acknowledged') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAlertStatus(alert.id, 'In Progress')}
                      >
                        <Clock className="ml-1 h-4 w-4" />
                        رسیدگی می‌شود
                      </Button>
                    )}
                    
                    {alert.status !== 'Resolved' && alert.status !== 'Dismissed' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-600"
                          onClick={() => updateAlertStatus(alert.id, 'Resolved')}
                        >
                          <CheckCheck className="ml-1 h-4 w-4" />
                          حل شد
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-600 hover:text-gray-600"
                          onClick={() => updateAlertStatus(alert.id, 'Dismissed')}
                        >
                          <Ban className="ml-1 h-4 w-4" />
                          رد می‌کنم
                        </Button>
                      </>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedPost(alert.posts);
                        setShowPostModal(true);
                      }}
                    >
                      <Eye className="ml-1 h-4 w-4" />
                      مشاهده پست
                    </Button>
                    
                    {noteAlertId === alert.id ? (
                      <div className="flex gap-2 w-full">
                        <Textarea
                          placeholder="یادداشت خود را وارد کنید..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="flex-1"
                          rows={2}
                        />
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => addNote(alert.id, noteText)}
                          >
                            ذخیره
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setNoteAlertId(null);
                              setNoteText('');
                            }}
                          >
                            لغو
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNoteAlertId(alert.id);
                          setNoteText(alert.notes || '');
                        }}
                      >
                        <MessageSquare className="ml-1 h-4 w-4" />
                        {alert.notes ? 'ویرایش یادداشت' : 'افزودن یادداشت'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Post Detail Modal */}
      <Dialog open={showPostModal} onOpenChange={setShowPostModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedPost?.title}</DialogTitle>
            <DialogDescription>منبع: {selectedPost?.source}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="prose dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{selectedPost?.contents}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alerts;
