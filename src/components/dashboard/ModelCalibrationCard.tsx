import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ModelConfusionRow {
  model_label: string;
  human_label: string;
  total_posts: number;
  avg_risk_score: number | null;
}

interface RiskBucketRow {
  risk_bucket: string;
  human_label: string;
  total_posts: number;
}

const bucketOrder: Record<string, number> = {
  '0-19': 0,
  '20-39': 1,
  '40-59': 2,
  '60-79': 3,
  '80-100': 4,
  unknown: 5,
};

const ModelCalibrationCard = () => {
  const [confusionData, setConfusionData] = useState<ModelConfusionRow[] | null>(null);
  const [riskBucketData, setRiskBucketData] = useState<RiskBucketRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchCalibrationData = async () => {
      setLoading(true);
      setError(null);

      const { data: confusion, error: confusionError } = await supabase
        .from('psyop_model_confusion')
        .select('*');

      const { data: riskBuckets, error: riskBucketError } = await supabase
        .from('psyop_risk_buckets_human')
        .select('*');

      if (!isMounted) return;

      if (confusionError || riskBucketError) {
        console.error('Error fetching calibration data', { confusionError, riskBucketError });
        setError('خطا در بارگذاری آمار کالیبراسیون مدل');
      } else {
        setConfusionData(confusion || []);
        setRiskBucketData(riskBuckets || []);
      }

      setLoading(false);
    };

    fetchCalibrationData();

    return () => {
      isMounted = false;
    };
  }, []);

  const reviewedRows = useMemo(
    () => (confusionData ?? []).filter((row) => row.human_label !== 'unreviewed'),
    [confusionData]
  );

  const totalReviewed = useMemo(
    () => reviewedRows.reduce((sum, row) => sum + row.total_posts, 0),
    [reviewedRows]
  );

  const approxAgreement = useMemo(() => {
    return (confusionData ?? []).reduce((sum, row) => {
      const agree =
        (row.model_label === 'model_psyop' && row.human_label === 'confirmed') ||
        (row.model_label === 'model_not_psyop' && row.human_label === 'rejected');
      return agree ? sum + row.total_posts : sum;
    }, 0);
  }, [confusionData]);

  const approxDisagreement = useMemo(() => {
    return (confusionData ?? []).reduce((sum, row) => {
      const disagree =
        (row.model_label === 'model_psyop' && row.human_label === 'rejected') ||
        (row.model_label === 'model_not_psyop' && row.human_label === 'confirmed');
      return disagree ? sum + row.total_posts : sum;
    }, 0);
  }, [confusionData]);

  const agreementRate = useMemo(() => {
    return totalReviewed > 0 ? Math.round((approxAgreement / totalReviewed) * 100) : null;
  }, [approxAgreement, totalReviewed]);

  const sortedRiskBuckets = useMemo(() => {
    return [...(riskBucketData ?? [])].sort(
      (a, b) => (bucketOrder[a.risk_bucket] ?? 99) - (bucketOrder[b.risk_bucket] ?? 99)
    );
  }, [riskBucketData]);

  if (loading) {
    return (
      <Card className="bg-slate-900/40 border border-slate-800">
        <CardContent className="p-4 text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال بارگذاری آمار کالیبراسیون مدل...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-900/40 border border-slate-800">
        <CardContent className="p-4 text-xs text-red-400">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/40 border border-slate-800">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">کالیبراسیون مدل عملیات روانی</h3>
            <p className="text-[11px] text-slate-400">
              مقایسهٔ تصمیمات مدل با برچسب‌های تحلیلگران انسانی
            </p>
          </div>
          {agreementRate !== null && (
            <div className="text-right text-xs">
              <div className="text-slate-400">نرخ هم‌خوانی</div>
              <div className="text-emerald-400 font-semibold">{agreementRate}%</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">پست‌های بررسی‌شده</div>
            <div className="text-slate-100 font-semibold text-sm">{totalReviewed}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">هم‌خوانی تقریبی</div>
            <div className="text-emerald-400 font-semibold text-sm">{approxAgreement}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-2">
            <div className="text-slate-400">ناهم‌خوانی تقریبی</div>
            <div className="text-amber-400 font-semibold text-sm">{approxDisagreement}</div>
          </div>
        </div>

        <div className="space-y-3">
          <table className="w-full text-[11px] text-slate-300">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="py-1 text-right">برچسب مدل</th>
                <th className="py-1 text-right">برچسب انسانی</th>
                <th className="py-1 text-right">تعداد</th>
                <th className="py-1 text-right">میانگین ریسک</th>
              </tr>
            </thead>
            <tbody>
              {(confusionData ?? []).map((row) => (
                <tr
                  key={`${row.model_label}-${row.human_label}`}
                  className="border-b border-slate-800/80"
                >
                  <td className="py-1">{row.model_label}</td>
                  <td className="py-1">{row.human_label}</td>
                  <td className="py-1">{row.total_posts}</td>
                  <td className="py-1">{row.avg_risk_score != null ? row.avg_risk_score : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="w-full text-[11px] text-slate-300">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="py-1 text-right">بازه ریسک</th>
                <th className="py-1 text-right">وضعیت بررسی</th>
                <th className="py-1 text-right">تعداد</th>
              </tr>
            </thead>
            <tbody>
              {sortedRiskBuckets.map((row) => (
                <tr
                  key={`${row.risk_bucket}-${row.human_label}`}
                  className="border-b border-slate-800/80"
                >
                  <td className="py-1">{row.risk_bucket}</td>
                  <td className="py-1">{row.human_label}</td>
                  <td className="py-1">{row.total_posts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModelCalibrationCard;
