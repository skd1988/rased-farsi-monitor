import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { faIR } from 'date-fns/locale';

interface CollectionTimelineChartProps {
  data: Array<{ date: string; count: number }>;
  onClick?: () => void;
}

const CollectionTimelineChart = ({ data, onClick }: CollectionTimelineChartProps) => {
  const totalPosts = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={onClick}>
      <CardHeader>
        <CardTitle className="text-base">روند جمع‌آوری (7 روز اخیر)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                try {
                  return format(parseISO(value), 'dd MMM', { locale: faIR });
                } catch {
                  return value;
                }
              }}
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '10px' }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '10px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              labelFormatter={(value) => {
                try {
                  return format(parseISO(value), 'dd MMMM', { locale: faIR });
                } catch {
                  return value;
                }
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', r: 3 }}
              name="تعداد پست"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="text-center mt-2">
          <p className="text-sm text-muted-foreground">
            کل: <span className="font-bold">{totalPosts}</span> پست
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CollectionTimelineChart;
