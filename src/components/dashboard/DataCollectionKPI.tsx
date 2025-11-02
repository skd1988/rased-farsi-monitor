import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DataCollectionKPIProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  colorScheme: 'blue' | 'green' | 'purple' | 'health';
  trend?: string;
  healthStatus?: 'good' | 'warning' | 'error';
  onClick?: () => void;
}

const DataCollectionKPI = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colorScheme,
  trend,
  healthStatus,
  onClick
}: DataCollectionKPIProps) => {
  const getColorClasses = () => {
    switch (colorScheme) {
      case 'blue':
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400';
      case 'green':
        return 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400';
      case 'purple':
        return 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400';
      case 'health':
        if (healthStatus === 'good') return 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400';
        if (healthStatus === 'warning') return 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400';
        return 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400';
      default:
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <Card 
      className={cn(
        "transition-all hover:shadow-md",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("p-2 rounded-lg", getColorClasses())}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <span className="text-xs font-medium text-muted-foreground">
              {trend}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataCollectionKPI;
