-- Fix target_profiles schema for proper photo uploads
-- Make name_english nullable since many targets only have Persian names
ALTER TABLE public.target_profiles 
  ALTER COLUMN name_english DROP NOT NULL;

-- Ensure name_persian is NOT NULL as the primary identifier
ALTER TABLE public.target_profiles 
  ALTER COLUMN name_persian SET NOT NULL;