import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, toPersianNumber } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'red' | 'orange' | 'yellow';
  pulse?: boolean;
}

const StatsCard = ({ title, value, icon, color, pulse }: StatsCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500',
    red: 'bg-red-500/10 text-red-500',
    orange: 'bg-orange-500/10 text-orange-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
  };

  return (
    <Card className={cn(pulse && 'animate-pulse')}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{toPersianNumber(value)}</p>
          </div>
          <div className={cn('text-4xl p-3 rounded-lg', colorClasses[color])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCard;