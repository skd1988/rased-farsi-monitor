-- Add analysis columns to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS analysis_summary TEXT,
ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('Positive', 'Negative', 'Neutral')),
ADD COLUMN IF NOT EXISTS sentiment_score FLOAT CHECK (sentiment_score >= -1.0 AND sentiment_score <= 1.0),
ADD COLUMN IF NOT EXISTS main_topic TEXT,
ADD COLUMN IF NOT EXISTS threat_level TEXT CHECK (threat_level IN ('Critical', 'High', 'Medium', 'Low')),
ADD COLUMN IF NOT EXISTS confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
ADD COLUMN IF NOT EXISTS key_points TEXT[],
ADD COLUMN IF NOT EXISTS recommended_action TEXT,
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS analysis_model TEXT DEFAULT 'DeepSeek',
ADD COLUMN IF NOT EXISTS processing_time FLOAT;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_posts_threat_level ON public.posts(threat_level);
CREATE INDEX IF NOT EXISTS idx_posts_sentiment ON public.posts(sentiment);
CREATE INDEX IF NOT EXISTS idx_posts_analyzed_at ON public.posts(analyzed_at);