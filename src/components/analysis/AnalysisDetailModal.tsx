import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatPersianDateTime } from '@/lib/dateUtils';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toPersianNumber } from '@/lib/utils';
import { getSentimentConfig, getThreatConfig } from './pillConfigs';

interface AnalysisDetailModalProps {
  post: any;
  open: boolean;
  onClose: () => void;
}

const AnalysisDetailModal = ({ post, open, onClose }: AnalysisDetailModalProps) => {
  const threat = getThreatConfig(post.threat_level);
  const sentiment = getSentimentConfig(post.sentiment);

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
            {post.main_topic && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">موضوع اصلی</p>
                <Badge className="text-base py-2 px-4">{post.main_topic}</Badge>
              </div>
            )}

            {/* Summary */}
            {post.analysis_summary && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">خلاصه هوشمند</p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm">{post.analysis_summary}</p>
                </div>
              </div>
            )}

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
            {post.recommended_action && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">اقدام پیشنهادی</p>
                <div className="bg-primary/10 border border-primary p-4 rounded-lg">
                  <p className="text-sm font-medium">{post.recommended_action}</p>
                </div>
              </div>
            )}

            {/* Analysis Metadata */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-4 border-t">
              <span>تحلیل شده: {formatPersianDateTime(post.analyzed_at)}</span>
              <span>•</span>
              <span>مدل: {post.analysis_model || 'DeepSeek'}</span>
              {post.processing_time && (
                <>
                  <span>•</span>
                  <span>زمان پردازش: {toPersianNumber(post.processing_time.toFixed(2))} ثانیه</span>
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