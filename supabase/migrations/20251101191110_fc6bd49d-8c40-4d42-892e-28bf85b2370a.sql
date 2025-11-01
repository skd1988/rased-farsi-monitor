-- Create api_usage_logs table to track DeepSeek API usage
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  model_used TEXT NOT NULL DEFAULT 'deepseek-chat',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (matching your current security model)
CREATE POLICY "Anyone can view api usage logs"
  ON public.api_usage_logs
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert api usage logs"
  ON public.api_usage_logs
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_api_usage_logs_created_at ON public.api_usage_logs(created_at DESC);
CREATE INDEX idx_api_usage_logs_post_id ON public.api_usage_logs(post_id);
CREATE INDEX idx_api_usage_logs_status ON public.api_usage_logs(status);

-- Add comment
COMMENT ON TABLE public.api_usage_logs IS 'Tracks DeepSeek API usage including tokens and costs for each analysis request';