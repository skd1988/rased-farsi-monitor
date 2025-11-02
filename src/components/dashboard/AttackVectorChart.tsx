import React from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { toPersianNumber } from '@/lib/utils';

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
        <BarChart 
          data={data} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <XAxis type="number" />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={90}
            style={{ fontSize: '12px', direction: 'rtl' }}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              direction: 'rtl'
            }}
            formatter={(value: number) => [toPersianNumber(value), 'تعداد']}
          />
          <Bar 
            dataKey="value" 
            radius={[0, 8, 8, 0]}
            onClick={(data) => onVectorClick?.(data.name)}
            className="cursor-pointer"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]}
                className="hover:opacity-90 transition-opacity"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default AttackVectorChart;
