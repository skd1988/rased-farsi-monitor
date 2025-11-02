-- Fix search_path security issue - drop trigger first
DROP TRIGGER IF EXISTS update_target_profiles_timestamp ON public.target_profiles;

DROP FUNCTION IF EXISTS public.update_target_profiles_updated_at();

CREATE OR REPLACE FUNCTION public.update_target_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Recreate trigger
CREATE TRIGGER update_target_profiles_timestamp
BEFORE UPDATE ON public.target_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_target_profiles_updated_at();