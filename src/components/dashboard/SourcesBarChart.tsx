import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SourcesBarChartProps {
  data: Array<{ source: string; count: number; sourceURL?: string }>;
  onSourceClick?: (source: string, sourceURL?: string) => void;
}

const SourcesBarChart: React.FC<SourcesBarChartProps> = ({ data, onSourceClick }) => {
  return (
    <div className="bg-card rounded-lg p-6 shadow-card">
      <h3 className="text-lg font-bold mb-4 text-right">فعال‌ترین منابع خبری (Top 10)</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" />
          <YAxis 
            type="category" 
            dataKey="source" 
            width={90}
            style={{ fontSize: '0.875rem' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-medium">{payload[0].payload.source}</p>
                    <p className="text-sm text-primary font-bold">
                      {payload[0].value} مطلب
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar 
            dataKey="count" 
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
            onClick={(data) => {
              if (data.sourceURL) {
                window.open(data.sourceURL, '_blank');
              } else if (onSourceClick) {
                onSourceClick(data.source, data.sourceURL);
              }
            }}
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SourcesBarChart;
