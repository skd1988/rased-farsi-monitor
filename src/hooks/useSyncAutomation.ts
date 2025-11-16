import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/pages/settings/hooks/useSettings';
import { toast } from 'sonner';

interface UseSyncAutomationProps {
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

export const useSyncAutomation = ({ onSync, isSyncing }: UseSyncAutomationProps) => {
  const { settings } = useSettings();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [nextSyncTime, setNextSyncTime] = useState<Date | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    // پاکسازی interval قبلی
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // اگر auto_sync فعال نیست، خارج شو
    if (!settings.auto_sync) {
      setNextSyncTime(null);
      return;
    }

    const intervalMinutes = parseInt(settings.sync_interval);

    console.log('[useSyncAutomation] Setting up sync automation:', {
      interval: intervalMinutes,
      enabled: settings.auto_sync,
    });

    // محاسبه زمان sync بعدی
    const calculateNextSync = () => {
      const next = new Date();
      next.setMinutes(next.getMinutes() + intervalMinutes);
      setNextSyncTime(next);
      return next;
    };

    // تابع اجرای sync
    const runSync = async () => {
      if (isSyncing) {
        console.log('[useSyncAutomation] Sync already running, skipping...');
        return;
      }

      try {
        console.log('[useSyncAutomation] Running auto-sync...');
        setLastSyncTime(new Date());
        await onSync();
        toast.success('همگام‌سازی خودکار انجام شد');
      } catch (error) {
        console.error('[useSyncAutomation] Auto-sync error:', error);
        toast.error('خطا در همگام‌سازی خودکار');
      }

      calculateNextSync();
    };

    // اجرای اولیه
    calculateNextSync();

    // تنظیم interval
    const intervalMs = intervalMinutes * 60 * 1000; // تبدیل به میلی‌ثانیه
    intervalRef.current = setInterval(runSync, intervalMs);

    console.log(`[useSyncAutomation] Interval set: every ${intervalMinutes} minutes`);

    // پاکسازی در cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    settings.auto_sync,
    settings.sync_interval,
    onSync,
    isSyncing,
  ]);

  return {
    isSyncAutomationActive: settings.auto_sync,
    nextSyncTime,
    lastSyncTime,
  };
};
