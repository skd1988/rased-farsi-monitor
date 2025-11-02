import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface PersonCardProps {
  person: {
    name_persian: string;
    name_english?: string;
    role: string;
    entity: string;
    totalAttacks: number;
    weekAttacks: number;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    topAccusations: string[];
    timeline: number[];
  };
  onViewDetails: () => void;
}

const PersonCard: React.FC<PersonCardProps> = ({ person, onViewDetails }) => {
  const severityColors = {
    Critical: { bg: 'bg-danger', text: 'text-danger', border: 'border-danger' },
    High: { bg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-600' },
    Medium: { bg: 'bg-yellow-600', text: 'text-yellow-600', border: 'border-yellow-600' },
    Low: { bg: 'bg-success', text: 'text-success', border: 'border-success' },
  };

  const colors = severityColors[person.severity];
  const sparklineData = person.timeline.map((value, index) => ({ value, index }));

  return (
    <Card className={cn('p-6 space-y-4 hover:shadow-lg transition-all border-r-4', colors.border)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{person.name_persian}</h3>
              {person.name_english && (
                <p className="text-xs text-muted-foreground">{person.name_english}</p>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">{person.role}</Badge>
            <Badge variant="outline">{person.entity}</Badge>
          </div>
        </div>

        <div className={cn('flex items-center gap-1 px-3 py-1 rounded-full', colors.bg, 'bg-opacity-20')}>
          <AlertTriangle className={cn('h-4 w-4', colors.text)} />
          <span className={cn('text-sm font-bold', colors.text)}>{person.severity}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-sm text-muted-foreground">مجموع حملات</span>
          <div className="text-2xl font-bold text-danger">{person.totalAttacks}</div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">این هفته</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{person.weekAttacks}</span>
            {person.weekAttacks > 5 && (
              <TrendingUp className="h-4 w-4 text-danger" />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">اتهامات رایج</span>
        <div className="flex flex-wrap gap-2">
          {person.topAccusations.slice(0, 3).map((accusation, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {accusation}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">روند حملات</span>
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={severityColors[person.severity].bg.replace('bg-', '#')} 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={onViewDetails}>
        مشاهده جزئیات
      </Button>
    </Card>
  );
};

export default PersonCard;
