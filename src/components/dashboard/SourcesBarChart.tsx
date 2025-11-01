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

// Color gradient for bars
const getBarColor = (index: number, total: number): string => {
  const colors = [
    '#1e40af', // Dark blue - Top 1
    '#2563eb', // Blue - Top 2
    '#3b82f6', // Medium blue - Top 3
    '#60a5fa', // Light blue - 4
    '#93c5fd', // Lighter blue - 5
    '#7c3aed', // Purple - 6
    '#a78bfa', // Light purple - 7
    '#ec4899', // Pink - 8
    '#f472b6', // Light pink - 9
    '#fb923c'  // Orange - 10
  ];
  
  return colors[index] || '#bfdbfe';
};

const SourcesBarChart: React.FC<SourcesBarChartProps> = ({ data, onSourceClick }) => {
  // Prepare data with cleaned names
  const chartData = data.slice(0, 10).map((item, index) => ({
    ...item,
    displayName: cleanSourceName(item.source),
    originalSource: item.source,
    color: getBarColor(index, data.length)
  }));

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border">
      <h3 className="text-lg font-bold mb-4 text-right text-foreground">فعال‌ترین منابع خبری</h3>
      <ResponsiveContainer width="100%" height={450}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 40, left: 120, bottom: 5 }}
          barCategoryGap="15%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
          <XAxis 
            type="number" 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            type="category" 
            dataKey="displayName" 
            width={115}
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 13, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
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
            radius={[0, 6, 6, 0]}
            onClick={(data) => {
              if (data.sourceURL) {
                window.open(data.sourceURL, '_blank');
              } else if (onSourceClick) {
                onSourceClick(data.originalSource, data.sourceURL);
              }
            }}
            cursor="pointer"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList 
              dataKey="count" 
              position="right" 
              style={{ 
                fill: 'hsl(var(--foreground))', 
                fontSize: 12, 
                fontWeight: 600 
              }} 
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SourcesBarChart;
