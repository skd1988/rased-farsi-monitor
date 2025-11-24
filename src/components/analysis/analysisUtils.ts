import { AnalyzedPost, AnalysisStage, SentimentValue } from "@/types/analysis";

export const resolveAnalysisStage = (post: AnalyzedPost): AnalysisStage => {
  if (post.analysis_stage === "deepest" || post.deepest_analysis_completed_at) {
    return "deepest";
  }

  if (post.analysis_stage === "deep" || post.deep_analyzed_at) {
    return "deep";
  }

  if (post.analysis_stage === "quick" || post.quick_analyzed_at) {
    return "quick";
  }

  return null;
};

export const normalizeSentimentValue = (
  sentiment: SentimentValue,
): Extract<SentimentValue, "Positive" | "Negative" | "Neutral"> | null => {
  if (!sentiment) return null;

  const lower = sentiment.toLowerCase();
  if (lower === "positive") return "Positive";
  if (lower === "negative") return "Negative";
  if (lower === "neutral") return "Neutral";

  return sentiment as Extract<SentimentValue, "Positive" | "Negative" | "Neutral">;
};

export const firstSentence = (text?: string | null): string | null => {
  if (!text) return null;

  const match = text.match(/[^.!؟?\n]+[.!؟?]/);
  if (match && match[0]) {
    return match[0].trim();
  }

  const trimmed = text.trim();
  return trimmed.slice(0, 100);
};

export const deriveMainTopic = (post: AnalyzedPost): string => {
  return (
    post.main_topic ||
    post.narrative_theme ||
    firstSentence(post.analysis_summary) ||
    "موضوع اصلی هنوز تعیین نشده است"
  );
};

export const deriveSmartSummary = (
  post: AnalyzedPost,
  stage: AnalysisStage,
): string | null => {
  const hasDeepInsights = stage === "deep" || stage === "deepest";

  // Priority: deep analysis summary > narrative/main topic > quick text (if any)
  if (hasDeepInsights) {
    return post.analysis_summary || post.narrative_theme || post.main_topic || null;
  }

  return post.analysis_summary || post.narrative_theme || post.main_topic || null;
};

export const deriveRecommendedAction = (
  post: AnalyzedPost,
  stage: AnalysisStage,
): string => {
  const hasDeepInsights = stage === "deep" || stage === "deepest";

  if (hasDeepInsights && post.recommended_action) {
    return post.recommended_action;
  }

  if (!hasDeepInsights) {
    return post.recommended_action || "هنوز اقدام پیشنهادی ثبت نشده است";
  }

  return "هنوز اقدام پیشنهادی ثبت نشده است";
};
