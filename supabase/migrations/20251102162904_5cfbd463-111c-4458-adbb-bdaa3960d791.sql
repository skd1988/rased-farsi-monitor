-- Add narrative analysis columns to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS narrative_theme text,
ADD COLUMN IF NOT EXISTS psyop_type text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_narrative_theme ON public.posts(narrative_theme) WHERE narrative_theme IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_psyop_type ON public.posts(psyop_type) WHERE psyop_type IS NOT NULL;