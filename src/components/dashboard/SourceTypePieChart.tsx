import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface SourceTypePieChartProps {
  data: Array<{
    name: string;
    value: number;
    fill: string;
  }>;
}

const SourceTypePieChart: React.FC<SourceTypePieChartProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderLabel = (entry: any) => {
    const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
    return `${percentage}%`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-right">توزیع نوع منابع</CardTitle>
        <CardDescription className="text-right">وب‌سایت‌ها در مقابل شبکه‌های اجتماعی</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => {
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return [`${value} (${percentage}%)`, name];
              }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ direction: 'rtl' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SourceTypePieChart;
