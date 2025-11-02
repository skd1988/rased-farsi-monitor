-- Create batch analysis progress tracking table
CREATE TABLE IF NOT EXISTS public.batch_analysis_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT UNIQUE NOT NULL,
  total_posts INTEGER NOT NULL,
  processed_posts INTEGER DEFAULT 0,
  quick_only INTEGER DEFAULT 0,
  deep_analyzed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  current_post_id TEXT,
  current_stage TEXT,
  status TEXT CHECK (status IN ('running', 'completed', 'error', 'paused')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.batch_analysis_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since no auth is used)
CREATE POLICY "Anyone can view batch progress"
ON public.batch_analysis_progress
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert batch progress"
ON public.batch_analysis_progress
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update batch progress"
ON public.batch_analysis_progress
FOR UPDATE
USING (true);

-- Index for fast lookups
CREATE INDEX idx_batch_progress_batch_id ON public.batch_analysis_progress(batch_id);
CREATE INDEX idx_batch_progress_status ON public.batch_analysis_progress(status);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_batch_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batch_progress_update_timestamp
BEFORE UPDATE ON public.batch_analysis_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_batch_progress_timestamp();