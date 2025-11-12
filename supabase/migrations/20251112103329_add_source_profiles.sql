-- Create source_profiles table
CREATE TABLE public.source_profiles (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT UNIQUE NOT NULL,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN (
    'RSS Feed',
    'Telegram Channel',
    'Twitter Account',
    'Instagram Account',
    'Facebook Page',
    'YouTube Channel',
    'News Website'
  )),

  -- Political Classification
  political_alignment TEXT CHECK (political_alignment IN (
    'Pro-Resistance',
    'Neutral',
    'Anti-Resistance',
    'Western-Aligned',
    'Israeli-Affiliated',
    'Saudi-Aligned',
    'Unknown'
  )),

  -- Impact Metrics
  reach_score INTEGER DEFAULT 50 CHECK (reach_score >= 0 AND reach_score <= 100),
  credibility_score INTEGER DEFAULT 50 CHECK (credibility_score >= 0 AND credibility_score <= 100),
  virality_coefficient DECIMAL(3,2) DEFAULT 1.0 CHECK (virality_coefficient >= 0 AND virality_coefficient <= 5.0),
  threat_multiplier DECIMAL(3,2) DEFAULT 1.0 CHECK (threat_multiplier >= 0.5 AND threat_multiplier <= 3.0),

  -- Real Stats
  average_daily_posts INTEGER DEFAULT 0,
  total_followers BIGINT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,

  -- Historical Performance
  historical_psyop_count INTEGER DEFAULT 0,
  last_30days_psyop_count INTEGER DEFAULT 0,
  viral_content_count INTEGER DEFAULT 0,

  -- Metadata
  country TEXT,
  language TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Indexes
CREATE INDEX idx_source_profiles_name ON public.source_profiles(source_name);
CREATE INDEX idx_source_profiles_alignment ON public.source_profiles(political_alignment);
CREATE INDEX idx_source_profiles_threat ON public.source_profiles(threat_multiplier DESC);
CREATE INDEX idx_source_profiles_reach ON public.source_profiles(reach_score DESC);

-- RLS Policies
ALTER TABLE public.source_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view source_profiles"
ON public.source_profiles FOR SELECT USING (true);

CREATE POLICY "Authenticated can manage source_profiles"
ON public.source_profiles FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

-- Add columns to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS source_impact_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weighted_threat_level TEXT;

-- Function to calculate impact score automatically
CREATE OR REPLACE FUNCTION calculate_post_impact()
RETURNS TRIGGER AS $$
DECLARE
  source_profile RECORD;
  impact_score INTEGER;
  base_score INTEGER;
  alignment_weight DECIMAL;
BEGIN
  -- Get source profile
  SELECT * INTO source_profile
  FROM source_profiles
  WHERE source_name = NEW.source;

  IF FOUND THEN
    -- Base score from threat level
    base_score := CASE NEW.threat_level
      WHEN 'Critical' THEN 100
      WHEN 'High' THEN 75
      WHEN 'Medium' THEN 50
      ELSE 25
    END;

    -- Alignment weight
    alignment_weight := CASE source_profile.political_alignment
      WHEN 'Israeli-Affiliated' THEN 1.5
      WHEN 'Western-Aligned' THEN 1.3
      WHEN 'Anti-Resistance' THEN 1.4
      WHEN 'Saudi-Aligned' THEN 1.2
      WHEN 'Neutral' THEN 1.0
      WHEN 'Pro-Resistance' THEN 0.5
      ELSE 1.0
    END;

    -- Calculate impact score
    impact_score := (
      base_score
      * (source_profile.reach_score::DECIMAL / 100)
      * (source_profile.credibility_score::DECIMAL / 100)
      * source_profile.virality_coefficient
      * source_profile.threat_multiplier
      * alignment_weight
    )::INTEGER;

    NEW.source_impact_score := LEAST(impact_score, 1000);

    -- Calculate weighted threat level
    NEW.weighted_threat_level :=
      CASE
        WHEN NEW.source_impact_score >= 800 THEN 'Critical'
        WHEN NEW.source_impact_score >= 600 THEN 'High'
        WHEN NEW.source_impact_score >= 400 THEN 'Medium'
        ELSE 'Low'
      END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic calculation
CREATE TRIGGER calculate_impact_on_analysis
BEFORE INSERT OR UPDATE OF is_psyop, threat_level
ON posts
FOR EACH ROW
WHEN (NEW.is_psyop = true)
EXECUTE FUNCTION calculate_post_impact();

-- Seed data for existing sources
INSERT INTO source_profiles (source_name, source_type, political_alignment, reach_score, credibility_score, virality_coefficient, threat_multiplier, country, language) VALUES
-- High Threat Sources
('الجزیرة', 'News Website', 'Western-Aligned', 95, 85, 3.5, 2.2, 'Qatar', ARRAY['عربی', 'English']),
('BBC Persian', 'News Website', 'Western-Aligned', 90, 80, 3.2, 2.0, 'UK', ARRAY['فارسی', 'English']),
('العربیة', 'News Website', 'Saudi-Aligned', 85, 70, 2.8, 2.5, 'Saudi Arabia', ARRAY['عربی']),
('Sky News Arabia', 'News Website', 'Western-Aligned', 80, 75, 2.5, 1.8, 'UAE', ARRAY['عربی']),
('RT Arabic', 'News Website', 'Neutral', 75, 65, 2.3, 1.5, 'Russia', ARRAY['عربی']),

-- Neutral Sources
('Reuters', 'News Website', 'Neutral', 92, 95, 2.5, 1.0, 'UK', ARRAY['English']),
('BBC Arabic', 'News Website', 'Western-Aligned', 88, 82, 2.8, 1.7, 'UK', ARRAY['عربی']),

-- Pro-Resistance Sources
('Press TV', 'News Website', 'Pro-Resistance', 70, 65, 2.0, 0.5, 'Iran', ARRAY['فارسی', 'English']),
('تسنیم', 'RSS Feed', 'Pro-Resistance', 80, 75, 2.2, 0.5, 'Iran', ARRAY['فارسی']),
('فارس', 'RSS Feed', 'Pro-Resistance', 75, 70, 2.0, 0.5, 'Iran', ARRAY['فارسی']),
('مهر', 'RSS Feed', 'Pro-Resistance', 78, 72, 2.1, 0.5, 'Iran', ARRAY['فارسی']),
('ایسنا', 'RSS Feed', 'Pro-Resistance', 82, 78, 2.3, 0.5, 'Iran', ARRAY['فارسی']),
('ایرنا', 'RSS Feed', 'Pro-Resistance', 77, 74, 2.0, 0.5, 'Iran', ARRAY['فارسی']),

-- Unknown/Other
('نامشخص', 'News Website', 'Unknown', 30, 30, 0.5, 1.0, 'Unknown', ARRAY['فارسی'])
ON CONFLICT (source_name) DO NOTHING;
