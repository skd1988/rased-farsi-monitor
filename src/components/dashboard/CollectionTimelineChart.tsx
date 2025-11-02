import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment-jalaali';
import { toPersianNumber } from '@/lib/utils';

interface CollectionTimelineChartProps {
  data: Array<{ date: string; count: number }>;
  onClick?: () => void;
}

const CollectionTimelineChart = ({ data, onClick }: CollectionTimelineChartProps) => {
  const totalPosts = data.reduce((sum, d) => sum + d.count, 0);

  // Format date to short Persian (Shamsi) format: "۱۲ فرو"
  const formatShortPersian = (dateStr: string): string => {
    try {
      const m = moment(dateStr);
      const day = toPersianNumber(m.jDate());
      const monthNames = ['فرو', 'ارد', 'خرد', 'تیر', 'مرد', 'شهر', 'مهر', 'آبا', 'آذر', 'دی', 'بهم', 'اسف'];
      const month = monthNames[m.jMonth()];
      return `${day} ${month}`;
    } catch {
      return dateStr;
    }
  };

  // Format date to full Persian (Shamsi) format: "۱۲ فروردین"
  const formatFullPersian = (dateStr: string): string => {
    try {
      const m = moment(dateStr);
      const day = toPersianNumber(m.jDate());
      const monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
      const month = monthNames[m.jMonth()];
      return `${day} ${month}`;
    } catch {
      return dateStr;
    }
  };

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
              tickFormatter={formatShortPersian}
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
              labelFormatter={formatFullPersian}
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
            کل: <span className="font-bold">{toPersianNumber(totalPosts)}</span> پست
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CollectionTimelineChart;
