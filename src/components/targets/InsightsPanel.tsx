import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, AlertTriangle, Target, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
  type: 'danger' | 'warning' | 'info';
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface InsightsPanelProps {
  insights: Insight[];
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights }) => {
  const typeColors = {
    danger: { bg: 'bg-danger/10', border: 'border-danger', text: 'text-danger' },
    warning: { bg: 'bg-orange-600/10', border: 'border-orange-600', text: 'text-orange-600' },
    info: { bg: 'bg-primary/10', border: 'border-primary', text: 'text-primary' },
  };

  return (
    <Card className="p-6 space-y-4 sticky top-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">بینش‌های کلیدی</h3>
      </div>

      <div className="space-y-3">
        {insights.map((insight, idx) => {
          const colors = typeColors[insight.type];
          return (
            <Card 
              key={idx} 
              className={cn(
                'p-4 border-r-4',
                colors.border,
                colors.bg
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-lg', colors.bg)}>
                  {insight.icon}
                </div>
                <div className="flex-1">
                  <h4 className={cn('font-semibold mb-1', colors.text)}>
                    {insight.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {insight.description}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="pt-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          بینش‌ها توسط هوش مصنوعی تولید شده‌اند
        </p>
      </div>
    </Card>
  );
};

export default InsightsPanel;

// Generate sample insights
export const generateInsights = (data: any): Insight[] => {
  return [
    {
      type: 'danger',
      icon: <AlertTriangle className="h-5 w-5 text-danger" />,
      title: 'افزایش ناگهانی حملات',
      description: 'ایران ۳ برابر بیشتر از هفته گذشته مورد حمله قرار گرفته است',
    },
    {
      type: 'warning',
      icon: <TrendingUp className="h-5 w-5 text-orange-600" />,
      title: 'بردار حمله جدید',
      description: 'استفاده از "اتهام فساد" ۵۰٪ افزایش یافته است',
    },
    {
      type: 'info',
      icon: <Target className="h-5 w-5 text-primary" />,
      title: 'الگوی هماهنگی',
      description: 'حملات هماهنگ شده به چند نهاد در روزهای پنجشنبه تشخیص داده شد',
    },
    {
      type: 'warning',
      icon: <Clock className="h-5 w-5 text-orange-600" />,
      title: 'زمان‌بندی مشکوک',
      description: 'اوج حملات بین ساعت ۱۸-۲۱ به وقت محلی است',
    },
  ];
};
