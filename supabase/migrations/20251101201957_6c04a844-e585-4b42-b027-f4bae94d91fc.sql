-- Add source_country column to posts table
ALTER TABLE posts ADD COLUMN source_country TEXT;

-- Add index for better query performance
CREATE INDEX idx_posts_source_country ON posts(source_country);