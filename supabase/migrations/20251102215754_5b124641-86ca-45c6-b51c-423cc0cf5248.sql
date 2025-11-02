-- Fix function search path security issue
DROP TRIGGER IF EXISTS batch_progress_update_timestamp ON public.batch_analysis_progress;
DROP FUNCTION IF EXISTS public.update_batch_progress_timestamp();

CREATE OR REPLACE FUNCTION public.update_batch_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER batch_progress_update_timestamp
BEFORE UPDATE ON public.batch_analysis_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_batch_progress_timestamp();