import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Users, 
  Target, 
  Flame, 
  AlertTriangle, 
  MoreVertical,
  Eye,
  MessageSquare,
  XCircle,
  FolderPlus,
  RefreshCw,
  Bell,
  Archive,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';

interface PsyOpCardProps {
  post: any;
  onViewAnalysis: (post: any) => void;
  onPrepareResponse?: (post: any) => void;
  onMarkFalsePositive?: (post: any) => void;
  onAddToCampaign?: (post: any) => void;
}

const PsyOpCard: React.FC<PsyOpCardProps> = ({
  post,
  onViewAnalysis,
  onPrepareResponse,
  onMarkFalsePositive,
  onAddToCampaign,
}) => {
  const threatColors = {
    Critical: { border: 'border-l-danger', bg: 'bg-danger/10', text: 'text-danger' },
    High: { border: 'border-l-orange-600', bg: 'bg-orange-600/10', text: 'text-orange-600' },
    Medium: { border: 'border-l-yellow-600', bg: 'bg-yellow-600/10', text: 'text-yellow-600' },
    Low: { border: 'border-l-success', bg: 'bg-success/10', text: 'text-success' },
  };

  const urgencyColors = {
    Immediate: 'bg-danger text-white',
    High: 'bg-orange-600 text-white',
    Medium: 'bg-yellow-600 text-white',
    Low: 'bg-success text-white',
    'Monitor Only': 'bg-muted text-muted-foreground',
  };

  const threatLevel = post.threat_level || 'Medium';
  const colors = threatColors[threatLevel as keyof typeof threatColors] || threatColors.Medium;
  
  const hasCoordination = post.coordination_indicators && 
    Array.isArray(post.coordination_indicators) && 
    post.coordination_indicators.length > 0;

  const viralityPotential = post.virality_potential || 0;
  const isHighVirality = viralityPotential > 7;

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all hover:shadow-lg border-l-4',
      colors.border
    )}>
      {hasCoordination && post.coordination_indicators.length > 2 && (
        <div className="absolute top-2 left-2">
          <div className="relative">
            <div className="absolute w-2 h-2 bg-danger rounded-full animate-ping" />
            <div className="w-2 h-2 bg-danger rounded-full" />
          </div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base line-clamp-2 flex-1 text-right">
              {post.title}
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <RefreshCw className="ml-2 h-4 w-4" />
                  تحلیل مجدد
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell className="ml-2 h-4 w-4" />
                  ایجاد هشدار
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive className="ml-2 h-4 w-4" />
                  آرشیو
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share2 className="ml-2 h-4 w-4" />
                  اشتراک‌گذاری
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {post.source}
            </Badge>
            {post.source_credibility && (
              <Badge 
                variant="secondary" 
                className={cn(
                  'text-xs',
                  post.source_credibility === 'Known Enemy Source' && 'bg-danger/20 text-danger'
                )}
              >
                {post.source_credibility}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.published_at), { 
                locale: faIR, 
                addSuffix: true 
              })}
            </span>
          </div>
        </div>

        {/* Target Section */}
        <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-danger" />
            <span>هدف:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {post.target_entity && Array.isArray(post.target_entity) && post.target_entity.length > 0 ? (
              <>
                <Badge className="bg-danger text-white text-sm">
                  {post.target_entity[0]}
                </Badge>
                {post.target_entity.slice(1, 3).map((entity: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {entity}
                  </Badge>
                ))}
                {post.target_entity.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{post.target_entity.length - 3} دیگر
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">نامشخص</span>
            )}
          </div>
          
          {post.target_persons && Array.isArray(post.target_persons) && post.target_persons.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Users className="h-3 w-3 text-muted-foreground" />
              <div className="flex flex-wrap gap-1">
                {post.target_persons.slice(0, 2).map((person: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {person}
                  </Badge>
                ))}
                {post.target_persons.length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    و {post.target_persons.length - 2} نفر دیگر
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Analysis Section */}
        <div className="space-y-2">
          {post.psyop_type && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">نوع:</span>
              <Badge variant="destructive" className="text-xs">
                {post.psyop_type}
              </Badge>
            </div>
          )}
          
          {post.psyop_technique && Array.isArray(post.psyop_technique) && post.psyop_technique.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">تکنیک‌ها:</span>
              {post.psyop_technique.slice(0, 3).map((tech: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tech}
                </Badge>
              ))}
              {post.psyop_technique.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{post.psyop_technique.length - 3} مورد
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">سطح تهدید</span>
            <Badge 
              className={cn(
                'w-full justify-center text-xs font-bold',
                colors.bg,
                colors.text
              )}
            >
              {threatLevel}
            </Badge>
          </div>
          
          {post.urgency_level && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">فوریت</span>
              <Badge 
                className={cn(
                  'w-full justify-center text-xs',
                  urgencyColors[post.urgency_level as keyof typeof urgencyColors]
                )}
              >
                {post.urgency_level}
              </Badge>
            </div>
          )}
        </div>

        {/* Virality Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">پتانسیل ویروس شدن</span>
            <span className="font-medium flex items-center gap-1">
              {viralityPotential}/10
              {isHighVirality && <Flame className="h-3 w-3 text-orange-600" />}
            </span>
          </div>
          <Progress value={viralityPotential * 10} className="h-2" />
        </div>

        {/* Confidence */}
        {post.psyop_confidence && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">اطمینان</span>
              <span className="font-medium">{post.psyop_confidence}%</span>
            </div>
            <Progress value={post.psyop_confidence} className="h-2" />
          </div>
        )}

        {/* Coordination Indicators */}
        {hasCoordination && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-xs text-orange-600 cursor-help">
                  <AlertTriangle className="h-4 w-4" />
                  <span>نشانه‌های هماهنگی ({post.coordination_indicators.length})</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  {post.coordination_indicators.map((indicator: string, idx: number) => (
                    <div key={idx} className="text-xs">• {indicator}</div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t">
          <Button 
            onClick={() => onViewAnalysis(post)}
            className="flex-1"
            size="sm"
          >
            <Eye className="ml-2 h-4 w-4" />
            مشاهده تحلیل
          </Button>
          
          {(post.urgency_level === 'Immediate' || post.urgency_level === 'High') && (
            <Button 
              onClick={() => onPrepareResponse?.(post)}
              variant="secondary"
              size="sm"
            >
              <MessageSquare className="ml-2 h-4 w-4" />
              پاسخ
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => onMarkFalsePositive?.(post)}
            variant="ghost"
            size="sm"
            className="flex-1 text-xs"
          >
            <XCircle className="ml-2 h-3 w-3" />
            مثبت کاذب
          </Button>
          <Button 
            onClick={() => onAddToCampaign?.(post)}
            variant="ghost"
            size="sm"
            className="flex-1 text-xs"
          >
            <FolderPlus className="ml-2 h-3 w-3" />
            افزودن به کمپین
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default PsyOpCard;
