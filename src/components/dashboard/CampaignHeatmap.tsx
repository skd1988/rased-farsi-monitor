import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfDay, subDays, eachDayOfInterval } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CampaignHeatmapProps {
  data: Array<{
    date: string;
    count: number;
  }>;
  onDayClick?: (date: string) => void;
}

const CampaignHeatmap: React.FC<CampaignHeatmapProps> = ({ data, onDayClick }) => {
  // Generate last 90 days
  const today = startOfDay(new Date());
  const days = eachDayOfInterval({
    start: subDays(today, 89),
    end: today
  });

  // Create a map of date to count
  const dateMap = new Map(
    data.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      item.count
    ])
  );

  // Get max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getIntensityColor = (count: number) => {
    if (count === 0) return 'bg-muted/40';
    const intensity = Math.min(count / maxCount, 1);

    if (intensity > 0.75) return 'bg-destructive';
    if (intensity > 0.5) return 'bg-destructive/80';
    if (intensity > 0.25) return 'bg-destructive/60';
    return 'bg-destructive/40';
  };

  // Group days by week
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg text-right">نقشه حرارتی فعالیت کمپین‌ها</CardTitle>
        <CardDescription className="text-right">۹۰ روز گذشته - هر مربع یک روز</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <div className="flex flex-col gap-1 min-w-[600px]" dir="ltr">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex gap-1">
                {week.map((day, dayIndex) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const count = dateMap.get(dateStr) || 0;
                  return (
                    <div
                      key={dayIndex}
                      className={cn(
                        'w-8 h-8 rounded-md border border-border/60 transition-all hover:scale-105 cursor-pointer relative group',
                        getIntensityColor(count)
                      )}
                      onClick={() => onDayClick?.(dateStr)}
                      title={`${format(day, 'PPP', { locale: faIR })}: ${count.toLocaleString('fa-IR')} حمله`}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 rounded-md border bg-background text-xs shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {format(day, 'PPP', { locale: faIR })}<br />
                        {count.toLocaleString('fa-IR')} حمله
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground justify-end">
          <span>کمتر</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-md border border-border/60 bg-muted/40" />
            <div className="w-4 h-4 rounded-md border border-border/60 bg-destructive/40" />
            <div className="w-4 h-4 rounded-md border border-border/60 bg-destructive/60" />
            <div className="w-4 h-4 rounded-md border border-border/60 bg-destructive/80" />
            <div className="w-4 h-4 rounded-md border border-border/60 bg-destructive" />
          </div>
          <span>بیشتر</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignHeatmap;
