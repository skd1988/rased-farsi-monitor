import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MoreVertical, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { formatPersianDate, getRelativeTime } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AnalysisCardProps {
  post: any;
  onViewDetails: () => void;
  onReanalyze: () => void;
}

const AnalysisCard = ({ post, onViewDetails, onReanalyze }: AnalysisCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const threatConfig = {
    Critical: { label: "بحرانی", icon: "🔴", color: "bg-red-500/10 text-red-500 border-red-500" },
    High: { label: "بالا", icon: "🟠", color: "bg-orange-500/10 text-orange-500 border-orange-500" },
    Medium: { label: "متوسط", icon: "🟡", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500" },
    Low: { label: "پایین", icon: "🟢", color: "bg-green-500/10 text-green-500 border-green-500" },
  };

  const sentimentConfig = {
    Positive: { label: "مثبت", icon: "😊", color: "bg-green-500/10 text-green-500" },
    Neutral: { label: "خنثی", icon: "😐", color: "bg-gray-500/10 text-gray-500" },
    Negative: { label: "منفی", icon: "😟", color: "bg-red-500/10 text-red-500" },
  };

  const topicColors: Record<string, string> = {
    "جنگ روانی": "bg-red-500/10 text-red-500 border-red-500",
    "محور مقاومت": "bg-green-500/10 text-green-500 border-green-500",
    اتهام: "bg-orange-500/10 text-orange-500 border-orange-500",
    شبهه: "bg-yellow-500/10 text-yellow-500 border-yellow-500",
    کمپین: "bg-purple-500/10 text-purple-500 border-purple-500",
    "تحلیل سیاسی": "bg-blue-500/10 text-blue-500 border-blue-500",
    "اخبار عادی": "bg-gray-500/10 text-gray-500 border-gray-500",
  };

  const actionConfig = {
    Critical: { label: "بررسی فوری", variant: "destructive" as const },
    High: { label: "پاسخ سریع", variant: "default" as const },
    Medium: { label: "رصد کنید", variant: "secondary" as const },
    Low: { label: "آرشیو", variant: "outline" as const },
  };

  const handleReanalyze = async () => {
    setIsAnalyzing(true);

    try {
      console.log(`🔄 Re-analyzing post: ${post.id}`);

      const response = await supabase.functions.invoke("analyze-post-deepseek", {
        body: {
          postId: post.id,
          title: post.title,
          contents: post.contents,
          source: post.source,
          language: post.language || "نامشخص",
          published_at: post.published_at,
        },
      });

      if (response.error) {
        console.error("❌ Edge function error:", response.error);
        throw response.error;
      }

      if (!response.data || !response.data.success) {
        console.error("❌ Invalid response:", response.data);
        throw new Error(response.data?.error || "Invalid response from edge function");
      }

      const analysis = response.data.analysis;

      // Update database
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          analysis_summary: analysis.summary,
          sentiment: analysis.sentiment,
          sentiment_score: analysis.sentiment_score,
          main_topic: analysis.main_topic,
          threat_level: analysis.threat_level,
          confidence: analysis.confidence,
          key_points: analysis.key_points,
          keywords: analysis.keywords,
          recommended_action: analysis.recommended_action,
          analyzed_at: analysis.analyzed_at,
          analysis_model: analysis.analysis_model,
          processing_time: analysis.processing_time,
        })
        .eq("id", post.id);

      if (updateError) {
        console.error("❌ Database error:", updateError);
        throw updateError;
      }

      // Auto-create alert for critical/high threat posts
      if (analysis.threat_level === 'Critical' || analysis.threat_level === 'High') {
        const alertType = 
          analysis.main_topic === 'جنگ روانی' ? 'Psychological Warfare' :
          analysis.main_topic === 'کمپین' ? 'Coordinated Campaign' :
          analysis.main_topic === 'اتهام' ? 'Direct Attack' :
          analysis.main_topic === 'شبهه' ? 'Fake News' :
          analysis.main_topic?.includes('محور') ? 'Propaganda' :
          'Viral Content';

        const triggeredReason = `تهدید سطح ${analysis.threat_level} - احساسات: ${analysis.sentiment} - موضوع اصلی: ${analysis.main_topic} - اطمینان: ${analysis.confidence}%`;

        const { error: alertError } = await supabase.from('alerts').insert({
          post_id: post.id,
          alert_type: alertType,
          severity: analysis.threat_level,
          status: 'New',
          triggered_reason: triggeredReason,
          assigned_to: null,
          notes: null
        });
        
        if (!alertError) {
          console.log(`🚨 Alert created for post ${post.id} - ${analysis.threat_level}`);
        }
      }

      toast({
        title: "تحلیل به‌روزرسانی شد",
        description: "تحلیل مطلب با موفقیت به‌روزرسانی شد",
      });

      onReanalyze();
    } catch (error) {
      console.error("Error re-analyzing:", error);
      toast({
        title: "خطا در تحلیل مجدد",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("posts")
        .update({
          analysis_summary: null,
          sentiment: null,
          sentiment_score: null,
          main_topic: null,
          threat_level: null,
          confidence: null,
          key_points: null,
          recommended_action: null,
          analyzed_at: null,
          processing_time: null,
        })
        .eq("id", post.id);

      if (error) throw error;

      toast({
        title: "تحلیل حذف شد",
        description: "تحلیل مطلب با موفقیت حذف شد",
      });

      onReanalyze();
    } catch (error) {
      console.error("Error deleting analysis:", error);
      toast({
        title: "خطا در حذف تحلیل",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      });
    }
  };

  const threat = threatConfig[post.threat_level as keyof typeof threatConfig];
  const sentiment = sentimentConfig[post.sentiment as keyof typeof sentimentConfig];
  const action = actionConfig[post.threat_level as keyof typeof actionConfig];

  const sentimentProgress = ((post.sentiment_score + 1) / 2) * 100;

  return (
    <Card className="hover:shadow-lg transition-shadow" dir="rtl">
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <CardTitle
            className="text-lg cursor-pointer hover:text-primary transition-colors line-clamp-2"
            onClick={onViewDetails}
          >
            {post.title}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewDetails}>
                <ExternalLink className="ms-2 h-4 w-4" />
                مشاهده پست اصلی
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReanalyze} disabled={isAnalyzing}>
                <RefreshCw className={cn("ms-2 h-4 w-4", isAnalyzing && "animate-spin")} />
                تحلیل مجدد
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete}>
                <Trash2 className="ms-2 h-4 w-4" />
                حذف تحلیل
              </DropdownMenuItem>
              <DropdownMenuItem>
                <AlertTriangle className="ms-2 h-4 w-4" />
                گزارش خطا
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex gap-2 items-center text-sm text-muted-foreground mt-2">
          <Badge variant="outline">{post.source}</Badge>
          {post.author && <span>• {post.author}</span>}
          <span>• {getRelativeTime(post.published_at)}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Threat Level */}
        <div
          className="flex items-center justify-between p-4 border rounded-lg"
          style={{ borderColor: threat.color.split(" ")[2] }}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">{threat.icon}</span>
            <div>
              <p className="font-bold text-lg">{threat.label}</p>
              <p className="text-sm text-muted-foreground">اطمینان: {post.confidence}%</p>
            </div>
          </div>
        </div>

        {/* Sentiment */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge className={sentiment.color}>
                {sentiment.icon} {sentiment.label}
              </Badge>
              <span className="text-sm text-muted-foreground">{post.sentiment_score?.toFixed(2)}</span>
            </div>
          </div>
          <Progress value={sentimentProgress} className="h-2" />
        </div>

        {/* Main Topic */}
        {post.main_topic && (
          <div>
            <Badge className={cn("text-sm py-1 px-3", topicColors[post.main_topic] || topicColors["اخبار عادی"])}>
              {post.main_topic}
            </Badge>
          </div>
        )}

        {/* Key Points */}
        {post.key_points && post.key_points.length > 0 && (
          <div>
            <p className="font-semibold mb-2">نکات کلیدی:</p>
            <ul className="space-y-1">
              {post.key_points.slice(0, 3).map((point: string, index: number) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Summary - Collapsible */}
        {post.analysis_summary && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>خلاصه هوشمند</span>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">{post.analysis_summary}</p>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Recommended Action */}
        {post.recommended_action && (
          <div>
            <p className="text-sm font-semibold mb-2">اقدام پیشنهادی:</p>
            <Button variant={action.variant} className="w-full">
              {action.label}
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground flex-wrap gap-2">
        <span>تحلیل شده: {getRelativeTime(post.analyzed_at)}</span>
        <span>•</span>
        <Badge variant="outline" className="text-xs">
          {post.analysis_model || "DeepSeek"}
        </Badge>
        {post.processing_time && (
          <>
            <span>•</span>
            <span>زمان پردازش: {post.processing_time.toFixed(1)} ثانیه</span>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default AnalysisCard;
