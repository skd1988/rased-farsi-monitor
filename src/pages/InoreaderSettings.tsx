/**
 * =====================================================
 * INOREADER SETTINGS - Enhanced with Auto-Refresh
 * سیستم AFTAB Intelligence System v2.1
 * =====================================================
 * 
 * تغییرات نسبت به نسخه قبل:
 * ✅ Auto-refresh token قبل از expire
 * ✅ بررسی خودکار هر 5 دقیقه
 * ✅ نمایش countdown تا expire
 * ✅ Warning هنگام نزدیک شدن به expire
 * ✅ بهبود Error Handling
 * ✅ Fix OAuth callback handling
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
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
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useInoreaderAuth } from '@/hooks/useInoreaderAuth';
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
  Loader2,
  Zap
} from 'lucide-react';
import { formatDistanceToNowIran } from '@/lib/dateUtils';

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
  // استفاده از Custom Hook برای مدیریت خودکار Token
  const {
    isConnected,
    isChecking,
    needsRefresh,
    expiresAt,
    lastChecked,
    checkStatus,
    refreshToken,
    disconnect,
    connect,
    handleCallback
  } = useInoreaderAuth();

  const [folders, setFolders] = useState<InoreaderFolder[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<InoreaderFolder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  /**
   * محاسبه زمان باقی‌مانده
   */
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('منقضی شده');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeRemaining(`${hours} ساعت و ${minutes} دقیقه`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  /**
   * Load initial data
   */
  useEffect(() => {
    if (isConnected) {
      loadFolders();
      loadStats();
    }
  }, [isConnected]);

  /**
   * بررسی OAuth callback - FIX APPLIED
   */
  useEffect(() => {
    console.log('[InoreaderSettings] Checking for OAuth code...');
    console.log('[InoreaderSettings] Full URL:', window.location.href);
    console.log('[InoreaderSettings] Hash:', window.location.hash);
    
    // بررسی code در hash (چون از HashRouter استفاده می‌کنیم)
    const hashParts = window.location.hash.split('?');
    
    if (hashParts.length > 1) {
      const urlParams = new URLSearchParams(hashParts[1]);
      const code = urlParams.get('code');
      
      console.log('[InoreaderSettings] OAuth code found:', code ? 'YES' : 'NO');
      
      if (code) {
        console.log('[InoreaderSettings] Processing OAuth code...');
        
        toast({
          title: '🔄 در حال اتصال...',
          description: 'لطفاً صبر کنید',
        });
        
        handleCallback(code);
        
        // پاک کردن code از URL
        const cleanHash = hashParts[0];
        window.history.replaceState({}, document.title, cleanHash);
      }
    } else {
      console.log('[InoreaderSettings] No OAuth code in URL');
    }
  }, [handleCallback]);

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
   * رنگ و label بر اساس priority
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

  /**
   * محاسبه درصد زمان باقی‌مانده
   */
  const getTimeRemainingPercent = () => {
    if (!expiresAt) return 100;
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const total = 60 * 60 * 1000; // 1 hour (فرض می‌کنیم token 1 ساعت اعتبار داره)
    const remaining = expires.getTime() - now.getTime();
    
    return Math.max(0, Math.min(100, (remaining / total) * 100));
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

      {/* نمایش Warning اگر نیاز به Refresh داره */}
      {needsRefresh && (
        <Alert className="border-yellow-500">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>⚠️ توکن به زودی منقضی می‌شود</strong>
              <p className="text-sm mt-1">زمان باقی‌مانده: {timeRemaining}</p>
            </div>
            <Button
              onClick={refreshToken}
              variant="outline"
              size="sm"
              className="border-yellow-500"
            >
              <Zap className="h-4 w-4 ms-2" />
              تمدید فوری
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {isChecking ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        <div>
                          <p className="font-semibold">در حال بررسی...</p>
                          <p className="text-sm text-muted-foreground">
                            صبر کنید
                          </p>
                        </div>
                      </>
                    ) : isConnected ? (
                      <>
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                        <div>
                          <p className="font-semibold">متصل به Inoreader</p>
                          {expiresAt && (
                            <p className="text-sm text-muted-foreground">
                              زمان باقی‌مانده: {timeRemaining}
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

                  {!isChecking && (
                    <div className="flex gap-2">
                      {isConnected ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={checkStatus}
                            size="sm"
                          >
                            <RefreshCw className="h-4 w-4 ms-2" />
                            بررسی مجدد
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={disconnect}
                            disabled={isLoading}
                          >
                            {isLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                            قطع اتصال
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={connect}
                          disabled={isLoading}
                        >
                          {isLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                          <Link2 className="h-4 w-4 ms-2" />
                          اتصال به Inoreader
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Token Expiry Progress */}
                {isConnected && expiresAt && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">اعتبار Token:</span>
                      <span className={needsRefresh ? 'text-yellow-600 font-medium' : 'text-green-600'}>
                        {Math.round(getTimeRemainingPercent())}%
                      </span>
                    </div>
                    <Progress 
                      value={getTimeRemainingPercent()} 
                      className={needsRefresh ? '[&>*]:bg-yellow-500' : '[&>*]:bg-green-500'}
                    />
                    {lastChecked && (
                      <p className="text-xs text-muted-foreground text-left">
                        آخرین بررسی: {formatDistanceToNowIran(lastChecked)}
                      </p>
                    )}
                  </div>
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

              {/* Auto-Refresh Info */}
              {isConnected && (
                <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <AlertDescription>
                    <strong>✨ تمدید خودکار فعال است</strong>
                    <p className="text-sm mt-1">
                      سیستم به طور خودکار Token شما را 5 دقیقه قبل از expire شدن تمدید می‌کند.
                      همچنین هر 5 دقیقه یکبار وضعیت اتصال بررسی می‌شود.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

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
                      <p className="text-sm text-muted-foreground">بر اساس Priority folders</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Auto-Refresh Token</p>
                      <p className="text-sm text-muted-foreground">نیازی به login مجدد نیست</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Folders */}
        <TabsContent value="folders" className="space-y-4">
          {!isConnected ? (
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
                disabled={isSyncing || !isConnected}
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
