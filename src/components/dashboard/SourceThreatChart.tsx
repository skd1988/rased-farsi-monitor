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
    <Card className="bg-slate-900/60 border border-slate-800 rounded-xl">
      <CardHeader>
        <CardTitle>🎯 توزیع تهدید منابع</CardTitle>
        <CardDescription>
          رنگ‌ها نشان‌دهنده سطح تهدید منبع است
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical" margin={{ left: 90, right: 10, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
            <XAxis
              type="number"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              dataKey="source"
              type="category"
              width={120}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '10px',
                direction: 'rtl',
                fontFamily: 'inherit'
              }}
              formatter={(value: number, _name, props) => {
                const payload = props?.payload as { threat_multiplier: number; source: string } | undefined;
                return [
                  `${value} پست`,
                  payload ? `ضریب تهدید ${payload.threat_multiplier.toFixed(1)}x` : 'تعداد'
                ];
              }}
            />
            <Bar
              dataKey="count"
              onClick={(data) => onSourceClick?.((data as { source: string }).source)}
              className="cursor-pointer"
              radius={[0, 10, 10, 0]}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getThreatColor(entry.threat_multiplier)}
                  className="transition-all duration-200 hover:opacity-90"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
