import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SourceThreatChartProps {
  data: Array<{
    source: string;
    threat_multiplier: number;
    count: number;
  }>;
  onSourceClick?: (source: string) => void;
}

export function SourceThreatChart({ data, onSourceClick }: SourceThreatChartProps) {
  const getThreatColor = (multiplier: number) => {
    if (multiplier >= 2.0) return 'hsl(var(--destructive))';
    if (multiplier >= 1.5) return 'hsl(var(--warning))';
    if (multiplier >= 1.0) return 'hsl(var(--primary))';
    return 'hsl(var(--success))';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🎯 توزیع تهدید منابع</CardTitle>
        <CardDescription>
          رنگ‌ها نشان‌دهنده سطح تهدید منبع است
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis
              dataKey="source"
              type="category"
              width={70}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
                      <div className="font-bold">{data.source}</div>
                      <div className="text-sm">تعداد: {data.count}</div>
                      <div className="text-sm text-red-600">
                        ضریب تهدید: {data.threat_multiplier.toFixed(1)}x
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="count"
              onClick={(data) => onSourceClick?.(data.source)}
              style={{ cursor: 'pointer' }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getThreatColor(entry.threat_multiplier)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
