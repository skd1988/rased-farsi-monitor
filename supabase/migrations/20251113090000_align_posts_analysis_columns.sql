-- Align posts table with 3-level analysis pipeline
-- Ensure all deep/deepest fields exist and enums allow required values

-- Expand analysis_stage to include deepest
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_analysis_stage_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_analysis_stage_check
  CHECK (analysis_stage IN ('quick', 'deep', 'deepest'));

-- Standardize urgency/virality/manipulation enums to match Edge Functions
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_urgency_level_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_urgency_level_check
  CHECK (urgency_level IN ('Low', 'Medium', 'High', 'Critical'));

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_virality_potential_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_virality_potential_check
  CHECK (virality_potential IN ('Low', 'Medium', 'High'));

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_manipulation_intensity_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_manipulation_intensity_check
  CHECK (manipulation_intensity IN ('Low', 'Medium', 'High'));

-- Add missing analysis columns used by deep/deepest pipeline
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS quick_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deep_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deepest_analysis_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS narrative_core text,
  ADD COLUMN IF NOT EXISTS extended_summary text,
  ADD COLUMN IF NOT EXISTS psychological_objectives text[],
  ADD COLUMN IF NOT EXISTS manipulation_intensity text,
  ADD COLUMN IF NOT EXISTS urgency_level text,
  ADD COLUMN IF NOT EXISTS virality_potential text,
  ADD COLUMN IF NOT EXISTS techniques text[],
  ADD COLUMN IF NOT EXISTS recommended_actions text[],
  ADD COLUMN IF NOT EXISTS deep_main_topic text,
  ADD COLUMN IF NOT EXISTS deep_smart_summary text,
  ADD COLUMN IF NOT EXISTS deep_recommended_action text,
  ADD COLUMN IF NOT EXISTS deep_psychological_objectives text[],
  ADD COLUMN IF NOT EXISTS deep_techniques text[],
  ADD COLUMN IF NOT EXISTS crisis_narrative_core text,
  ADD COLUMN IF NOT EXISTS crisis_extended_summary text,
  ADD COLUMN IF NOT EXISTS deepest_main_topic text,
  ADD COLUMN IF NOT EXISTS deepest_smart_summary text,
  ADD COLUMN IF NOT EXISTS deepest_recommended_action text,
  ADD COLUMN IF NOT EXISTS quick_main_topic text,
  ADD COLUMN IF NOT EXISTS quick_summary text,
  ADD COLUMN IF NOT EXISTS smart_summary text,
  ADD COLUMN IF NOT EXISTS review_status text;
