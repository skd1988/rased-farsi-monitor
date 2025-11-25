// src/components/analysis/AnalysisDetailModal.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPersianDateTime } from "@/lib/dateUtils";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toPersianNumber } from "@/lib/utils";
import { AnalyzedPost, AnalysisStage } from "@/types/analysis";
import { Card } from "@/components/ui/card";

type ExtendedAnalyzedPost = AnalyzedPost & {
  analysis_summary?: string | null;
  sentiment?: string | null;
  sentiment_score?: number | null;
  main_topic?: string | null;
  threat_level?: string | null;
  recommended_action?: string | null;
  analyzed_at?: string | null;
  processing_time?: number | null;
  article_url?: string | null;
  keywords?: string[] | null;
  language?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  analysis_model?: string | null;
  psyop_risk_score?: number | null;
  psyop_category?: string | null;
  psyop_techniques?: string[] | null;
  stance_type?: string | null;
  quick_analyzed_at?: string | null;
  deep_analyzed_at?: string | null;
  deepest_analysis_completed_at?: string | null;
  deep_main_topic?: string | null;
  deep_extended_summary?: string | null;
  deep_psychological_objectives?: string[] | null;
  deep_manipulation_intensity?: string | null;
  deep_sentiment?: string | null;
  deep_urgency_level?: string | null;
  deep_virality_potential?: string | null;
  deep_techniques?: string[] | null;
  deep_keywords?: string[] | null;
  deep_recommended_actions?: string[] | null;
  deepest_escalation_level?: string | null;
  deepest_strategic_summary?: string | null;
  deepest_key_risks?: string[] | null;
  deepest_audience_segments?: string[] | null;
  deepest_recommended_actions?: string[] | null;
  deepest_monitoring_indicators?: string[] | null;
  analysis_stage?: AnalysisStage;
  is_psyop?: boolean | null;
};

interface AnalysisDetailModalProps {
  post: ExtendedAnalyzedPost | null;
  open: boolean;
  onClose: () => void;

  // optional handlers passed from AIAnalysis page
  onRunDeep?: (postId: string) => Promise<void> | void;
  onRunDeepest?: (postId: string) => Promise<void> | void;
}

const AnalysisDetailModal = ({
  post,
  open,
  onClose,
  onRunDeep,
  onRunDeepest,
}: AnalysisDetailModalProps) => {
  if (!post) return null;
  const modelLabel = post.analysis_model || "unknown-model";
  const processingTimeLabel =
    post.processing_time !== null && post.processing_time !== undefined
      ? `${toPersianNumber(post.processing_time.toFixed(1))} ثانیه`
      : null;

  const isDeepEligible =
    post.is_psyop &&
    (post.psyop_risk_score ?? 0) >= 60 &&
    ["Medium", "High", "Critical"].includes(post.threat_level || "");

  const hasDeep =
    !!post.deep_analyzed_at || !!post.deep_main_topic || !!post.deep_extended_summary;

  const hasDeepest = !!post.deepest_analysis_completed_at;
  const isDeepestEligible =
    post.is_psyop &&
    (post.psyop_risk_score ?? 0) >= 80 &&
    ["High", "Critical"].includes(post.threat_level || "");

  const stageLabel =
    post.analysis_stage === "deepest"
      ? "تحلیل بحران (Deepest)"
      : post.analysis_stage === "deep"
      ? "تحلیل عمیق (Deep)"
      : post.analysis_stage === "quick"
      ? "تحلیل سریع (Quick)"
      : "مرحله نامشخص";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className="max-w-4xl w-full max-h-[80vh] overflow-y-auto overflow-x-hidden"
        dir="rtl"
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <DialogTitle className="text-2xl flex items-center gap-2">
                {post.title}
                {post.is_psyop && <Badge variant="destructive">PsyOp</Badge>}
              </DialogTitle>
              <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
                <Badge variant="outline">{post.source}</Badge>
                {post.author && <span>• {post.author}</span>}
                <span>
                  • {post.published_at ? formatPersianDateTime(post.published_at) : "نامشخص"}
                </span>
                {post.article_url && (
                  <Button variant="link" size="sm" asChild>
                    <a href={post.article_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="ms-1 h-3 w-3" />
                      لینک اصلی
                    </a>
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline">{stageLabel}</Badge>
              {post.analyzed_at && (
                <span className="text-xs text-muted-foreground">
                  {formatPersianDateTime(post.analyzed_at)}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Content */}
          <div>
            <h3 className="font-bold text-lg mb-2">محتوای اصلی</h3>
            <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto">
              <p className="text-sm leading-relaxed text-justify whitespace-pre-wrap break-words">
                {post.contents}
              </p>
            </div>
          </div>

          <Separator />

          {/* Quick Analysis */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">تحلیل سریع</h3>
              <Badge variant="secondary">Quick</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">سطح تهدید</div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{post.threat_level || "نامشخص"}</span>
                  {post.psyop_risk_score != null && (
                    <span className="text-xs text-muted-foreground">ریسک: {post.psyop_risk_score}</span>
                  )}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">احساسات</div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{post.sentiment || "نامشخص"}</span>
                  {post.sentiment_score != null && (
                    <span className="text-xs text-muted-foreground">امتیاز: {post.sentiment_score}</span>
                  )}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">موضوع اصلی</div>
                <span className="font-semibold">{post.main_topic || "نیاز به بررسی ندارد"}</span>
              </Card>
            </div>

            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">خلاصه هوشمند</div>
              {post.analysis_summary ? (
                <p className="text-sm leading-relaxed text-justify break-words">
                  {post.analysis_summary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">خلاصه هوشمند هنوز آماده نیست.</p>
              )}
            </Card>

            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">اقدام پیشنهادی</div>
              {post.recommended_action ? (
                <p className="text-sm leading-relaxed text-justify break-words">
                  {post.recommended_action}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">هنوز اقدام پیشنهادی ثبت نشده است.</p>
              )}
            </Card>
          </section>

          {/* Deep Analysis */}
          <section className="space-y-4 border-t pt-6 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">تحلیل عمیق</h3>
              <Badge variant="outline">Deep</Badge>
            </div>

            {hasDeep ? (
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">هسته روایت</div>
                  <p className="text-sm leading-relaxed text-justify break-words">
                    {post.deep_main_topic || "اطلاعاتی ثبت نشده است."}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">خلاصه توسعه‌یافته</div>
                  <p className="text-sm leading-relaxed text-justify break-words">
                    {post.deep_extended_summary || "خلاصه‌ای ثبت نشده است."}
                  </p>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground mb-2">اهداف روانی</div>
                    {Array.isArray(post.deep_psychological_objectives) &&
                    post.deep_psychological_objectives.length ? (
                      <ul className="space-y-2 text-sm">
                        {post.deep_psychological_objectives.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary font-bold">•</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">ثبت نشده است.</p>
                    )}
                  </Card>

                  <Card className="p-4 space-y-2">
                    <div className="text-xs text-muted-foreground">شدت دستکاری</div>
                    <p className="text-sm font-semibold">
                      {post.deep_manipulation_intensity || "نامشخص"}
                    </p>
                    <div className="text-xs text-muted-foreground">سطح فوریت</div>
                    <p className="text-sm font-semibold">
                      {post.deep_urgency_level || "نامشخص"}
                    </p>
                    <div className="text-xs text-muted-foreground">پتانسیل وایرال</div>
                    <p className="text-sm font-semibold">
                      {post.deep_virality_potential || "نامشخص"}
                    </p>
                  </Card>

                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground mb-2">تکنیک‌ها</div>
                    {Array.isArray(post.deep_techniques) && post.deep_techniques.length ? (
                      <div className="flex flex-wrap gap-2">
                        {post.deep_techniques.map((technique, idx) => (
                          <Badge key={idx} variant="secondary">
                            {technique}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">تکنیکی ثبت نشده است.</p>
                    )}
                  </Card>
                </div>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">اقدامات پیشنهادی عمیق</div>
                  {Array.isArray(post.deep_recommended_actions) &&
                  post.deep_recommended_actions.length ? (
                    <ul className="space-y-2 text-sm">
                      {post.deep_recommended_actions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary font-bold">{idx + 1}.</span>
                          <span className="leading-relaxed">{action}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">اقدامی ثبت نشده است.</p>
                  )}
                </Card>
              </div>
            ) : (
              <Card className="p-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {isDeepEligible
                    ? "این محتوا واجد شرایط تحلیل عمیق است، اما هنوز اجرا نشده است."
                    : "این محتوا زیر آستانه ریسک برای تحلیل عمیق است."}
                </p>
                {isDeepEligible && onRunDeep && post && (
                  <Button variant="outline" size="sm" onClick={() => onRunDeep(post.id)}>
                    اجرای تحلیل عمیق
                  </Button>
                )}
              </Card>
            )}
          </section>

          {/* Deepest Analysis */}
          <section className="space-y-4 border-t pt-6 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">تحلیل بحران (Deepest)</h3>
              <Badge variant="destructive">Deepest</Badge>
            </div>

            {hasDeepest ? (
              <div className="space-y-4">
                <Card className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">سطح تشدید</div>
                    {post.deepest_escalation_level && (
                      <Badge variant="outline">{post.deepest_escalation_level}</Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-justify break-words">
                    {post.deepest_strategic_summary || "خلاصه استراتژیک ثبت نشده است."}
                  </p>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground mb-2">ریسک‌های کلیدی</div>
                    {Array.isArray(post.deepest_key_risks) && post.deepest_key_risks.length ? (
                      <ul className="space-y-2 text-sm">
                        {post.deepest_key_risks.map((risk, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary font-bold">•</span>
                            <span className="leading-relaxed">{risk}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">ریسکی ثبت نشده است.</p>
                    )}
                  </Card>

                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground mb-2">گروه‌های مخاطب</div>
                    {Array.isArray(post.deepest_audience_segments) &&
                    post.deepest_audience_segments.length ? (
                      <div className="flex flex-wrap gap-2">
                        {post.deepest_audience_segments.map((audience, idx) => (
                          <Badge key={idx} variant="secondary">
                            {audience}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">مخاطبی ثبت نشده است.</p>
                    )}
                  </Card>
                </div>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">اقدامات بحران</div>
                  {Array.isArray(post.deepest_recommended_actions) &&
                  post.deepest_recommended_actions.length ? (
                    <ul className="space-y-2 text-sm">
                      {post.deepest_recommended_actions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary font-bold">{idx + 1}.</span>
                          <span className="leading-relaxed">{action}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">اقدامی ثبت نشده است.</p>
                  )}
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">شاخص‌های پایش</div>
                  {Array.isArray(post.deepest_monitoring_indicators) &&
                  post.deepest_monitoring_indicators.length ? (
                    <ul className="space-y-2 text-sm">
                      {post.deepest_monitoring_indicators.map((indicator, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary font-bold">•</span>
                          <span className="leading-relaxed">{indicator}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">شاخصی ثبت نشده است.</p>
                  )}
                </Card>
              </div>
            ) : (
              <Card className="p-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  برای این محتوا هنوز تحلیل بحران (Deepest) اجرا نشده است.
                </p>
                {isDeepestEligible && onRunDeepest && post && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRunDeepest(post.id)}
                  >
                    اجرای تحلیل بحران
                  </Button>
                )}
              </Card>
            )}
          </section>

          {/* Analysis Metadata */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-4 border-t">
            <span>
              تحلیل شده: {post.analyzed_at ? formatPersianDateTime(post.analyzed_at) : "نامشخص"}
            </span>
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
      </DialogContent>
    </Dialog>
  );
};

export default AnalysisDetailModal;
