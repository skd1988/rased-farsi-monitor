/**
 * =====================================================
 * INOREADER SETTINGS - UI Component
 * سیستم AFTAB Intelligence System
 * =====================================================
 *
 * صفحه تنظیمات Inoreader شامل:
 * 1. اتصال OAuth
 * 2. مدیریت Folders
 * 3. پیکربندی Sync
 * 4. آمار و لاگ‌ها
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Rss,
  RefreshCw,
  Link2,
  CheckCircle2,
  XCircle,
  Folder,
  Settings,
  PlayCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { formatDistanceToNowIran } from '@/lib/dateUtils';

interface InoreaderSettings {
  isConnected: boolean;
  expiresAt?: string;
  needsRefresh?: boolean;
}

interface InoreaderFolder {
  id: string;
  folder_id: string;
  folder_name: string;
  is_active: boolean;
  priority: number;
  fetch_interval_minutes: number;
  enable_ai_analysis: boolean;
  last_synced_at?: string;
  notes?: string;
  post_count?: number;
}

interface SyncLog {
  id: string;
  folder_id?: string;
  status: string;
  started_at: string;
  completed_at?: string;
  posts_fetched: number;
  posts_new: number;
  error_message?: string;
}

const InoreaderSettings: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<InoreaderSettings>({
    isConnected: false
  });
  const [folders, setFolders] = useState<InoreaderFolder[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<InoreaderFolder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Load initial data
  useEffect(() => {
    checkConnectionStatus();
    loadFolders();
    loadStats();
  }, []);

  /**
   * بررسی وضعیت اتصال
   */
  const checkConnectionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'validate' }
      });

      if (error) throw error;

      setConnectionStatus({
        isConnected: data.isValid,
        expiresAt: data.expiresAt,
        needsRefresh: data.needsRefresh
      });
    } catch (error: any) {
      console.error('Error checking connection:', error);
      setConnectionStatus({ isConnected: false });
    }
  };

  /**
   * اتصال به Inoreader
   */
  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const REDIRECT_URI = window.location.hostname === 'localhost'
        ? 'http://localhost:8080/#/settings/inoreader'
        : 'https://skd1988.github.io/rased-farsi-monitor/#/settings/inoreader';

      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'authorize', redirectUri: REDIRECT_URI }
      });

      if (error) throw error;

      // Redirect to Inoreader auth page
      window.location.href = data.authUrl;
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * تکمیل اتصال بعد از redirect
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      handleOAuthCallback(code);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleOAuthCallback = async (code: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'exchange', code }
      });

      if (error) throw error;

      toast({
        title: 'موفق',
        description: data.message
      });

      // Sync folders automatically
      await handleSyncFolders();

      checkConnectionStatus();
    } catch (error: any) {
      toast({
        title: 'خطا در اتصال',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * قطع اتصال
   */
  const handleDisconnect = async () => {
    if (!confirm('آیا مطمئن هستید؟ اتصال به Inoreader قطع خواهد شد.')) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'disconnect' }
      });

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'اتصال قطع شد'
      });

      setConnectionStatus({ isConnected: false });
      setFolders([]);
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * همگام‌سازی folders
   */
  const handleSyncFolders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('inoreader-folders-manager', {
        body: { action: 'sync' }
      });

      if (error) throw error;

      toast({
        title: 'موفق',
        description: data.message
      });

      await loadFolders();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * بارگذاری folders
   */
  const loadFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('inoreader_folders')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;

      // Get post counts
      const foldersWithCounts = await Promise.all(
        (data || []).map(async (folder) => {
          const { count } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('inoreader_folder_id', folder.id);

          return { ...folder, post_count: count || 0 };
        })
      );

      setFolders(foldersWithCounts);
    } catch (error: any) {
      console.error('Error loading folders:', error);
    }
  };

  /**
   * بارگذاری آمار
   */
  const loadStats = async () => {
    try {
      const { data: logs } = await supabase
        .from('inoreader_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      setSyncLogs(logs || []);

      // Calculate stats
      if (logs && logs.length > 0) {
        const lastDay = logs.filter(log =>
          new Date(log.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        );

        setStats({
          totalSyncs: logs.length,
          last24h: lastDay.length,
          totalPostsFetched: logs.reduce((sum, log) => sum + (log.posts_fetched || 0), 0),
          totalNewPosts: logs.reduce((sum, log) => sum + (log.posts_new || 0), 0),
          successRate: (logs.filter(l => l.status === 'success').length / logs.length * 100).toFixed(1)
        });
      }
    } catch (error: any) {
      console.error('Error loading stats:', error);
    }
  };

  /**
   * اجرای manual sync
   */
  const handleManualSync = async (folderId?: string) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('inoreader-rss-ingestion', {
        body: {
          folderIds: folderId ? [folderId] : undefined,
          forceAll: !folderId
        }
      });

      if (error) throw error;

      toast({
        title: 'موفق',
        description: data.message
      });

      await loadFolders();
      await loadStats();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * بروزرسانی تنظیمات folder
   */
  const handleUpdateFolder = async (folderId: string, config: Partial<InoreaderFolder>) => {
    try {
      const { error } = await supabase.functions.invoke('inoreader-folders-manager', {
        body: { action: 'update', folderId, config }
      });

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'تنظیمات بروز شد'
      });

      await loadFolders();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  /**
   * رنگ بر اساس priority
   */
  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'text-red-500';
      case 2: return 'text-yellow-500';
      case 3: return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return 'بالا';
      case 2: return 'متوسط';
      case 3: return 'پایین';
      default: return 'نامشخص';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">تنظیمات Inoreader</h1>
          <p className="text-muted-foreground mt-1">
            مدیریت اتصال و همگام‌سازی با Inoreader RSS Reader
          </p>
        </div>
        <Rss className="h-12 w-12 text-primary" />
      </div>

      <Tabs defaultValue="connection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connection">اتصال</TabsTrigger>
          <TabsTrigger value="folders">Folders</TabsTrigger>
          <TabsTrigger value="sync">همگام‌سازی</TabsTrigger>
          <TabsTrigger value="logs">لاگ‌ها</TabsTrigger>
        </TabsList>

        {/* TAB 1: اتصال */}
        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>وضعیت اتصال</CardTitle>
              <CardDescription>
                برای دریافت خودکار اخبار از Inoreader، ابتدا باید حساب خود را متصل کنید
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  {connectionStatus.isConnected ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                      <div>
                        <p className="font-semibold">متصل به Inoreader</p>
                        {connectionStatus.expiresAt && (
                          <p className="text-sm text-muted-foreground">
                            انقضا: {formatDistanceToNowIran(new Date(connectionStatus.expiresAt))}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-6 w-6 text-red-500" />
                      <div>
                        <p className="font-semibold">عدم اتصال</p>
                        <p className="text-sm text-muted-foreground">
                          لطفاً حساب Inoreader خود را متصل کنید
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {connectionStatus.isConnected ? (
                  <div className="flex gap-2">
                    {connectionStatus.needsRefresh && (
                      <Badge variant="outline" className="text-yellow-600">
                        نیاز به تمدید
                      </Badge>
                    )}
                    <Button
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                      قطع اتصال
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnect}
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                    <Link2 className="h-4 w-4 ms-2" />
                    اتصال به Inoreader
                  </Button>
                )}
              </div>

              {/* Info */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>نکته مهم:</strong> برای استفاده از Inoreader API، نیاز به اشتراک Pro دارید (۶۰ دلار در سال).
                  بدون اشتراک Pro، امکان اتصال وجود ندارد.
                </AlertDescription>
              </Alert>

              {/* Benefits */}
              <div className="grid gap-4">
                <h4 className="font-semibold">مزایای اتصال به Inoreader:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 border rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">رفع محدودیت 20 خبر</p>
                      <p className="text-sm text-muted-foreground">تا 100 خبر در هر درخواست</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">مدیریت مرکزی</p>
                      <p className="text-sm text-muted-foreground">تمام فیدها در یک جا</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">همگام‌سازی خودکار</p>
                      <p className="text-sm text-muted-foreground">هر 30 دقیقه یک بار</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Folders و Tags</p>
                      <p className="text-sm text-muted-foreground">سازماندهی بهتر منابع</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Folders */}
        <TabsContent value="folders" className="space-y-4">
          {!connectionStatus.isConnected ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                برای مشاهده و مدیریت Folders، ابتدا باید به Inoreader متصل شوید.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Folders و Tags</CardTitle>
                      <CardDescription>
                        مدیریت Folders دریافتی از Inoreader
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleSyncFolders}
                      disabled={isLoading}
                      variant="outline"
                    >
                      {isLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                      <RefreshCw className="h-4 w-4 ms-2" />
                      همگام‌سازی Folders
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {folders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>هیچ folderای یافت نشد</p>
                      <p className="text-sm mt-2">
                        ابتدا در Inoreader folder بسازید، سپس اینجا همگام‌سازی کنید
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>نام Folder</TableHead>
                          <TableHead>اولویت</TableHead>
                          <TableHead>فاصله Sync</TableHead>
                          <TableHead>تحلیل AI</TableHead>
                          <TableHead>تعداد مطالب</TableHead>
                          <TableHead>آخرین Sync</TableHead>
                          <TableHead>وضعیت</TableHead>
                          <TableHead>عملیات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {folders.map((folder) => (
                          <TableRow key={folder.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Folder className="h-4 w-4" />
                                {folder.folder_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getPriorityColor(folder.priority)}>
                                {getPriorityLabel(folder.priority)}
                              </Badge>
                            </TableCell>
                            <TableCell>{folder.fetch_interval_minutes} دقیقه</TableCell>
                            <TableCell>
                              <Switch
                                checked={folder.enable_ai_analysis}
                                onCheckedChange={(checked) =>
                                  handleUpdateFolder(folder.id, { enable_ai_analysis: checked })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {folder.post_count || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {folder.last_synced_at
                                ? formatDistanceToNowIran(new Date(folder.last_synced_at))
                                : 'هرگز'}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={folder.is_active}
                                onCheckedChange={(checked) =>
                                  handleUpdateFolder(folder.id, { is_active: checked })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleManualSync(folder.id)}
                                  disabled={isSyncing}
                                >
                                  <PlayCircle className="h-4 w-4" />
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setSelectedFolder(folder)}
                                    >
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent dir="rtl">
                                    <DialogHeader>
                                      <DialogTitle>تنظیمات {folder.folder_name}</DialogTitle>
                                      <DialogDescription>
                                        پیکربندی دقیق این folder
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="space-y-2">
                                        <Label>اولویت</Label>
                                        <Select
                                          value={folder.priority.toString()}
                                          onValueChange={(value) =>
                                            handleUpdateFolder(folder.id, { priority: parseInt(value) })
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="1">بالا (هر 5 دقیقه)</SelectItem>
                                            <SelectItem value="2">متوسط (هر 30 دقیقه)</SelectItem>
                                            <SelectItem value="3">پایین (هر 60 دقیقه)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div className="space-y-2">
                                        <Label>فاصله همگام‌سازی (دقیقه)</Label>
                                        <Input
                                          type="number"
                                          value={folder.fetch_interval_minutes}
                                          onChange={(e) =>
                                            handleUpdateFolder(folder.id, {
                                              fetch_interval_minutes: parseInt(e.target.value)
                                            })
                                          }
                                          min={5}
                                          max={1440}
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label>یادداشت</Label>
                                        <Textarea
                                          value={folder.notes || ''}
                                          onChange={(e) =>
                                            handleUpdateFolder(folder.id, { notes: e.target.value })
                                          }
                                          placeholder="یادداشت‌های شما..."
                                          rows={3}
                                        />
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* TAB 3: همگام‌سازی */}
        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>همگام‌سازی دستی</CardTitle>
              <CardDescription>
                اجرای فوری همگام‌سازی بدون انتظار برای Cron Job
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => handleManualSync()}
                disabled={isSyncing || !connectionStatus.isConnected}
                size="lg"
                className="w-full"
              >
                {isSyncing && <Loader2 className="h-5 w-5 ms-2 animate-spin" />}
                <PlayCircle className="h-5 w-5 ms-2" />
                اجرای همگام‌سازی همه Folders
              </Button>

              {stats && (
                <div className="grid grid-cols-4 gap-4 pt-4">
                  <div className="p-4 border rounded text-center">
                    <p className="text-2xl font-bold">{stats.totalSyncs}</p>
                    <p className="text-sm text-muted-foreground">کل همگام‌سازی‌ها</p>
                  </div>
                  <div className="p-4 border rounded text-center">
                    <p className="text-2xl font-bold">{stats.last24h}</p>
                    <p className="text-sm text-muted-foreground">24 ساعت اخیر</p>
                  </div>
                  <div className="p-4 border rounded text-center">
                    <p className="text-2xl font-bold">{stats.totalNewPosts}</p>
                    <p className="text-sm text-muted-foreground">مطالب جدید</p>
                  </div>
                  <div className="p-4 border rounded text-center">
                    <p className="text-2xl font-bold">{stats.successRate}%</p>
                    <p className="text-sm text-muted-foreground">نرخ موفقیت</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: لاگ‌ها */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>تاریخچه همگام‌سازی</CardTitle>
                  <CardDescription>
                    {syncLogs.length} رکورد اخیر
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedLogs(!expandedLogs)}
                >
                  {expandedLogs ? (
                    <><ChevronUp className="h-4 w-4 ms-2" /> بستن</>
                  ) : (
                    <><ChevronDown className="h-4 w-4 ms-2" /> نمایش جزئیات</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {syncLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>هنوز هیچ همگام‌سازی انجام نشده</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>زمان</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>مطالب جدید</TableHead>
                      <TableHead>مدت زمان</TableHead>
                      {expandedLogs && <TableHead>جزئیات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.map((log) => {
                      const folder = folders.find(f => f.id === log.folder_id);
                      const duration = log.completed_at
                        ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                        : null;

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {formatDistanceToNowIran(new Date(log.started_at))}
                          </TableCell>
                          <TableCell>
                            {folder?.folder_name || 'نامشخص'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                log.status === 'success' ? 'default' :
                                log.status === 'failed' ? 'destructive' :
                                'secondary'
                              }
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {log.posts_new} از {log.posts_fetched}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {duration ? `${duration}ث` : '-'}
                          </TableCell>
                          {expandedLogs && (
                            <TableCell className="text-sm text-muted-foreground">
                              {log.error_message || '-'}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InoreaderSettings;
