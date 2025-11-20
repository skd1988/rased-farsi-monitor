import { translatePsyopTechnique } from '@/utils/psyopTranslations';
import { formatDistanceToNowIran } from '@/lib/dateUtils';
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

const STANCE_LABELS: Record<string, string> = {
  supportive: 'حمایتی',
  neutral: 'خنثی',
  legitimate_criticism: 'نقد مشروع',
  hostile_propaganda: 'تبلیغات خصمانه',
};

const STANCE_COLORS: Record<string, string> = {
  supportive: 'bg-emerald-600 text-white',
  neutral: 'bg-slate-500 text-white',
  legitimate_criticism: 'bg-blue-600 text-white',
  hostile_propaganda: 'bg-red-600 text-white',
};

const REVIEW_LABELS: Record<string, string> = {
  unreviewed: 'بررسی‌نشده',
  confirmed: 'تأیید شده',
  rejected: 'رد شده',
  needs_followup: 'نیاز به پیگیری',
};

const REVIEW_COLORS: Record<string, string> = {
  unreviewed: 'bg-slate-500 text-white',
  confirmed: 'bg-emerald-600 text-white',
  rejected: 'bg-red-600 text-white',
  needs_followup: 'bg-amber-500 text-white',
};

interface PsyOpCardProps {
  post: any;
  onViewAnalysis: (post: any) => void;
  onPrepareResponse?: (post: any) => void;
  onMarkFalsePositive?: (post: any) => void;
  onAddToCampaign?: (post: any) => void;
  onStatusChange?: (postId: string, status: string) => void;
}

const PsyOpCard: React.FC<PsyOpCardProps> = ({
  post,
  onViewAnalysis,
  onPrepareResponse,
  onMarkFalsePositive,
  onAddToCampaign,
  onStatusChange,
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

  const riskScore = post.psyop_risk_score ?? 0;
  const riskColor =
    riskScore >= 70
      ? 'bg-red-600 text-white'
      : riskScore >= 40
        ? 'bg-orange-500 text-white'
        : 'bg-green-600 text-white';

  const rawStance = post.stance_type ?? 'neutral';
  const stanceLabel = STANCE_LABELS[rawStance] ?? STANCE_LABELS.neutral;
  const stanceColor = STANCE_COLORS[rawStance] ?? STANCE_COLORS.neutral;

  const stanceBadge = (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${stanceColor}`}>
      {stanceLabel}
    </span>
  );

  const rawReview = post.psyop_review_status ?? 'unreviewed';
  const reviewLabel = REVIEW_LABELS[rawReview] ?? REVIEW_LABELS.unreviewed;
  const reviewColor = REVIEW_COLORS[rawReview] ?? REVIEW_COLORS.unreviewed;

  const reviewBadge = (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${reviewColor}`}>
      {reviewLabel}
    </span>
  );

  const hasCoordination = post.coordination_indicators &&
    Array.isArray(post.coordination_indicators) &&
    post.coordination_indicators.length > 0;

  const viralityPotential = post.virality_potential || 0;
  const isHighVirality = viralityPotential > 7;

  const alertStatus = post.alert_status || 'Unresolved';
  const isResolved = alertStatus === 'Resolved' || alertStatus === 'False Positive';

  const statusConfig = {
    'Unresolved': { emoji: '🔴', label: 'حل نشده', variant: 'destructive' as const },
    'Acknowledged': { emoji: '🟡', label: 'تأیید شده', variant: 'default' as const },
    'In Progress': { emoji: '🟠', label: 'در حال بررسی', variant: 'secondary' as const },
    'Resolved': { emoji: '🟢', label: 'حل شده', variant: 'outline' as const },
    'False Positive': { emoji: '⚪', label: 'مثبت کاذب', variant: 'outline' as const },
  };

  const currentStatus = statusConfig[alertStatus as keyof typeof statusConfig] || statusConfig['Unresolved'];

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all hover:shadow-lg border-l-4',
      colors.border,
      isResolved && 'opacity-60'
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
        {/* Status Badge */}
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Badge 
                variant={currentStatus.variant}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {currentStatus.emoji} {currentStatus.label}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card z-50">
              {Object.entries(statusConfig).map(([status, config]) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onStatusChange?.(post.id, status)}
                >
                  {config.emoji} {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Header */}
        <div className="space-y-2 pt-5">
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
              <DropdownMenuContent align="end" className="bg-card z-50">
                <DropdownMenuItem onClick={() => onAddToCampaign?.(post)}>
                  <FolderPlus className="ml-2 h-4 w-4" />
                  افزودن به کمپین
                </DropdownMenuItem>
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

          {/* Header metadata */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${riskColor}`}>
                  ریسک {riskScore}
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full font-semibold text-[11px]',
                  colors.bg,
                  colors.text
                )}>
                  {threatLevel}
                </span>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {stanceBadge}
                {reviewBadge}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
              <Badge variant="outline" className="text-[11px]">
                {post.source}
              </Badge>
              {post.source_credibility && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[11px]',
                    post.source_credibility === 'Known Enemy Source' && 'bg-danger/20 text-danger'
                  )}
                >
                  {post.source_credibility}
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNowIran(post.published_at)}
              </span>
            </div>
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
                  {translatePsyopTechnique(tech)}
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
