import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { faIR } from 'date-fns/locale';

interface AttackIntensityMatrixProps {
  data: Array<{
    entity: string;
    periods: Array<{ date: string; count: number }>;
  }>;
  onCellClick: (entity: string, date: string) => void;
}

const AttackIntensityMatrix: React.FC<AttackIntensityMatrixProps> = ({
  data,
  onCellClick,
}) => {
  // Generate last 30 days
  const periods = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i);
    return format(date, 'yyyy-MM-dd');
  });

  const maxCount = Math.max(...data.flatMap(d => d.periods.map(p => p.count)), 1);

  const getIntensityColor = (count: number) => {
    if (count === 0) return 'bg-muted/30';
    const intensity = count / maxCount;
    if (intensity > 0.75) return 'bg-danger';
    if (intensity > 0.5) return 'bg-orange-600';
    if (intensity > 0.25) return 'bg-yellow-600';
    return 'bg-yellow-600/50';
  };

  return (
    <Card className="p-6 overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4">ماتریس شدت حملات</h3>
      <div className="min-w-[800px]">
        {/* Header - Time periods */}
        <div className="flex mb-2">
          <div className="w-40 flex-shrink-0" /> {/* Entity name space */}
          <div className="flex flex-1 gap-1">
            {periods.map((period, idx) => (
              idx % 3 === 0 && (
                <div key={period} className="flex-1 text-xs text-center text-muted-foreground">
                  {format(new Date(period), 'dd MMM', { locale: faIR })}
                </div>
              )
            ))}
          </div>
        </div>

        {/* Rows */}
        {data.map((entityData) => (
          <div key={entityData.entity} className="flex items-center mb-1">
            <div className="w-40 flex-shrink-0 text-sm font-medium truncate text-right pr-2">
              {entityData.entity}
            </div>
            <div className="flex flex-1 gap-1">
              {periods.map((period) => {
                const periodData = entityData.periods.find(p => p.date === period);
                const count = periodData?.count || 0;
                return (
                  <div
                    key={period}
                    className={cn(
                      'flex-1 h-8 rounded transition-all hover:scale-110 cursor-pointer',
                      getIntensityColor(count)
                    )}
                    onClick={() => onCellClick(entityData.entity, period)}
                    title={`${entityData.entity} - ${format(new Date(period), 'PP', { locale: faIR })}: ${count} حمله`}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>کمتر</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded bg-muted/30" />
            <div className="w-4 h-4 rounded bg-yellow-600/50" />
            <div className="w-4 h-4 rounded bg-yellow-600" />
            <div className="w-4 h-4 rounded bg-orange-600" />
            <div className="w-4 h-4 rounded bg-danger" />
          </div>
          <span>بیشتر</span>
        </div>
      </div>
    </Card>
  );
};

export default AttackIntensityMatrix;
