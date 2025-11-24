import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatPersianDateTime } from '@/lib/dateUtils';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toPersianNumber } from '@/lib/utils';
import { getSentimentConfig, getThreatConfig } from './pillConfigs';
import { AnalyzedPost, AnalysisStage } from '@/types/analysis';
import {
  deriveMainTopic,
  deriveRecommendedAction,
  deriveSmartSummary,
  normalizeSentimentValue,
  resolveAnalysisStage,
} from './analysisUtils';

interface AnalysisDetailModalProps {
  post: AnalyzedPost;
  open: boolean;
  onClose: () => void;
}

const AnalysisDetailModal = ({ post, open, onClose }: AnalysisDetailModalProps) => {
  // Deep/deepest insights take priority over quick screening for all rendered fields
  const resolvedStage: AnalysisStage = post.resolved_stage ?? resolveAnalysisStage(post);
  const threat = getThreatConfig(post.threat_level);
  const sentimentLabel = normalizeSentimentValue(post.sentiment);
  const sentiment = getSentimentConfig(sentimentLabel);
  const mainTopic = deriveMainTopic(post);
  const smartSummary = deriveSmartSummary(post, resolvedStage);
  const summaryText = smartSummary ?? 'خلاصه هوشمند هنوز آماده نیست';
  const recommendedAction = deriveRecommendedAction(post, resolvedStage);
  const recommendedActionText = recommendedAction || 'هنوز اقدام پیشنهادی ثبت نشده است';
  const modelLabel = post.analysis_model || 'unknown-model';
  const processingTimeLabel =
    post.processing_time !== null && post.processing_time !== undefined
      ? `${toPersianNumber(post.processing_time.toFixed(1))} ثانیه`
      : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{post.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metadata */}
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <Badge variant="outline">{post.source}</Badge>
            {post.author && <span>• {post.author}</span>}
            <span>• {formatPersianDateTime(post.published_at)}</span>
            {post.article_url && (
              <Button variant="link" size="sm" asChild>
                <a href={post.article_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="ms-1 h-3 w-3" />
                  لینک اصلی
                </a>
              </Button>
            )}
          </div>

          <Separator />

          {/* Original Content */}
          <div>
            <h3 className="font-bold text-lg mb-2">محتوای اصلی</h3>
            <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{post.contents}</p>
            </div>
          </div>

          <Separator />

          {/* Analysis Results */}
          <div>
            <h3 className="font-bold text-lg mb-4">نتایج تحلیل</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Threat Level */}
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">سطح تهدید</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{threat.icon}</span>
                  <div>
                    <p className="font-bold text-lg">{threat.label}</p>
                    <p className="text-xs text-muted-foreground">اطمینان: {post.confidence}%</p>
                  </div>
                </div>
              </div>

              {/* Sentiment */}
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">احساسات</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{sentiment.icon}</span>
                  <div>
                    <p className="font-bold text-lg">{sentiment.label}</p>
                    <p className="text-xs text-muted-foreground">
                      امتیاز: {toPersianNumber(post.sentiment_score?.toFixed(2) || '0')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Topic */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">موضوع اصلی</p>
              <Badge className="text-base py-2 px-4">{mainTopic}</Badge>
            </div>

            {/* Summary */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">خلاصه هوشمند</p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm">{summaryText}</p>
              </div>
            </div>

            {/* Key Points */}
            {post.key_points && post.key_points.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">نکات کلیدی</p>
                <ul className="space-y-2">
                  {post.key_points.map((point: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 bg-muted p-3 rounded-lg">
                      <span className="text-primary font-bold">{index + 1}.</span>
                      <span className="text-sm">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Action */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">اقدام پیشنهادی</p>
              <div className="bg-primary/10 border border-primary p-4 rounded-lg space-y-1">
                {recommendedActionText.split(/\n+/).map((line, index) => (
                  <p key={index} className="text-sm font-medium">
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Analysis Metadata */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-4 border-t">
              <span>تحلیل شده: {formatPersianDateTime(post.analyzed_at)}</span>
              <span>•</span>
              <span>مدل: {modelLabel}</span>
              {processingTimeLabel && (
                <>
                  <span>•</span>
                  <span>زمان پردازش: {processingTimeLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnalysisDetailModal;