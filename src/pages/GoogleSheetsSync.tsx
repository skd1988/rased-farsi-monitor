import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSettings } from '@/pages/settings/hooks/useSettings';
import { useSyncAutomation } from '@/hooks/useSyncAutomation';
import { googleSheetsService } from '@/services/googleSheetsService';
import { Database, RefreshCw, Loader2, CheckCircle2, Clock, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

const GoogleSheetsSync = () => {
  const { settings } = useSettings();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStats, setSyncStats] = useState({
    sheetRows: 0,
    dbPosts: 0,
    lastSynced: 0,
    pendingRows: 0,
  });

  // Sync Automation
  const { isSyncAutomationActive, nextSyncTime, lastSyncTime } = useSyncAutomation({
    onSync: handleSync,
    isSyncing,
  });

  // بارگذاری آمار
  useEffect(() => {
    loadSyncStats();
  }, [settings.google_sheet_id]);

  async function loadSyncStats() {
    if (!settings.google_sheet_id) return;

    const stats = await googleSheetsService.getSyncStats(settings.google_sheet_id);
    if (stats) {
      setSyncStats(stats);
    }
  }

  async function handleSync() {
    if (!settings.google_api_key || !settings.google_sheet_id || !settings.google_sheet_name) {
      toast.error('لطفاً ابتدا تنظیمات Google Sheets را کامل کنید');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);

    const result = await googleSheetsService.syncFromGoogleSheets(
      settings.google_api_key,
      settings.google_sheet_id,
      settings.google_sheet_name,
      setSyncProgress
    );

    setIsSyncing(false);
    setSyncProgress(0);

    if (result.success) {
      toast.success(`${result.rowsAdded} مطلب جدید اضافه شد`);
      loadSyncStats();
    } else {
      toast.error(result.error || 'خطا در همگام‌سازی');
    }
  }

  function handleReset() {
    if (!settings.google_sheet_id) return;
    googleSheetsService.resetSync(settings.google_sheet_id);
    loadSyncStats();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">همگام‌سازی Google Sheets</h1>
        <p className="text-muted-foreground">
          مدیریت همگام‌سازی داده‌ها از Google Sheets
        </p>
      </div>

      {/* Automation Indicator */}
      {isSyncAutomationActive && (
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    همگام‌سازی خودکار فعال است
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    هر {settings.sync_interval} دقیقه یکبار
                  </p>
                </div>
              </div>
              {nextSyncTime && (
                <div className="text-left space-y-1">
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Clock className="h-3 w-3" />
                    همگام‌سازی بعدی:
                  </div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {new Date(nextSyncTime).toLocaleTimeString('fa-IR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              مطالب در دیتابیس
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{syncStats.dbPosts.toLocaleString('fa-IR')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              آخرین ردیف همگام شده
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{syncStats.lastSynced.toLocaleString('fa-IR')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              آخرین همگام‌سازی
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {lastSyncTime
                ? new Date(lastSyncTime).toLocaleString('fa-IR')
                : 'هنوز انجام نشده'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Actions */}
      <Card>
        <CardHeader>
          <CardTitle>عملیات همگام‌سازی</CardTitle>
          <CardDescription>همگام‌سازی دستی یا ریست کردن وضعیت</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSyncing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>در حال همگام‌سازی...</span>
                <span>{Math.round(syncProgress)}%</span>
              </div>
              <Progress value={syncProgress} />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={isSyncing || !settings.google_sheet_id}
              className="flex-1"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  در حال همگام‌سازی...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 ml-2" />
                  همگام‌سازی دستی
                </>
              )}
            </Button>

            <Button
              onClick={handleReset}
              variant="outline"
              disabled={isSyncing}
            >
              ریست وضعیت
            </Button>
          </div>

          {!settings.google_sheet_id && (
            <p className="text-sm text-muted-foreground">
              لطفاً ابتدا در بخش تنظیمات، اطلاعات Google Sheets را وارد کنید.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleSheetsSync;
