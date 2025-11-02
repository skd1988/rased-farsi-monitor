import React from 'react';
import { Card } from '@/components/ui/card';
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
    if (count === 0) return 'bg-muted/30';
    const intensity = count / maxCount;
    if (intensity > 0.75) return 'bg-danger';
    if (intensity > 0.5) return 'bg-danger/70';
    if (intensity > 0.25) return 'bg-danger/50';
    return 'bg-danger/30';
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
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-right">نقشه حرارتی فعالیت کمپین‌ها</h3>
      <div className="text-xs text-muted-foreground mb-2 text-right">
        ۹۰ روز گذشته - هر مربع یک روز
      </div>
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
                      'w-8 h-8 rounded transition-all hover:scale-110 cursor-pointer relative group',
                      getIntensityColor(count)
                    )}
                    onClick={() => onDayClick?.(dateStr)}
                    title={`${format(day, 'PPP', { locale: faIR })}: ${count.toLocaleString('fa-IR')} حمله`}
                  >
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
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
      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground justify-end">
        <span>کمتر</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-muted/30" />
          <div className="w-4 h-4 rounded bg-danger/30" />
          <div className="w-4 h-4 rounded bg-danger/50" />
          <div className="w-4 h-4 rounded bg-danger/70" />
          <div className="w-4 h-4 rounded bg-danger" />
        </div>
        <span>بیشتر</span>
      </div>
    </Card>
  );
};

export default CampaignHeatmap;
