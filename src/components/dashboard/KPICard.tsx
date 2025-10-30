import React, { useEffect, useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  gradient: 'blue' | 'green' | 'orange' | 'purple';
  change?: number;
  isAlert?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  change,
  isAlert,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1000;
    const increment = end / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return (
    <div className={cn(
      'rounded-lg p-6 shadow-card transition-smooth hover:shadow-elevated',
      `gradient-${gradient}`
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="text-right flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className={cn(
            'text-3xl font-bold animate-counter',
            isAlert && value > 0 && 'text-danger'
          )}>
            {displayValue.toLocaleString('fa-IR')}
          </h3>
        </div>
        <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-sm">
        {change !== undefined && (
          <span className={cn(
            'font-medium',
            change >= 0 ? 'text-success' : 'text-danger'
          )}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
        <span className="text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  );
};

export default KPICard;
