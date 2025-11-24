/**
 * =====================================================
 * INOREADER SETTINGS - Backend Managed Tokens
 * سیستم AFTAB Intelligence System v2.1
 * =====================================================
 *
 * تغییرات نسبت به نسخه قبل:
 * ✅ تمدید خودکار Token در بک‌اند و Edge Functions
 * ✅ بررسی وضعیت بدون نیاز به باز بودن صفحه
 * ✅ نمایش countdown تا expire
 * ✅ Warning هنگام نزدیک شدن به expire
 * ✅ بهبود Error Handling
 * ✅ Fix OAuth callback handling
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface TokenStatusResponse {
  status: string;
  is_active: boolean;
  expires_at: string | null;
  error_count?: number;
  token_type?: string;
  error?: { message?: string };
}

type CronJobSummary = {
  job_name: string;
  last_started_at: string | null;
  last_success_at: string | null;
  last_finished_at: string | null;
  last_status: string | null;
  last_http_status: number | null;
  last_error_message: string | null;
  failures_last_24h: number;
};

const CRON_JOB_LABELS: Record<string, string> = {
  "inoreader-rss-ingestion": "دریافت RSS از Inoreader",
  "auto-analyzer": "تحلیل خودکار (AI)",
  "auto-cleanup": "پاکسازی ۲۴ ساعته",
  "intelligent-archive": "آرشیو هوشمند روزانه",
};

const CRON_JOB_ORDER = [
  "inoreader-rss-ingestion",
  "auto-analyzer",
  "auto-cleanup",
  "intelligent-archive",
];

const InoreaderSettings: React.FC = () => {
  // استفاده از Custom Hook برای مدیریت خودکار Token
  const {
    connected,
    statusReason,
    status,
    isExpired,
    canAutoRefresh,
    needsReconnect,
    expiresAt,
    loading: authLoading,
    error: authError,
    refreshStatus,
    disconnect,
    connect,
    handleCallback
  } = useInoreaderAuth();

  const [folders, setFolders] = useState<InoreaderFolder[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatusResponse | null>(null);
  const [tokenStatusLoading, setTokenStatusLoading] = useState(false);
  const [tokenStatusError, setTokenStatusError] = useState<string | null>(null);
  const [cronStatus, setCronStatus] = useState<Record<string, CronJobSummary> | null>(null);
  const [cronStatusLoading, setCronStatusLoading] = useState(false);
  const [cronStatusError, setCronStatusError] = useState<string | null>(null);

  /**
   * Load initial data
   */
  useEffect(() => {
    if (connected) {
      loadFolders();
      loadSyncLogs();
    }
  }, [connected]);

  useEffect(() => {
    loadTokenStatus();
    loadCronStatus();
  }, [connected]);

  useEffect(() => {
    setConnectionError(authError);
  }, [authError]);

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
   * وضعیت توکن Inoreader
   */
  const loadTokenStatus = async () => {
    setTokenStatusLoading(true);
    setTokenStatusError(null);
    try {
      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'status' }
      });

      if (error) throw error;

      setTokenStatus(data as TokenStatusResponse);
    } catch (error: any) {
      console.error('Error loading token status:', error);
      setTokenStatusError(error.message || 'خطای ناشناخته در دریافت وضعیت توکن');
    } finally {
      setTokenStatusLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    try {
      setTokenStatusLoading(true);
      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'refresh' }
      });

      if (error) throw error;

      toast({
        title: 'تمدید توکن',
        description: data?.message || 'توکن با موفقیت تمدید شد'
      });
      await loadTokenStatus();
      await refreshStatus();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.message || 'تمدید توکن ناموفق بود',
        variant: 'destructive'
      });
      setTokenStatusLoading(false);
    }
  };

  /**
   * وضعیت کرون
   */
  const loadCronStatus = async () => {
    setCronStatusLoading(true);
    setCronStatusError(null);
    try {
      const { data, error } = await supabase.functions.invoke<Record<string, CronJobSummary>>('get-cron-status', {
        body: {}
      });

      if (error) throw error;

      if (data) {
        setCronStatus(data);
      } else {
        setCronStatus({});
      }
    } catch (error: any) {
      console.error('Error loading cron status:', error);
      setCronStatusError(error.message || 'خطای ناشناخته در دریافت وضعیت کرون');
    } finally {
      setCronStatusLoading(false);
    }
  };

  const formatTimeRemaining = (expiresAt?: string | null) => {
    if (!expiresAt) return 'نامشخص';
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'منقضی شده';
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} روز`; 
    }
    if (hours > 0) {
      return `${hours} ساعت و ${minutes % 60} دقیقه`;
    }
    return `${minutes} دقیقه`;
  };

  const formatTimeSince = (dateString?: string) => {
    if (!dateString) return 'نامشخص';
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes} دقیقه پیش`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ساعت پیش`;
    const days = Math.floor(hours / 24);
    return `${days} روز پیش`;
  };

  /**
   * بارگذاری لاگ‌های همگام‌سازی
   */
  const loadSyncLogs = async () => {
    try {
      const { data: logs, error } = await supabase
        .from('inoreader_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const safeLogs = logs || [];
      setSyncLogs(safeLogs);

      if (safeLogs.length > 0) {
        const lastDay = safeLogs.filter(log =>
          new Date(log.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        );

        setStats({
          totalSyncs: safeLogs.length,
          last24h: lastDay.length,
          totalPostsFetched: safeLogs.reduce((sum, log) => sum + (log.posts_fetched || 0), 0),
          totalNewPosts: safeLogs.reduce((sum, log) => sum + (log.posts_new || 0), 0),
          successRate: (safeLogs.filter(l => l.status === 'success').length / safeLogs.length * 100).toFixed(1)
        });
      } else {
        setStats(null);
      }
    } catch (error: any) {
      console.error('Error loading sync logs:', error);
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
      await loadSyncLogs();
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

  const getCronStatusColor = (job?: CronJobSummary) => {
    if (!job) return '';
    const failures = job.failures_last_24h ?? 0;

    if (job.last_status === 'failed' || failures >= 3) {
      return 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950';
    }

    if (job.last_status === 'running' || failures > 0) {
      return 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950';
    }

    if (job.last_status === 'success' && failures === 0) {
      return 'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950';
    }

    return '';
  };

  const folderSyncData = folders
    .map((folder) => {
      const intervalMs = folder.fetch_interval_minutes * 60 * 1000;
      const nextSync = folder.last_synced_at
        ? new Date(folder.last_synced_at).getTime() + intervalMs
        : null;
      const due = !folder.is_active
        ? false
        : nextSync === null || nextSync <= Date.now();
      return {
        ...folder,
        intervalMs,
        nextSync,
        due,
      };
    })
    .sort((a, b) => a.priority - b.priority);

  const tokenStatusColor = tokenStatus?.status === 'ok'
    ? 'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950'
    : tokenStatus?.status === 'refresh_needed'
      ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950'
      : 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950';

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
          <div className="grid gap-4 md:grid-cols-3">
            <Card className={tokenStatus ? tokenStatusColor : ''}>
              <CardHeader>
                <CardTitle>وضعیت توکن</CardTitle>
                <CardDescription>وضعیت توکن Inoreader OAuth2</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tokenStatusLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری وضعیت توکن
                  </div>
                ) : tokenStatusError ? (
                  <Alert className="border-yellow-500">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription>{tokenStatusError}</AlertDescription>
                  </Alert>
                ) : tokenStatus ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>وضعیت:</span>
                      <Badge variant={tokenStatus.status === 'ok' ? 'default' : 'destructive'}>
                        {tokenStatus.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>فعال:</span>
                      <Badge variant={tokenStatus.is_active ? 'default' : 'secondary'}>
                        {tokenStatus.is_active ? 'بله' : 'خیر'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>نوع توکن:</span>
                      <span className="font-medium">{tokenStatus.token_type || 'OAuth2'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>تعداد خطا:</span>
                      <Badge variant="secondary">{tokenStatus.error_count ?? 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>انقضا:</span>
                      <span className="font-medium">
                        {tokenStatus.expires_at
                          ? new Date(tokenStatus.expires_at).toLocaleString('fa-IR')
                          : 'نامشخص'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>زمان باقی‌مانده:</span>
                      <span className="font-medium">{formatTimeRemaining(tokenStatus.expires_at)}</span>
                    </div>
                    {tokenStatus.error?.message && (
                      <p className="text-xs text-red-500">{tokenStatus.error.message}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">وضعیت توکن در دسترس نیست</p>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadTokenStatus} disabled={tokenStatusLoading}>
                    {tokenStatusLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                    بروزرسانی وضعیت
                  </Button>
                  <Button size="sm" onClick={handleRefreshToken} disabled={tokenStatusLoading}>
                    {tokenStatusLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                    تمدید توکن
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">وضعیت اجرای کرون</h3>
                  <p className="text-sm text-muted-foreground">پایش کرون‌های اصلی سیستم</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadCronStatus} disabled={cronStatusLoading}>
                  {cronStatusLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                  بروزرسانی وضعیت
                </Button>
              </div>

              {cronStatusError && (
                <Alert className="border-yellow-500">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription>{cronStatusError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {CRON_JOB_ORDER.map((jobName) => {
                  const job = cronStatus?.[jobName];
                  const lastRun = job?.last_finished_at || job?.last_started_at;
                  const failures = job?.failures_last_24h ?? 0;
                  const cardColor = getCronStatusColor(job);
                  const statusText = job?.last_status || 'نامشخص';
                  const httpStatus = job?.last_http_status != null ? job.last_http_status : '-';
                  const badgeVariant = statusText === 'success'
                    ? 'default'
                    : statusText === 'running'
                      ? 'secondary'
                      : 'destructive';

                  return (
                    <Card key={jobName} className={cardColor}>
                      <CardHeader>
                        <CardTitle>{CRON_JOB_LABELS[jobName]}</CardTitle>
                        <CardDescription>{job?.job_name || jobName}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {cronStatusLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> در حال بررسی کرون
                          </div>
                        ) : job ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span>آخرین اجرا:</span>
                              <span className="font-medium">
                                {lastRun ? new Date(lastRun).toLocaleString('fa-IR') : 'نامشخص'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>زمان سپری شده:</span>
                              <span className="font-medium">{lastRun ? formatTimeSince(lastRun) : 'نامشخص'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>وضعیت:</span>
                              <Badge variant={badgeVariant}>
                                {statusText} {job.last_http_status ? `(${httpStatus})` : ''}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>خطا در ۲۴ ساعت اخیر:</span>
                              <span className="font-medium">{failures}</span>
                            </div>
                            {job.last_error_message && (
                              <div className="text-xs text-muted-foreground text-left ltr line-clamp-2" dir="ltr">
                                آخرین خطا: {job.last_error_message}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">وضعیت این کرون یافت نشد</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>وضعیت فولدرها و زمان سینک</CardTitle>
                <CardDescription>بررسی زمان‌بندی و اولویت فولدرها</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!connected ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>برای مشاهده وضعیت فولدرها ابتدا اتصال را برقرار کنید.</AlertDescription>
                  </Alert>
                ) : folders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">هیچ فولدری یافت نشد.</p>
                ) : (
                  <div className="overflow-auto max-h-80 border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Folder</TableHead>
                          <TableHead>اولویت</TableHead>
                          <TableHead>فاصله (دقیقه)</TableHead>
                          <TableHead>آخرین سینک</TableHead>
                          <TableHead>سینک بعدی</TableHead>
                          <TableHead>وضعیت</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {folderSyncData.map((folder) => {
                          const rowClass = !folder.is_active
                            ? 'bg-red-50 dark:bg-red-950'
                            : folder.due
                              ? 'bg-green-50 dark:bg-green-950'
                              : 'bg-yellow-50 dark:bg-yellow-950';

                          return (
                            <TableRow key={folder.id} className={rowClass}>
                              <TableCell className="font-medium">{folder.folder_name}</TableCell>
                              <TableCell>{folder.priority}</TableCell>
                              <TableCell>{folder.fetch_interval_minutes}</TableCell>
                              <TableCell className="text-xs">
                                {folder.last_synced_at
                                  ? new Date(folder.last_synced_at).toLocaleString('fa-IR')
                                  : 'هرگز'}
                              </TableCell>
                              <TableCell className="text-xs">
                                {folder.nextSync
                                  ? new Date(folder.nextSync).toLocaleString('fa-IR')
                                  : 'به‌زودی'}
                              </TableCell>
                              <TableCell>
                                {!folder.is_active ? (
                                  <span className="text-red-600">🔴 غیرفعال</span>
                                ) : folder.due ? (
                                  <span className="text-green-600">🟢 DUE</span>
                                ) : (
                                  <span className="text-yellow-600">🟡 هنوز موعد نشده</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
                    {authLoading ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        <div>
                          <p className="font-semibold">در حال بررسی...</p>
                          <p className="text-sm text-muted-foreground">
                            صبر کنید
                          </p>
                        </div>
                      </>
                    ) : connected ? (
                      <>
                        {isExpired ? (
                          <AlertTriangle className="h-6 w-6 text-yellow-500" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        )}
                        <div>
                          <p className="font-semibold">
                            {isExpired ? 'توکن منقضی شده' : 'متصل به Inoreader'}
                          </p>
                          {expiresAt && (
                            <p className="text-sm text-muted-foreground">
                              اعتبار اتصال تا {new Date(expiresAt).toLocaleString('fa-IR')}
                            </p>
                          )}
                          {isExpired && (
                            <p className="text-sm text-muted-foreground">
                              {canAutoRefresh
                                ? 'توکن منقضی شده است اما امکان تمدید خودکار وجود دارد.'
                                : 'توکن منقضی شده و نیاز به اتصال مجدد دارید.'}
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
                            {statusReason === 'status_error'
                              ? status?.error?.message || 'خطای داخلی در بررسی وضعیت'
                              : needsReconnect
                                ? 'توکن معتبر یافت نشد یا منقضی شده است. لطفاً دوباره متصل شوید'
                                : 'لطفاً حساب Inoreader خود را متصل کنید'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {!authLoading && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={refreshStatus}
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 ms-2" />
                        بررسی مجدد
                      </Button>
                      {connected ? (
                        <Button
                          variant="destructive"
                          onClick={disconnect}
                          disabled={isLoading}
                        >
                          {isLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                          قطع اتصال
                        </Button>
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

                {connectionError && (
                  <Alert className="border-yellow-500">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription>{connectionError}</AlertDescription>
                  </Alert>
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
              {connected && (
                <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <AlertDescription>
                    <strong>✨ تمدید خودکار در بک‌اند فعال است</strong>
                    <p className="text-sm mt-1">
                      توکن‌ها توسط Edge Functions و کرون‌های سرور پیش از انقضا تمدید می‌شوند و دیگر
                      نیازی نیست این صفحه باز بماند یا مرورگر Refresh انجام دهد.
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
                      <p className="font-medium">تمدید خودکار در بک‌اند</p>
                      <p className="text-sm text-muted-foreground">نیازی به login مجدد یا باز بودن صفحه نیست</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Folders */}
        <TabsContent value="folders" className="space-y-4">
          {!connected ? (
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
                        نمای کلی اولویت، فاصله همگام‌سازی و آخرین سینک
                      </CardDescription>
                    </div>
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
                          <TableHead>فاصله (دقیقه)</TableHead>
                          <TableHead>آخرین سینک</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {folderSyncData.map((folder) => {
                          const rowClass = !folder.is_active
                            ? 'bg-red-50 dark:bg-red-950'
                            : folder.due
                              ? 'bg-green-50 dark:bg-green-950'
                              : '';

                          return (
                            <TableRow key={folder.id} className={rowClass}>
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
                              <TableCell>{folder.fetch_interval_minutes}</TableCell>
                              <TableCell className="text-xs">
                                {folder.last_synced_at
                                  ? new Date(folder.last_synced_at).toLocaleString('fa-IR')
                                  : 'هرگز'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                disabled={isSyncing || !connected}
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
