import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, AlertTriangle, TrendingUp, Briefcase, Building, MapPin, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { translateNarrativeTheme } from '@/utils/narrativeTranslations';

interface PersonCardProps {
  person: {
    name_persian: string;
    name_english?: string;
    name_arabic?: string;
    entity_type: string;
    position: string;
    organization: string;
    category: string;
    country: string;
    attack_nature: string;
    totalAttacks: number;
    weekAttacks: number;
    threatLevels: { Critical: number; High: number; Medium: number; Low: number };
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    topAccusations: string[];
    dominantNarrative: string;
    sources: string[];
    timeline: number[];
    riskScore: number;
    firstAttack: string;
    lastAttack: string;
  };
  onViewDetails: () => void;
}

const PersonCard: React.FC<PersonCardProps> = ({ person, onViewDetails }) => {
  // ⚠️ DEBUG: Log person data structure
  React.useEffect(() => {
    console.log('PersonCard received:', {
      name_persian: person.name_persian,
      name_persian_type: typeof person.name_persian,
      category: person.category,
      full_person: person
    });
  }, [person]);

  const severityColors = {
    Critical: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger', badge: 'bg-danger' },
    High: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-600', border: 'border-orange-600', badge: 'bg-orange-600' },
    Medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-600', border: 'border-yellow-600', badge: 'bg-yellow-600' },
    Low: { bg: 'bg-success/10', text: 'text-success', border: 'border-success', badge: 'bg-success' },
  };

  const riskLabels: Record<string, string> = {
    Critical: 'خطر بسیار بالا',
    High: 'خطر بالا',
    Medium: 'خطر متوسط',
    Low: 'خطر پایین'
  };

  // ⚠️ SAFETY: Extract name safely even if structure is malformed
  const getName = () => {
    if (typeof person.name_persian === 'string' && person.name_persian) {
      return person.name_persian;
    }
    if (typeof person.name_english === 'string' && person.name_english) {
      return person.name_english;
    }
    // Fallback: try to extract from object if it was stringified
    if (person.name_persian && typeof person.name_persian === 'object') {
      return (person.name_persian as any).name_persian || 'نامشخص';
    }
    return 'نامشخص';
  };

  const displayName = getName();

  const colors = severityColors[person.severity];
  const sparklineData = person.timeline.map((value, index) => ({ value, index }));

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'رهبر سیاسی': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
      'فرمانده نظامی': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
      'مرجع دینی': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
      'سخنگو': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
      'فعال': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
  };

  return (
    <Card className={cn('p-6 space-y-4 hover:shadow-lg transition-all border-r-4', colors.border)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg', colors.badge)}>
            {displayName?.[0]?.toUpperCase() || '?'}
          </div>
          
          <div>
            {/* Name in multiple languages */}
            <h3 className="font-bold text-lg">{displayName}</h3>
            {person.name_english && person.name_english !== displayName && typeof person.name_english === 'string' && (
              <div className="text-xs text-muted-foreground">{person.name_english}</div>
            )}
            {person.name_arabic && typeof person.name_arabic === 'string' && (
              <div className="text-xs text-muted-foreground font-arabic">{person.name_arabic}</div>
            )}
          </div>
        </div>
        
        {/* Risk Badge */}
        <div className={cn('px-3 py-1 rounded-full text-xs font-medium', colors.bg, colors.text)}>
          {riskLabels[person.severity]}
        </div>
      </div>

      {/* Entity Info */}
      <div className="space-y-2">
        {person.position && person.position !== 'نامشخص' && person.position !== 'Unknown' && (
          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <span>{person.position}</span>
          </div>
        )}
        
        {person.organization && person.organization !== 'نامشخص' && person.organization !== 'Unknown' && (
          <div className="flex items-center gap-2 text-sm">
            <Building className="w-4 h-4 text-muted-foreground" />
            <span>{person.organization}</span>
          </div>
        )}
        
        {person.country && person.country !== 'نامشخص' && person.country !== 'Unknown' && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>{person.country}</span>
          </div>
        )}
      </div>

      {/* Category */}
      {person.category && person.category !== 'نامشخص' && (
        <Badge className={getCategoryColor(person.category)}>
          {person.category}
        </Badge>
      )}

      {/* Attack Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-card-foreground/5 rounded">
          <div className="text-2xl font-bold text-danger">{person.totalAttacks}</div>
          <div className="text-xs text-muted-foreground">مجموع حملات</div>
        </div>
        
        <div className="text-center p-2 bg-card-foreground/5 rounded">
          <div className="text-2xl font-bold text-orange-600">
            {person.threatLevels.Critical + person.threatLevels.High}
          </div>
          <div className="text-xs text-muted-foreground">تهدید بالا</div>
        </div>
        
        <div className="text-center p-2 bg-card-foreground/5 rounded">
          <div className="text-2xl font-bold text-blue-600">{person.sources.length}</div>
          <div className="text-xs text-muted-foreground">منابع</div>
        </div>
      </div>

      {/* Dominant Narrative */}
      {person.dominantNarrative && person.dominantNarrative !== 'نامشخص' && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">روایت غالب:</div>
          <Badge variant="outline" className="text-xs">
            {translateNarrativeTheme(person.dominantNarrative)}
          </Badge>
        </div>
      )}

      {/* Top Accusations */}
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">اتهامات رایج:</span>
        <div className="flex flex-wrap gap-2">
          {person.topAccusations.slice(0, 3).map((accusation, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {accusation}
            </Badge>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>روند حملات (۱۴ روز اخیر)</span>
          {person.weekAttacks > 5 && (
            <div className="flex items-center gap-1 text-danger">
              <TrendingUp className="h-3 w-3" />
              <span>فعال</span>
            </div>
          )}
        </div>
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="currentColor"
                className={colors.text}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Timeline Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
        <div>
          اولین: {new Date(person.firstAttack).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}
        </div>
        <div>
          آخرین: {new Date(person.lastAttack).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onViewDetails}>
          مشاهده جزئیات
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          className={cn('text-xs', colors.text)}
          title="نمره خطر"
        >
          <Target className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

export default PersonCard;
