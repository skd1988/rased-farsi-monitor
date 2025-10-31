-- Create alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('Viral Content', 'Coordinated Campaign', 'Fake News', 'Direct Attack', 'Psychological Warfare', 'Propaganda')),
  severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Acknowledged', 'In Progress', 'Resolved', 'Dismissed')),
  triggered_reason TEXT NOT NULL,
  assigned_to TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Anyone can view alerts"
ON public.alerts
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert alerts"
ON public.alerts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update alerts"
ON public.alerts
FOR UPDATE
USING (true);

-- Create index for better performance
CREATE INDEX idx_alerts_post_id ON public.alerts(post_id);
CREATE INDEX idx_alerts_severity ON public.alerts(severity);
CREATE INDEX idx_alerts_status ON public.alerts(status);
CREATE INDEX idx_alerts_created_at ON public.alerts(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_alerts_updated_at
BEFORE UPDATE ON public.alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_posts_updated_at();

-- Function to automatically create alerts when posts are analyzed
CREATE OR REPLACE FUNCTION public.create_alert_from_analysis()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create alerts for posts that have been analyzed (threat_level is set)
  IF NEW.threat_level IS NOT NULL AND (OLD.threat_level IS NULL OR OLD.threat_level IS DISTINCT FROM NEW.threat_level) THEN
    
    -- Create alert for Critical threat level
    IF NEW.threat_level = 'Critical' THEN
      INSERT INTO public.alerts (
        post_id,
        alert_type,
        severity,
        status,
        triggered_reason
      ) VALUES (
        NEW.id,
        'Psychological Warfare',
        'Critical',
        'New',
        format('تهدید سطح بحرانی: %s | احساسات: %s | موضوع: %s', 
          NEW.threat_level, 
          COALESCE(NEW.sentiment, 'نامشخص'),
          COALESCE(NEW.main_topic, 'نامشخص')
        )
      );
    
    -- Create alert for High threat level
    ELSIF NEW.threat_level = 'High' THEN
      INSERT INTO public.alerts (
        post_id,
        alert_type,
        severity,
        status,
        triggered_reason
      ) VALUES (
        NEW.id,
        CASE 
          WHEN NEW.main_topic LIKE '%جنگ روانی%' THEN 'Psychological Warfare'
          WHEN NEW.main_topic LIKE '%کمپین%' THEN 'Coordinated Campaign'
          WHEN NEW.main_topic LIKE '%اتهام%' THEN 'Direct Attack'
          WHEN NEW.main_topic LIKE '%شبهه%' THEN 'Propaganda'
          ELSE 'Viral Content'
        END,
        'High',
        'New',
        format('تهدید سطح بالا: %s | احساسات: %s | موضوع: %s', 
          NEW.threat_level, 
          COALESCE(NEW.sentiment, 'نامشخص'),
          COALESCE(NEW.main_topic, 'نامشخص')
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create alerts when posts are analyzed
CREATE TRIGGER auto_create_alerts_on_analysis
AFTER INSERT OR UPDATE OF threat_level ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.create_alert_from_analysis();