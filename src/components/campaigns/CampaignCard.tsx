import React from 'react';
import { formatIranDate, formatDistanceToNowIran } from '@/lib/dateUtils';
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
  TrendingUp,
  TrendingDown,
  Minus,
  MoreVertical,
  Eye,
  MessageSquare,
  RefreshCw,
  FileText,
  Target,
  Users,
  Calendar,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';

interface CampaignCardProps {
  campaign: any;
  onClick: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  onClick,
  onEdit,
  onArchive,
  onDelete,
}) => {
  const statusColors = {
    Active: { bg: 'bg-danger', text: 'text-white', animate: 'animate-pulse' },
    Monitoring: { bg: 'bg-orange-600', text: 'text-white', animate: '' },
    Declining: { bg: 'bg-yellow-600', text: 'text-white', animate: '' },
    Ended: { bg: 'bg-muted', text: 'text-muted-foreground', animate: '' },
  };

  const counterStatusColors = {
    'Not Started': 'bg-muted text-muted-foreground',
    'In Progress': 'bg-blue-600 text-white',
    'Launched': 'bg-orange-600 text-white',
    'Successful': 'bg-success text-white',
  };

  const status = campaign.status || 'Active';
  const colors = statusColors[status as keyof typeof statusColors] || statusColors.Active;

  const duration = campaign.end_date
    ? differenceInDays(new Date(campaign.end_date), new Date(campaign.start_date))
    : differenceInDays(new Date(), new Date(campaign.start_date));

  // Mock data for posts count (would come from junction table)
  const postsCount = 24;
  const recentGrowth = 15;
  const isGrowing = recentGrowth > 0;

  return (
    <Card 
      className="p-6 space-y-4 hover:shadow-lg transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-2">{campaign.campaign_name}</h3>
          <Badge className={cn(colors.bg, colors.text, colors.animate)}>
            {status}
          </Badge>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
              ویرایش
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive?.(); }}>
              آرشیو
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
              className="text-danger"
            >
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Timeline Visualization */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatIranDate(campaign.start_date, 'jYYYY/jMM/jDD')}</span>
          {campaign.end_date && (
            <span>{formatIranDate(campaign.end_date, 'jYYYY/jMM/jDD')}</span>
          )}
        </div>
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("absolute h-full transition-all", colors.bg)}
            style={{ 
              width: campaign.end_date 
                ? '100%' 
                : `${Math.min((duration / 90) * 100, 100)}%` 
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNowIran(campaign.start_date)}
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{postsCount}</div>
          <div className="text-xs text-muted-foreground">مطلب</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{duration}</div>
          <div className="text-xs text-muted-foreground">روز</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{campaign.impact_assessment}/10</div>
          <div className="text-xs text-muted-foreground">تاثیر</div>
        </div>
        <div className="text-center">
          {campaign.orchestrator && (
            <Badge variant="destructive" className="text-xs">
              {campaign.orchestrator}
            </Badge>
          )}
        </div>
      </div>

      {/* Impact Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">میزان تاثیر</span>
          <span className="font-medium">{campaign.impact_assessment}/10</span>
        </div>
        <Progress 
          value={campaign.impact_assessment * 10} 
          className={cn(
            "h-2",
            campaign.impact_assessment >= 7 && "[&>div]:bg-danger",
            campaign.impact_assessment >= 4 && campaign.impact_assessment < 7 && "[&>div]:bg-orange-600",
            campaign.impact_assessment < 4 && "[&>div]:bg-yellow-600"
          )}
        />
      </div>

      {/* Targets Section */}
      {campaign.main_target && (
        <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-danger" />
            <span>اهداف:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge className="bg-danger text-white">
              {campaign.main_target}
            </Badge>
            {campaign.target_persons && Array.isArray(campaign.target_persons) && campaign.target_persons.length > 0 && (
              <>
                {campaign.target_persons.slice(0, 2).map((person: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {person}
                  </Badge>
                ))}
                {campaign.target_persons.length > 2 && (
                  <Badge variant="outline">
                    +{campaign.target_persons.length - 2} نفر
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Campaign Type & Details */}
      <div className="space-y-2">
        {campaign.campaign_type && (
          <Badge variant="secondary" className="text-sm">
            {campaign.campaign_type}
          </Badge>
        )}
        {campaign.notes && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {campaign.notes}
          </p>
        )}
      </div>

      {/* Counter-Campaign Status */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">روایت مقابل:</span>
        </div>
        <Badge className={counterStatusColors[campaign.counter_campaign_status as keyof typeof counterStatusColors]}>
          {campaign.counter_campaign_status}
        </Badge>
      </div>

      {/* Trend Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {isGrowing ? (
          <>
            <TrendingUp className="h-4 w-4 text-danger" />
            <span className="text-danger">↑ {recentGrowth}% افزایش این هفته</span>
          </>
        ) : recentGrowth < 0 ? (
          <>
            <TrendingDown className="h-4 w-4 text-success" />
            <span className="text-success">↓ {Math.abs(recentGrowth)}% کاهش این هفته</span>
          </>
        ) : (
          <>
            <Minus className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">بدون تغییر</span>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" className="flex-1 gap-2">
          <Eye className="h-4 w-4" />
          مشاهده مطالب
        </Button>
        {campaign.counter_campaign_status === 'Not Started' && (
          <Button size="sm" variant="secondary" className="flex-1 gap-2">
            <MessageSquare className="h-4 w-4" />
            روایت مقابل
          </Button>
        )}
        <Button size="sm" variant="ghost" className="gap-2">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="gap-2">
          <FileText className="h-4 w-4" />
        </Button>
      </div>

      {/* Detection Info */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>تشخیص: {formatIranDate(campaign.created_at, 'jYYYY/jMM/jDD')}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CampaignCard;
