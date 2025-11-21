import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال بارگذاری آمار کالیبراسیون مدل...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">کالیبراسیون مدل عملیات روانی</CardTitle>
            <CardDescription>
              مقایسهٔ تصمیمات مدل با برچسب‌های تحلیلگران انسانی
            </CardDescription>
          </div>
          {agreementRate !== null && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">نرخ هم‌خوانی</div>
              <div className="text-lg font-semibold text-emerald-500">{agreementRate}%</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">پست‌های بررسی‌شده</div>
            <div className="text-lg font-semibold">{totalReviewed}</div>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">هم‌خوانی تقریبی</div>
            <div className="text-lg font-semibold text-emerald-600">{approxAgreement}</div>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">ناهم‌خوانی تقریبی</div>
            <div className="text-lg font-semibold text-amber-600">{approxDisagreement}</div>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-right">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 px-3">برچسب مدل</th>
                  <th className="py-2 px-3">برچسب انسانی</th>
                  <th className="py-2 px-3">تعداد</th>
                  <th className="py-2 px-3">میانگین ریسک</th>
                </tr>
              </thead>
              <tbody>
                {(confusionData ?? []).map((row) => (
                  <tr key={`${row.model_label}-${row.human_label}`} className="border-t">
                    <td className="py-2 px-3">{row.model_label}</td>
                    <td className="py-2 px-3">{row.human_label}</td>
                    <td className="py-2 px-3">{row.total_posts}</td>
                    <td className="py-2 px-3">
                      {row.avg_risk_score != null ? row.avg_risk_score : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-right">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 px-3">بازه ریسک</th>
                  <th className="py-2 px-3">وضعیت بررسی</th>
                  <th className="py-2 px-3">تعداد</th>
                </tr>
              </thead>
              <tbody>
                {sortedRiskBuckets.map((row) => (
                  <tr key={`${row.risk_bucket}-${row.human_label}`} className="border-t">
                    <td className="py-2 px-3">{row.risk_bucket}</td>
                    <td className="py-2 px-3">{row.human_label}</td>
                    <td className="py-2 px-3">{row.total_posts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModelCalibrationCard;
