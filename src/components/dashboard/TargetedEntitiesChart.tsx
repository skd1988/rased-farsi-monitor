import React from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TargetedEntitiesChartProps {
  data: Array<{
    entity: string;
    count: number;
    percentage: number;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
  }>;
}

const TargetedEntitiesChart: React.FC<TargetedEntitiesChartProps> = ({ data }) => {
  const severityColors = {
    Critical: '#DC2626',
    High: '#EA580C',
    Medium: '#F59E0B',
    Low: '#10B981'
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-right">نهادهای هدف حملات جنگ روانی</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart 
          data={data} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" className="text-xs" />
          <YAxis 
            type="category" 
            dataKey="entity" 
            className="text-xs"
            width={90}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              direction: 'rtl'
            }}
            formatter={(value: number, name: string, props: any) => [
              `${value.toLocaleString('fa-IR')} حمله (${props.payload.percentage.toFixed(1)}%)`,
              'تعداد'
            ]}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={severityColors[entry.severity]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default TargetedEntitiesChart;
