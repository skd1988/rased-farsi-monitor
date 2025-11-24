import { Database } from "@/integrations/supabase/types";

export type AnalysisStage = "quick" | "deep" | "deepest" | null;
export type SentimentValue = "positive" | "negative" | "neutral" | "Positive" | "Negative" | "Neutral" | null;
export type UrgencyLevel = "Low" | "Medium" | "High" | "Critical" | null;
export type ViralityPotential = "Low" | "Medium" | "High" | null;

type PostRow = Database["public"]["Tables"]["posts"]["Row"];

export interface AnalyzedPost
  extends Omit<
    PostRow,
    | "analysis_stage"
    | "sentiment"
    | "urgency_level"
    | "virality_potential"
    | "threat_level"
    | "status"
  > {
  id: string;
  title: string;
  contents: string | null;
  source: string | null;
  author?: string | null;
  language?: string | null;

  status: "pending" | "processing" | "completed";
  quick_analyzed_at?: string | null;
  deep_analyzed_at?: string | null;
  deepest_analysis_completed_at?: string | null;

  analysis_stage?: AnalysisStage;
  sentiment: SentimentValue;
  sentiment_score?: number | null;
  urgency_level: UrgencyLevel;
  virality_potential: ViralityPotential;
  threat_level: "Low" | "Medium" | "High" | "Critical" | null;
  confidence?: number | null;

  is_psyop?: boolean | null;
  psyop_category?: "hostile_propaganda" | "potential_psyop" | "non_psyop" | null;
  psyop_risk_score?: number | null;

  narrative_core?: string | null;
  extended_summary?: string | null;
  psychological_objectives?: string[] | null;
  recommended_actions?: string | null;
  key_points?: string[] | null;
  manipulation_intensity?: string | null;
  techniques?: string[] | null;

  // Deep analysis fields
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

  resolved_stage?: AnalysisStage;
}
