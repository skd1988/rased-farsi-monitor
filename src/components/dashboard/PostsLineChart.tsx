import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatPersianDateTime } from '@/lib/dateUtils';
import moment from 'moment-jalaali';

interface PostsLineChartProps {
  data: Array<{ date: string; count: number }>;
}

const PostsLineChart: React.FC<PostsLineChartProps> = ({ data }) => {
  return (
    <div className="bg-card rounded-lg p-6 shadow-card">
      <h3 className="text-lg font-bold mb-4 text-right">روند انتشار مطالب (30 روز اخیر)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => {
              const m = moment(new Date(value));
              return m.format('jMM/jDD');
            }}
            className="text-xs"
          />
          <YAxis />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-medium">
                      تاریخ: {formatPersianDateTime(payload[0].payload.date)}
                    </p>
                    <p className="text-sm text-primary font-bold">
                      تعداد: {payload[0].value} مطلب
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line 
            type="monotone" 
            dataKey="count" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PostsLineChart;
