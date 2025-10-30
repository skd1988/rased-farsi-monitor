import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface LanguagePieChartProps {
  data: Array<{ name: string; value: number; percentage: number }>;
}

const COLORS = {
  'فارسی': 'hsl(var(--primary))',
  'عربی': 'hsl(var(--success))',
  'English': 'hsl(var(--muted))',
};

const LanguagePieChart: React.FC<LanguagePieChartProps> = ({ data }) => {
  return (
    <div className="bg-card rounded-lg p-6 shadow-card">
      <h3 className="text-lg font-bold mb-4 text-right">توزیع زبان محتوا</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ percentage }) => `${percentage.toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-medium">{data.name}</p>
                    <p className="text-sm">تعداد: {data.value}</p>
                    <p className="text-sm text-primary font-bold">
                      {data.percentage.toFixed(1)}%
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => value}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LanguagePieChart;
