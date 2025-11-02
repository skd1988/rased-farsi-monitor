-- Add attack_vectors column to posts table if it doesn't exist
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS attack_vectors text[];