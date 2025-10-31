-- Add source_type field to distinguish between social media and websites
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'website';

-- Add comment to explain the field
COMMENT ON COLUMN posts.source_type IS 'Type of source: social_media, website, news_agency, blog, forum';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_posts_source_type ON posts(source_type);