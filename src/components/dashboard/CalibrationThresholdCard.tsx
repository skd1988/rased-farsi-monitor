import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchCalibrationMetrics = async () => {
      setLoading(true);
      setError(null);

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

      if (!isMounted) return;

      if (latestResult.error || historyResult.error) {
        console.error('Error fetching calibration metrics', {
          latestError: latestResult.error,
          historyError: historyResult.error
        });
        setError('خطا در بارگذاری داده‌های کالیبراسیون');
        setLoading(false);
        return;
      }

      const latestRow = (latestResult.data?.[0] as CalibrationMetrics | undefined) ?? null;
      setLatest(latestRow);
      setHistory((historyResult.data as CalibrationMetrics[]) || []);
      setLoading(false);
    };

    fetchCalibrationMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Card className="bg-slate-900/40 border border-slate-800">
        <CardContent className="p-4 text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال بارگذاری داده‌های کالیبراسیون...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-900/40 border border-slate-800">
        <CardContent className="p-4 text-xs text-red-400">{error}</CardContent>
      </Card>
    );
  }

  if (!latest) {
    return (
      <Card className="bg-slate-900/40 border border-slate-800">
        <CardContent className="p-4 text-xs text-slate-400">
          داده‌ای برای نمایش آستانه‌های کالیبراسیون موجود نیست.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/40 border border-slate-800">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              تنظیم آستانه‌های مدل PsyOp
            </h3>
            <p className="text-[11px] text-slate-400">
              آستانه‌های پیشنهادی بر اساس آخرین کالیبراسیون
            </p>
          </div>
          {latest.created_at && (
            <div className="text-[11px] text-slate-400 text-left">
              <div>آخرین به‌روزرسانی:</div>
              <div>{formatPersianDateTime(latest.created_at)}</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] mb-3">
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">آستانه کلی ریسک</div>
            <div className="text-slate-100 font-semibold text-sm">
              {latest.recommended_risk_threshold ?? '-'}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">آستانه تحلیل عمیق</div>
            <div className="text-slate-100 font-semibold text-sm">
              {latest.recommended_deep_threshold ?? '-'}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">آستانه تحلیل بحران</div>
            <div className="text-slate-100 font-semibold text-sm">
              {latest.recommended_deepest_threshold ?? '-'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">پست‌های بررسی‌شده</div>
            <div className="text-slate-100 font-semibold text-sm">
              {latest.total_reviewed ?? 0}
            </div>
          </div>
          <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">هم‌خوانی مدل</div>
            <div className="text-emerald-400 font-semibold text-sm">
              {latest.model_agreement ?? 0}
            </div>
          </div>
          <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">ناهم‌خوانی مدل</div>
            <div className="text-amber-400 font-semibold text-sm">
              {latest.model_disagreement ?? 0}
            </div>
          </div>
          <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">False Positive</div>
            <div className="text-amber-300 font-semibold text-sm">
              {latest.false_positive_count ?? 0}
            </div>
            <div className="text-[10px] text-slate-400">
              میانگین ریسک: {latest.avg_risk_fp ?? '-'}
            </div>
          </div>
          <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">False Negative</div>
            <div className="text-red-300 font-semibold text-sm">
              {latest.false_negative_count ?? 0}
            </div>
            <div className="text-[10px] text-slate-400">
              میانگین ریسک: {latest.avg_risk_fn ?? '-'}
            </div>
          </div>
        </div>

        {history && history.length > 1 && (
          <div className="mt-3">
            <div className="text-[11px] text-slate-400 mb-1">
              تاریخچهٔ آخرین کالیبراسیون‌ها
            </div>
            <table className="w-full text-[10px] text-slate-300">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-1 text-right">تاریخ</th>
                  <th className="py-1 text-right">بررسی‌شده</th>
                  <th className="py-1 text-right">FP</th>
                  <th className="py-1 text-right">FN</th>
                  <th className="py-1 text-right">آستانه ریسک</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800/80">
                    <td className="py-1">{formatPersianDateTime(row.created_at)}</td>
                    <td className="py-1">{row.total_reviewed ?? 0}</td>
                    <td className="py-1">{row.false_positive_count ?? 0}</td>
                    <td className="py-1">{row.false_negative_count ?? 0}</td>
                    <td className="py-1">{row.recommended_risk_threshold ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CalibrationThresholdCard;
