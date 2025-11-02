import React from 'react';
import { Card } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment-jalaali';

interface ThreatLevelTimelineProps {
  data: Array<{
    date: string;
    Critical: number;
    High: number;
    Medium: number;
    Low: number;
  }>;
}

const ThreatLevelTimeline: React.FC<ThreatLevelTimelineProps> = ({ data }) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-right">روند سطح تهدید</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#DC2626" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#DC2626" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EA580C" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#EA580C" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.2}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => moment(value).format('jMMMM jDD')}
            className="text-xs"
          />
          <YAxis className="text-xs" />
          <Tooltip
            labelFormatter={(value) => moment(value).format('jYYYY/jMM/jDD')}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
          />
          <Legend 
            wrapperStyle={{ direction: 'rtl' }}
            formatter={(value) => {
              const labels: Record<string, string> = {
                Critical: 'بحرانی',
                High: 'بالا',
                Medium: 'متوسط',
                Low: 'پایین'
              };
              return labels[value] || value;
            }}
          />
          <Area 
            type="monotone" 
            dataKey="Critical" 
            stackId="1"
            stroke="#DC2626" 
            fillOpacity={1} 
            fill="url(#colorCritical)" 
          />
          <Area 
            type="monotone" 
            dataKey="High" 
            stackId="1"
            stroke="#EA580C" 
            fillOpacity={1} 
            fill="url(#colorHigh)" 
          />
          <Area 
            type="monotone" 
            dataKey="Medium" 
            stackId="1"
            stroke="#F59E0B" 
            fillOpacity={1} 
            fill="url(#colorMedium)" 
          />
          <Area 
            type="monotone" 
            dataKey="Low" 
            stackId="1"
            stroke="#10B981" 
            fillOpacity={1} 
            fill="url(#colorLow)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default ThreatLevelTimeline;
