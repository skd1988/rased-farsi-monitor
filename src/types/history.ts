/**
 * Type definitions for Operations History page
 * Covers all archive and history tables in Supabase
 */

// Daily Intelligence Digest
export interface DailyDigest {
  id: string;
  digest_date: string;
  total_posts: number;
  psyop_posts: number;
  critical_threats: number;
  high_threats: number;
  medium_threats: number;
  low_threats: number;
  top_narratives: string[];
  top_targets: string[];
  top_attack_vectors: string[];
  key_insights: string;
  recommendations: string;
  trend_analysis: string;
  created_at: string;
  updated_at: string;
}

// Significant Posts Archive
export interface SignificantPost {
  id: string;
  post_id: string;
  title: string;
  content: string;
  source_name: string;
  source_type: string;
  published_at: string;
  threat_level: 'Critical' | 'High' | 'Medium' | 'Low';
  is_psyop: boolean;
  psyop_score: number;
  psyop_techniques: string[];
  narratives: string[];
  attack_vectors: string[];
  targeted_entities: string[];
  targeted_persons: string[];
  targeted_organizations: string[];
  significance_reason: string;
  impact_assessment: string;
  archived_at: string;
  archived_by: string;
}

// Attack Vector History
export interface AttackVectorHistory {
  id?: string;
  vector_name: string;
  date: string;
  usage_count: number;
  critical_count: number;
  high_count: number;
  sources: string[];
  targets: string[];
  avg_threat_level: number;
  created_at?: string;
  updated_at?: string;
}

// Narrative History
export interface NarrativeHistory {
  id: string;
  narrative: string;
  category: string;
  usage_count: number;
  first_seen: string;
  last_seen: string;
  peak_period: string;
  associated_sources: string[];
  associated_attack_vectors: string[];
  sentiment_trend: string;
  reach_estimate: number;
  impact_score: number;
  evolution_notes: string;
  created_at: string;
  updated_at: string;
}

// Target Attack History
export interface TargetAttackHistory {
  id: string;
  target_name: string;
  target_type: 'person' | 'organization' | 'entity';
  attack_count: number;
  first_attack: string;
  last_attack: string;
  peak_attack_period: string;
  common_narratives: string[];
  common_attack_vectors: string[];
  threat_level_distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  attacking_sources: string[];
  severity_trend: 'escalating' | 'stable' | 'declining';
  notes: string;
  created_at: string;
  updated_at: string;
}

// Campaign Archive
export interface CampaignArchive {
  id: string;
  campaign_id: string;
  campaign_name: string;
  description: string;
  status: 'Active' | 'Completed' | 'Archived';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  start_date: string;
  end_date: string | null;
  total_posts: number;
  participating_sources: string[];
  key_narratives: string[];
  attack_vectors: string[];
  targeted_entities: string[];
  coordination_indicators: string[];
  impact_assessment: string;
  countermeasures: string;
  archived_at: string;
  archived_by: string;
}

// Source Behavior Timeline
export interface SourceTimeline {
  id: string;
  source_name: string;
  source_type: string;
  date: string;
  posts_count: number;
  psyop_count: number;
  psyop_rate: number;
  avg_threat_score: number;
  dominant_narratives: string[];
  dominant_attack_vectors: string[];
  behavior_change: string;
  anomaly_detected: boolean;
  anomaly_description: string;
  created_at: string;
}

// Filters and Stats
export interface HistoryFilters {
  startDate?: string;
  endDate?: string;
  threatLevel?: 'Critical' | 'High' | 'Medium' | 'Low' | 'all';
  source?: string;
  narrative?: string;
  attackVector?: string;
  targetType?: 'person' | 'organization' | 'entity' | 'all';
}

export interface MonthlyStats {
  month: string;
  totalPosts: number;
  psyopPosts: number;
  criticalThreats: number;
  activeCampaigns: number;
  uniqueSources: number;
  topNarratives: string[];
  topTargets: string[];
}
