import React from 'react';
import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AttackVectorChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  onVectorClick?: (vector: string) => void;
}

const COLORS = [
  '#DC2626', // Red
  '#EA580C', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#84CC16', // Lime
  '#10B981', // Green
  '#0EA5E9', // Sky
  '#6366F1', // Indigo
];

const AttackVectorChart: React.FC<AttackVectorChartProps> = ({ data, onVectorClick }) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-right">توزیع بردارهای حمله</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            innerRadius={50}
            fill="#8884d8"
            dataKey="value"
            onClick={(data) => onVectorClick?.(data.name)}
            className="cursor-pointer"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]}
                className="hover:opacity-80 transition-opacity"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              direction: 'rtl'
            }}
            formatter={(value: number) => [value.toLocaleString('fa-IR'), 'تعداد']}
          />
          <Legend 
            wrapperStyle={{ direction: 'rtl' }}
            formatter={(value) => value}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default AttackVectorChart;
