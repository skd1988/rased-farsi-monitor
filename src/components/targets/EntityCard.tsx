import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, ChevronDown, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TargetAvatar } from './TargetAvatar';

interface EntityCardProps {
  entity: {
    name_persian: string;
    name_english?: string;
    entity_type: string;
    location: string;
    totalAttacks: number;
    weekAttacks: number;
    weekTrend: number;
    threatDistribution: { Critical: number; High: number; Medium: number; Low: number };
    topVectors: string[];
  };
  onExpand: () => void;
}

const EntityCard: React.FC<EntityCardProps> = ({ entity, onExpand }) => {
  const [expanded, setExpanded] = useState(false);

  const threatData = [
    { name: 'Critical', value: entity.threatDistribution.Critical, color: '#DC2626' },
    { name: 'High', value: entity.threatDistribution.High, color: '#EA580C' },
    { name: 'Medium', value: entity.threatDistribution.Medium, color: '#EAB308' },
    { name: 'Low', value: entity.threatDistribution.Low, color: '#22C55E' },
  ].filter(d => d.value > 0);

  return (
    <Card className="p-6 space-y-4 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          {/* Avatar with photo support */}
          <TargetAvatar 
            target={{
              name_persian: entity.name_persian,
              name_english: entity.name_english,
              photo_url: (entity as any).photo_url
            }}
            size="md"
            showUpload={false}
          />
          
          <div className="flex-1">
            <h3 className="text-xl font-bold">{entity.name_persian}</h3>
            {entity.name_english && (
              <p className="text-sm text-muted-foreground mt-1">{entity.name_english}</p>
            )}
            <div className="flex gap-2 mt-2">
              <Badge variant="outline">{entity.entity_type}</Badge>
              <Badge variant="secondary">{entity.location}</Badge>
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-danger">{entity.totalAttacks}</div>
          <div className="text-xs text-muted-foreground">مجموع حملات</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">حملات این هفته</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{entity.weekAttacks}</span>
            {entity.weekTrend !== 0 && (
              <div className={cn(
                'flex items-center gap-1 text-sm',
                entity.weekTrend > 0 ? 'text-danger' : 'text-success'
              )}>
                {entity.weekTrend > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{Math.abs(entity.weekTrend)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">توزیع تهدید</span>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={threatData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={35}
                  dataKey="value"
                >
                  {threatData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">بردارهای حمله رایج</span>
        <div className="flex flex-wrap gap-2">
          {entity.topVectors.slice(0, 3).map((vector, idx) => (
            <Badge key={idx} variant="destructive">
              {vector}
            </Badge>
          ))}
          {entity.topVectors.length > 3 && (
            <Badge variant="outline">+{entity.topVectors.length - 3} مورد</Badge>
          )}
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded) onExpand();
        }}
      >
        جزئیات کامل
        <ChevronDown className={cn(
          'h-4 w-4 transition-transform',
          expanded && 'transform rotate-180'
        )} />
      </Button>
    </Card>
  );
};

export default EntityCard;
