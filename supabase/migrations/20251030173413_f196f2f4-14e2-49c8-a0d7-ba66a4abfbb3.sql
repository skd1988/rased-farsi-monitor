-- Add source_url column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_url TEXT;