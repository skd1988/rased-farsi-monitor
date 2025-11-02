-- Add analysis_stage column to track which analysis stage was performed
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS analysis_stage text 
CHECK (analysis_stage IN ('quick', 'deep'));

COMMENT ON COLUMN posts.analysis_stage IS 'Analysis stage performed: quick (stage 1 screening only) or deep (full analysis)';