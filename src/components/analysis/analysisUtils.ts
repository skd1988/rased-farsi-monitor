import { AnalyzedPost, AnalysisStage, SentimentValue } from "@/types/analysis";

export const resolveAnalysisStage = (post: AnalyzedPost): AnalysisStage => {
  if (
    post.analysis_stage === "deepest" ||
    post.deepest_analysis_completed_at ||
    post.deepest_strategic_summary ||
    (post as any).deepest_smart_summary ||
    (post as any).crisis_extended_summary ||
    (post as any).crisis_narrative_core
  ) {
    return "deepest";
  }

  if (
    post.analysis_stage === "deep" ||
    post.deep_analyzed_at ||
    post.extended_summary ||
    post.narrative_core ||
    post.analysis_summary ||
    (post as any).deep_smart_summary
  ) {
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

export const deriveMainTopic = (post: AnalyzedPost, stage: AnalysisStage): string => {
  if (stage === "deepest") {
    return (
      post.deepest_main_topic ||
      post.deep_main_topic ||
      post.narrative_theme ||
      post.main_topic ||
      post.quick_main_topic ||
      firstSentence(post.analysis_summary) ||
      post.review_status ||
      "موضوع اصلی هنوز تعیین نشده است"
    );
  }

  if (stage === "deep") {
    return (
      post.deep_main_topic ||
      post.narrative_theme ||
      post.main_topic ||
      post.quick_main_topic ||
      firstSentence(post.analysis_summary) ||
      post.review_status ||
      "موضوع اصلی هنوز تعیین نشده است"
    );
  }

  return (
    post.quick_main_topic ||
    post.main_topic ||
    post.narrative_theme ||
    firstSentence(post.analysis_summary) ||
    post.review_status ||
    "موضوع اصلی هنوز تعیین نشده است"
  );
};

export const deriveSmartSummary = (
  post: AnalyzedPost,
  stage: AnalysisStage,
): string | null => {
  if (stage === "deepest") {
    return (
      post.deepest_smart_summary ||
      post.crisis_extended_summary ||
      post.crisis_narrative_core ||
      post.deep_smart_summary ||
      post.extended_summary ||
      post.narrative_core ||
      post.analysis_summary ||
      post.quick_summary ||
      post.smart_summary ||
      null
    );
  }

  if (stage === "deep") {
    return (
      post.deep_smart_summary ||
      post.extended_summary ||
      post.narrative_core ||
      post.analysis_summary ||
      post.quick_summary ||
      post.smart_summary ||
      null
    );
  }

  return post.quick_summary || post.smart_summary || null;
};

export const deriveRecommendedAction = (
  post: AnalyzedPost,
  stage: AnalysisStage,
): string => {
  if (stage === "deepest") {
    return (
      post.deepest_recommended_action ||
      post.deep_recommended_action ||
      post.recommended_action ||
      "هنوز اقدام پیشنهادی ثبت نشده است"
    );
  }

  if (stage === "deep") {
    return (
      post.deep_recommended_action ||
      post.recommended_action ||
      "هنوز اقدام پیشنهادی ثبت نشده است"
    );
  }

  return post.recommended_action || "هنوز اقدام پیشنهادی ثبت نشده است";
};
