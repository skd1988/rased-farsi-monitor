const DEFAULT_PILL_STYLE = {
  label: "نامشخص",
  icon: "❔",
  color: "bg-gray-500/10 text-gray-500 border-gray-500",
};

const DEFAULT_SENTIMENT_STYLE = {
  label: "نامشخص",
  icon: "❔",
  color: "bg-gray-500/10 text-gray-500",
};

const DEFAULT_ACTION_STYLE = {
  label: "نامشخص",
  variant: "outline" as const,
};

const THREAT_CONFIG = {
  Critical: { label: "بحرانی", icon: "🔴", color: "bg-red-500/10 text-red-500 border-red-500" },
  High: { label: "بالا", icon: "🟠", color: "bg-orange-500/10 text-orange-500 border-orange-500" },
  Medium: { label: "متوسط", icon: "🟡", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500" },
  Low: { label: "پایین", icon: "🟢", color: "bg-green-500/10 text-green-500 border-green-500" },
};

const SENTIMENT_CONFIG = {
  Positive: { label: "مثبت", icon: "😊", color: "bg-green-500/10 text-green-500" },
  Neutral: { label: "خنثی", icon: "😐", color: "bg-gray-500/10 text-gray-500" },
  Negative: { label: "منفی", icon: "😟", color: "bg-red-500/10 text-red-500" },
};

const ACTION_CONFIG = {
  Critical: { label: "بررسی فوری", variant: "destructive" as const },
  High: { label: "پاسخ سریع", variant: "default" as const },
  Medium: { label: "رصد کنید", variant: "secondary" as const },
  Low: { label: "آرشیو", variant: "outline" as const },
};

const warnUnknownValue = (type: string, value?: string | null) => {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[AIAnalysis] Unknown ${type}:`, value);
  }
};

export const getThreatConfig = (level?: string | null) => {
  if (!level) return DEFAULT_PILL_STYLE;
  const config = THREAT_CONFIG[level as keyof typeof THREAT_CONFIG];

  if (!config) {
    warnUnknownValue("threat_level", level);
  }

  return config ?? { ...DEFAULT_PILL_STYLE, label: level };
};

export const getSentimentConfig = (sentiment?: string | null) => {
  if (!sentiment) return DEFAULT_SENTIMENT_STYLE;
  const config = SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG];

  if (!config) {
    warnUnknownValue("sentiment", sentiment);
  }

  return config ?? { ...DEFAULT_SENTIMENT_STYLE, label: sentiment };
};

export const getActionConfig = (level?: string | null) => {
  if (!level) return DEFAULT_ACTION_STYLE;
  const config = ACTION_CONFIG[level as keyof typeof ACTION_CONFIG];

  if (!config) {
    warnUnknownValue("action threat_level", level);
  }

  return config ?? { ...DEFAULT_ACTION_STYLE, label: level };
};
