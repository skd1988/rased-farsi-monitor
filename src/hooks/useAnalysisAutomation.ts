import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/pages/settings/hooks/useSettings';
import { toast } from 'sonner';

interface UseAnalysisAutomationProps {
  onAnalyze: (limit: number) => Promise<void>;
  isAnalyzing: boolean;
}

export const useAnalysisAutomation = ({ onAnalyze, isAnalyzing }: UseAnalysisAutomationProps) => {
  const { settings } = useSettings();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [nextRunTime, setNextRunTime] = useState<Date | null>(null);

  useEffect(() => {
    // پاکسازی interval قبلی
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // اگر auto_analysis فعال نیست، خارج شو
    if (!settings.auto_analysis) {
      setNextRunTime(null);
      return;
    }

    // اگر schedule دستی است، خارج شو
    if (settings.analysis_schedule === 'manual') {
      setNextRunTime(null);
      return;
    }

    const batchSize = parseInt(settings.batch_size);
    const delayMinutes = settings.analysis_delay;

    console.log('[useAnalysisAutomation] Setting up automation:', {
      schedule: settings.analysis_schedule,
      delay: delayMinutes,
      batchSize,
    });

    // محاسبه زمان اجرای بعدی
    const calculateNextRun = () => {
      const next = new Date();
      next.setMinutes(next.getMinutes() + delayMinutes);
      setNextRunTime(next);
      return next;
    };

    // تابع اجرای تحلیل
    const runAnalysis = async () => {
      if (isAnalyzing) {
        console.log('[useAnalysisAutomation] Analysis already running, skipping...');
        return;
      }

      try {
        console.log(`[useAnalysisAutomation] Running auto-analysis (batch: ${batchSize})`);
        await onAnalyze(batchSize);
        toast.success(`تحلیل خودکار ${batchSize} مطلب انجام شد`);
      } catch (error) {
        console.error('[useAnalysisAutomation] Auto-analysis error:', error);
        toast.error('خطا در تحلیل خودکار');
      }

      calculateNextRun();
    };

    // اجرای فوری برای schedule="immediate"
    if (settings.analysis_schedule === 'immediate' && !isAnalyzing) {
      runAnalysis();
    }

    // تنظیم interval برای schedule="delayed"
    if (settings.analysis_schedule === 'delayed') {
      calculateNextRun();

      const delayMs = delayMinutes * 60 * 1000; // تبدیل به میلی‌ثانیه
      intervalRef.current = setInterval(runAnalysis, delayMs);

      console.log(`[useAnalysisAutomation] Interval set: every ${delayMinutes} minutes`);
    }

    // پاکسازی در cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    settings.auto_analysis,
    settings.analysis_schedule,
    settings.analysis_delay,
    settings.batch_size,
    onAnalyze,
    isAnalyzing,
  ]);

  return {
    isAutomationActive: settings.auto_analysis && settings.analysis_schedule !== 'manual',
    nextRunTime,
  };
};
