import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { formatPersianDateTime } from '@/lib/dateUtils';

interface CalibrationMetrics {
  id: number;
  created_at: string;
  total_reviewed: number | null;
  model_agreement: number | null;
  model_disagreement: number | null;
  false_positive_count: number | null;
  false_negative_count: number | null;
  avg_risk_fp: number | null;
  avg_risk_fn: number | null;
  recommended_risk_threshold: number | null;
  recommended_deep_threshold: number | null;
  recommended_deepest_threshold: number | null;
}

const CalibrationThresholdCard = () => {
  const [latest, setLatest] = useState<CalibrationMetrics | null>(null);
  const [history, setHistory] = useState<CalibrationMetrics[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);

  const loadCalibrationMetrics = useCallback(async (isComponentMounted: () => boolean = () => true) => {
    setMetricsLoading(true);
    setMetricsError(null);

    const [latestResult, historyResult] = await Promise.all([
      supabase
        .from('psyop_calibration_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('psyop_calibration_metrics')
        .select(
          'id, created_at, total_reviewed, model_agreement, model_disagreement, false_positive_count, false_negative_count, recommended_risk_threshold, recommended_deep_threshold, recommended_deepest_threshold'
        )
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    if (!isComponentMounted()) return;

    if (latestResult.error || historyResult.error) {
      console.error('Error fetching calibration metrics', {
        latestError: latestResult.error,
        historyError: historyResult.error
      });
      setMetricsError('خطا در بارگذاری داده‌های کالیبراسیون');
      setMetricsLoading(false);
      return;
    }

    const latestRow = (latestResult.data?.[0] as CalibrationMetrics | undefined) ?? null;
    setLatest(latestRow);
    setHistory((historyResult.data as CalibrationMetrics[]) || []);
    setMetricsLoading(false);
  }, []);

  const handleRunCalibration = async () => {
    try {
      setIsCalibrating(true);
      setCalibrationError(null);

      const { data, error } = await supabase.functions.invoke('calibration-refresh');

      if (error) {
        console.error('Calibration refresh error', error);
        setCalibrationError('خطا در اجرای کالیبراسیون');
        return;
      }

      console.log('Calibration refreshed:', data);
      await loadCalibrationMetrics();
    } catch (err) {
      console.error('Unexpected error running calibration-refresh', err);
      setCalibrationError('خطای غیرمنتظره در اجرای کالیبراسیون');
    } finally {
      setIsCalibrating(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchCalibrationMetrics = async () => {
      await loadCalibrationMetrics(() => isMounted);
    };

    if (isMounted) {
      fetchCalibrationMetrics();
    }

    return () => {
      isMounted = false;
    };
  }, [loadCalibrationMetrics]);

  if (metricsLoading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال بارگذاری داده‌های کالیبراسیون...
        </CardContent>
      </Card>
    );
  }

  if (metricsError) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-destructive">{metricsError}</CardContent>
      </Card>
    );
  }

  if (!latest) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          داده‌ای برای نمایش آستانه‌های کالیبراسیون موجود نیست.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">تنظیم آستانه‌های مدل PsyOp</CardTitle>
            <CardDescription>آستانه‌های پیشنهادی بر اساس آخرین کالیبراسیون</CardDescription>
            {calibrationError && (
              <div className="text-xs text-destructive mt-1">{calibrationError}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground">
            {latest.created_at && (
              <div className="text-right leading-tight">
                <div>آخرین به‌روزرسانی:</div>
                <div>{formatPersianDateTime(latest.created_at)}</div>
              </div>
            )}
            <button
              type="button"
              onClick={handleRunCalibration}
              disabled={isCalibrating}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-xs font-semibold"
            >
              {isCalibrating ? 'در حال کالیبراسیون...' : 'اجرای کالیبراسیون'}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">آستانه کلی ریسک</div>
            <div className="text-lg font-semibold">{latest.recommended_risk_threshold ?? '-'}</div>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">آستانه تحلیل عمیق</div>
            <div className="text-lg font-semibold">{latest.recommended_deep_threshold ?? '-'}</div>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">آستانه تحلیل بحران</div>
            <div className="text-lg font-semibold">{latest.recommended_deepest_threshold ?? '-'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">پست‌های بررسی‌شده</div>
            <div className="text-lg font-semibold">{latest.total_reviewed ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">هم‌خوانی مدل</div>
            <div className="text-lg font-semibold text-emerald-600">{latest.model_agreement ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">ناهم‌خوانی مدل</div>
            <div className="text-lg font-semibold text-amber-600">{latest.model_disagreement ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">False Positive</div>
            <div className="text-lg font-semibold text-amber-600">{latest.false_positive_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">میانگین ریسک: {latest.avg_risk_fp ?? '-'}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">False Negative</div>
            <div className="text-lg font-semibold text-destructive">{latest.false_negative_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">میانگین ریسک: {latest.avg_risk_fn ?? '-'}</div>
          </div>
        </div>

        {history && history.length > 1 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">تاریخچهٔ آخرین کالیبراسیون‌ها</div>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 px-3">تاریخ</th>
                    <th className="py-2 px-3">بررسی‌شده</th>
                    <th className="py-2 px-3">FP</th>
                    <th className="py-2 px-3">FN</th>
                    <th className="py-2 px-3">آستانه ریسک</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="py-2 px-3">{formatPersianDateTime(row.created_at)}</td>
                      <td className="py-2 px-3">{row.total_reviewed ?? 0}</td>
                      <td className="py-2 px-3">{row.false_positive_count ?? 0}</td>
                      <td className="py-2 px-3">{row.false_negative_count ?? 0}</td>
                      <td className="py-2 px-3">{row.recommended_risk_threshold ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CalibrationThresholdCard;
