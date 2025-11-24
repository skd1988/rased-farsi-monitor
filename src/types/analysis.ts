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
  // Deep analysis fields
  narrative_core?: string | null;
  extended_summary?: string | null;
  psychological_objectives?: string[] | null;
  manipulation_intensity?: string | null;
  techniques?: string[] | null;
  recommended_actions?: string[] | null;
  deep_main_topic?: string | null;
  deep_smart_summary?: string | null;
  deep_recommended_action?: string | null;
  deep_psychological_objectives?: string[] | null;
  deep_techniques?: string[] | null;

  // Deepest/crisis layer fields
  crisis_narrative_core?: string | null;
  crisis_extended_summary?: string | null;
  deepest_main_topic?: string | null;
  deepest_smart_summary?: string | null;
  deepest_recommended_action?: string | null;

  // Quick/legacy fallbacks
  quick_summary?: string | null;
  quick_main_topic?: string | null;
  smart_summary?: string | null;
  review_status?: string | null;
};
