import { Database } from "@/integrations/supabase/types";

export type AnalysisStage = "quick" | "deep" | "deepest" | null;
export type SentimentValue = "positive" | "negative" | "neutral" | "Positive" | "Negative" | "Neutral" | null;
export type UrgencyLevel = "Low" | "Medium" | "High" | "Critical" | null;
export type ViralityPotential = "Low" | "Medium" | "High" | null;

type PostRow = Database["public"]["Tables"]["posts"]["Row"];

export type AnalyzedPost = Omit<PostRow, "analysis_stage" | "sentiment" | "urgency_level" | "virality_potential"> & {
  analysis_stage: AnalysisStage;
  sentiment: SentimentValue;
  urgency_level: UrgencyLevel;
  virality_potential: ViralityPotential;
  resolved_stage?: AnalysisStage;
  hasDeepAnalysis?: boolean;
  hasDeepestAnalysis?: boolean;
};
