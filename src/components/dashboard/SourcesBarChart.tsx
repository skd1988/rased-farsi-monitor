import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface SourcesBarChartProps {
  data: Array<{ source: string; count: number; sourceURL?: string }>;
  onSourceClick?: (source: string, sourceURL?: string) => void;
}

// Clean up source names for better display
const cleanSourceName = (source: string): string => {
  const sourceMap: Record<string, string> = {
    'shafaq.com': 'شفق نیوز',
    'shafaaq.com': 'شفق نیوز',
    'shafaq': 'شفق نیوز',
    'news.google.com': 'گوگل نیوز',
    'google.com': 'گوگل نیوز',
    'facebook.com': 'فیسبوک',
    'twitter.com': 'توییتر',
    'x.com': 'ایکس (توییتر)',
    'instagram.com': 'اینستاگرام',
    'telegram.org': 'تلگرام',
    'youtube.com': 'یوتیوب',
    'baghdadtoday.news': 'بغداد الیوم',
    'alsumaria.tv': 'السومریة',
    'rudaw.net': 'رووداو',
    'aljazeera.net': 'الجزیرة',
    'alarabiya.net': 'العربیة',
    'bbc.com': 'بی‌بی‌سی',
    'cnn.com': 'سی‌ان‌ان',
    'reuters.com': 'رویترز',
    'almasdar': 'المصدر',
    'almanar': 'المنار',
    'almayadeen': 'المیادین'
  };

  // Try exact match first
  const lowerSource = source.toLowerCase().trim();
  if (sourceMap[lowerSource]) {
    return sourceMap[lowerSource];
  }

  // Try partial match
  for (const [key, value] of Object.entries(sourceMap)) {
    if (lowerSource.includes(key)) {
      return value;
    }
  }

  // If source is already in Arabic/Persian, keep it
  if (/[\u0600-\u06FF]/.test(source)) {
    return source.length > 25 ? source.substring(0, 22) + '...' : source;
  }

  // For English domains, clean and truncate
  const cleaned = source.replace(/\.(com|net|org|tv|news)$/i, '');
  return cleaned.length > 20 ? cleaned.substring(0, 17) + '...' : cleaned;
};

// Color gradient for bars - professional palette
const getBarColor = (index: number): string => {
  const colors = [
    '#1e40af', // Dark blue - Top 1
    '#2563eb', // Blue - Top 2
    '#3b82f6', // Medium blue - Top 3
    '#f59e0b', // Orange - 4
    '#10b981', // Green - 5
    '#8b5cf6', // Purple - 6
    '#ec4899', // Pink - 7
    '#ef4444', // Red - 8
    '#6366f1', // Indigo - 9
    '#14b8a6'  // Teal - 10
  ];
  
  return colors[index] || '#bfdbfe';
};

// Custom Y-axis tick with proper RTL support using foreignObject
const CustomYAxisTick = ({ x, y, payload }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-190} y={-12} width={180} height={24}>
        <div 
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '10px',
            direction: 'rtl',
            fontSize: '14px',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {payload.value}
        </div>
      </foreignObject>
    </g>
  );
};

const SourcesBarChart: React.FC<SourcesBarChartProps> = ({ data, onSourceClick }) => {
  // Prepare data with cleaned names
  const chartData = data.slice(0, 10).map((item, index) => ({
    ...item,
    displayName: cleanSourceName(item.source),
    originalSource: item.source,
    color: getBarColor(index)
  }));

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border">
      <h3 className="text-lg font-bold mb-6 text-right text-foreground">فعال‌ترین منابع خبری</h3>
      <ResponsiveContainer width="100%" height={500}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 60, left: 200, bottom: 10 }}
          barGap={8}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
          <XAxis 
            type="number" 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13 }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--muted))' }}
          />
          <YAxis 
            type="category" 
            dataKey="displayName" 
            width={190}
            tick={<CustomYAxisTick />}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-xl">
                    <p className="text-sm font-bold text-foreground mb-1" dir="rtl">
                      {data.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2" dir="ltr">
                      {data.originalSource}
                    </p>
                    <p className="text-base font-bold text-primary" dir="rtl">
                      {payload[0].value} مطلب
                    </p>
                  </div>
                );
              }
              return null;
            }}
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
          />
          <Bar 
            dataKey="count" 
            radius={[0, 8, 8, 0]}
            onClick={(data) => {
              if (data.sourceURL) {
                window.open(data.sourceURL, '_blank');
              } else if (onSourceClick) {
                onSourceClick(data.originalSource, data.sourceURL);
              }
            }}
            cursor="pointer"
            maxBarSize={35}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList 
              dataKey="count" 
              position="right" 
              style={{ 
                fill: 'hsl(var(--foreground))', 
                fontSize: 13, 
                fontWeight: 700 
              }} 
              offset={10}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SourcesBarChart;
