import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface CountryPieChartProps {
  data: Array<{
    country: string;
    count: number;
    percentage: number;
    fill: string;
  }>;
  loading?: boolean;
}

const COUNTRY_COLORS: Record<string, string> = {
  'ایران': '#239B56',
  'قطر': '#8E44AD',
  'عربستان سعودی': '#E67E22',
  'امارات': '#3498DB',
  'مصر': '#E74C3C',
  'عراق': '#F39C12',
  'لبنان': '#1ABC9C',
  'آمریکا': '#34495E',
  'بریتانیا': '#2980B9',
  'فرانسه': '#9B59B6',
  'آلمان': '#16A085',
  'ترکیه': '#C0392B',
  'روسیه': '#7F8C8D',
  'نامشخص': '#BDC3C7'
};

const COUNTRY_FLAGS: Record<string, string> = {
  'ایران': '🇮🇷',
  'قطر': '🇶🇦',
  'عربستان سعودی': '🇸🇦',
  'امارات': '🇦🇪',
  'مصر': '🇪🇬',
  'عراق': '🇮🇶',
  'لبنان': '🇱🇧',
  'آمریکا': '🇺🇸',
  'بریتانیا': '🇬🇧',
  'فرانسه': '🇫🇷',
  'آلمان': '🇩🇪',
  'ترکیه': '🇹🇷',
  'روسیه': '🇷🇺',
  'نامشخص': '🌐'
};

// Convert number to Persian digits
const toPersianNumber = (num: number): string => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
};

const CountryPieChart = ({ data, loading = false }: CountryPieChartProps) => {
  // Loading State
  if (loading) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🌍</span>
            <span>توزیع محتوا بر اساس کشور</span>
          </CardTitle>
          <CardDescription>منابع خبری از کدام کشورها هستند</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <div className="space-y-4 w-full">
              <Skeleton className="h-64 w-64 rounded-full mx-auto" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-2/3 mx-auto" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty State
  if (!data || data.length === 0) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🌍</span>
            <span>توزیع محتوا بر اساس کشور</span>
          </CardTitle>
          <CardDescription>منابع خبری از کدام کشورها هستند</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
            <div className="text-6xl mb-4">🌍</div>
            <p className="text-lg">هنوز داده‌ای برای نمایش وجود ندارد</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data with colors
  const chartData = data.map(item => ({
    ...item,
    fill: COUNTRY_COLORS[item.country] || '#95A5A6'
  }));

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const flag = COUNTRY_FLAGS[data.country] || '🌐';
      
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-foreground flex items-center gap-2">
            <span>{flag}</span>
            <span>{data.country}</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            تعداد: {toPersianNumber(data.count)} مطلب
          </p>
          <p className="text-sm text-muted-foreground">
            درصد: {toPersianNumber(Math.round(data.percentage))}٪
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom Legend
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-col gap-2 mt-4 pr-4">
        {payload.map((entry: any, index: number) => {
          const flag = COUNTRY_FLAGS[entry.payload.country] || '🌐';
          const percentage = Math.round(entry.payload.percentage);
          
          return (
            <div 
              key={`legend-${index}`} 
              className="flex items-center gap-2 text-sm hover-scale cursor-pointer"
            >
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-lg">{flag}</span>
              <span className="text-foreground font-medium flex-1">
                {entry.payload.country}
              </span>
              <span className="text-muted-foreground">
                {toPersianNumber(percentage)}٪
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🌍</span>
          <span>توزیع محتوا بر اساس کشور</span>
        </CardTitle>
        <CardDescription>منابع خبری از کدام کشورها هستند</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={120}
                innerRadius={60}
                fill="#8884d8"
                dataKey="count"
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.fill}
                    className="hover:opacity-80 transition-opacity duration-200"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                content={<CustomLegend />}
                layout="vertical"
                align="right"
                verticalAlign="middle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default CountryPieChart;
