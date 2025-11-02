-- Add PsyOp detection columns to posts table
ALTER TABLE public.posts
ADD COLUMN is_psyop boolean DEFAULT false,
ADD COLUMN psyop_confidence integer CHECK (psyop_confidence >= 0 AND psyop_confidence <= 100),
ADD COLUMN target_entity text[],
ADD COLUMN target_persons text[],
ADD COLUMN psyop_technique text[],
ADD COLUMN counter_narrative_ready boolean DEFAULT false;

-- Create AI Analysis table for detailed PsyOp analysis
CREATE TABLE public.ai_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  is_psyop text CHECK (is_psyop IN ('Yes', 'No', 'Uncertain')),
  psyop_type text CHECK (psyop_type IN ('Direct Attack', 'Indirect Accusation', 'Doubt Creation', 'False Flag', 'Demoralization', 'Division Creation', 'Information Warfare', 'Propaganda Campaign')),
  primary_target text,
  secondary_targets text[],
  targeted_persons text[],
  target_category text CHECK (target_category IN ('Leadership', 'Military Forces', 'Political Wing', 'Social Base', 'International Support')),
  attack_vectors text[],
  narrative_theme text CHECK (narrative_theme IN ('Delegitimization', 'Demonization', 'Isolation', 'Enemy Normalization', 'Internal Conflict')),
  virality_potential integer CHECK (virality_potential >= 0 AND virality_potential <= 10),
  coordination_indicators text[],
  evidence_type text[],
  source_credibility text CHECK (source_credibility IN ('Known Enemy Source', 'Suspicious Source', 'Neutral Source', 'Unclear Source')),
  urgency_level text CHECK (urgency_level IN ('Immediate', 'High', 'Medium', 'Low', 'Monitor Only')),
  recommended_response text,
  counter_narrative_points text[],
  suggested_spokespeople text[],
  response_channels text[],
  campaign_indicators jsonb,
  analyzed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create Resistance Entities table
CREATE TABLE public.resistance_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_persian text NOT NULL,
  name_arabic text,
  name_english text,
  entity_type text NOT NULL CHECK (entity_type IN ('Country', 'Organization', 'Movement', 'Political Party')),
  location text CHECK (location IN ('Iran', 'Iraq', 'Lebanon', 'Syria', 'Yemen', 'Palestine', 'Other')),
  description text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Create Resistance Persons table
CREATE TABLE public.resistance_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_persian text NOT NULL,
  name_arabic text,
  name_english text,
  role text CHECK (role IN ('Political Leader', 'Military Commander', 'Religious Authority', 'Spokesperson', 'Activist')),
  entity_id uuid REFERENCES public.resistance_entities(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Create PsyOp Campaigns table
CREATE TABLE public.psyop_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text NOT NULL,
  start_date timestamp with time zone DEFAULT now(),
  end_date timestamp with time zone,
  campaign_type text CHECK (campaign_type IN ('Coordinated Attack', 'Disinformation Wave', 'Character Assassination', 'Strategic Narrative')),
  main_target text,
  target_persons text[],
  orchestrator text CHECK (orchestrator IN ('Israel', 'USA', 'Saudi', 'UAE', 'Western Media', 'Unknown')),
  status text DEFAULT 'Active' CHECK (status IN ('Active', 'Monitoring', 'Declining', 'Ended')),
  impact_assessment integer CHECK (impact_assessment >= 0 AND impact_assessment <= 10),
  counter_campaign_status text DEFAULT 'Not Started' CHECK (counter_campaign_status IN ('Not Started', 'In Progress', 'Launched', 'Successful')),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create Campaign Posts junction table
CREATE TABLE public.campaign_posts (
  campaign_id uuid NOT NULL REFERENCES public.psyop_campaigns(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  added_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (campaign_id, post_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resistance_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resistance_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psyop_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_analysis
CREATE POLICY "Anyone can view ai_analysis" ON public.ai_analysis FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ai_analysis" ON public.ai_analysis FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ai_analysis" ON public.ai_analysis FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete ai_analysis" ON public.ai_analysis FOR DELETE USING (true);

-- Create RLS policies for resistance_entities
CREATE POLICY "Anyone can view resistance_entities" ON public.resistance_entities FOR SELECT USING (true);
CREATE POLICY "Anyone can insert resistance_entities" ON public.resistance_entities FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update resistance_entities" ON public.resistance_entities FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete resistance_entities" ON public.resistance_entities FOR DELETE USING (true);

-- Create RLS policies for resistance_persons
CREATE POLICY "Anyone can view resistance_persons" ON public.resistance_persons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert resistance_persons" ON public.resistance_persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update resistance_persons" ON public.resistance_persons FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete resistance_persons" ON public.resistance_persons FOR DELETE USING (true);

-- Create RLS policies for psyop_campaigns
CREATE POLICY "Anyone can view psyop_campaigns" ON public.psyop_campaigns FOR SELECT USING (true);
CREATE POLICY "Anyone can insert psyop_campaigns" ON public.psyop_campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update psyop_campaigns" ON public.psyop_campaigns FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete psyop_campaigns" ON public.psyop_campaigns FOR DELETE USING (true);

-- Create RLS policies for campaign_posts
CREATE POLICY "Anyone can view campaign_posts" ON public.campaign_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert campaign_posts" ON public.campaign_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update campaign_posts" ON public.campaign_posts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete campaign_posts" ON public.campaign_posts FOR DELETE USING (true);

-- Create indexes for better query performance
CREATE INDEX idx_ai_analysis_post_id ON public.ai_analysis(post_id);
CREATE INDEX idx_ai_analysis_is_psyop ON public.ai_analysis(is_psyop);
CREATE INDEX idx_ai_analysis_psyop_type ON public.ai_analysis(psyop_type);
CREATE INDEX idx_ai_analysis_urgency ON public.ai_analysis(urgency_level);
CREATE INDEX idx_resistance_persons_entity ON public.resistance_persons(entity_id);
CREATE INDEX idx_campaign_posts_campaign ON public.campaign_posts(campaign_id);
CREATE INDEX idx_campaign_posts_post ON public.campaign_posts(post_id);
CREATE INDEX idx_posts_is_psyop ON public.posts(is_psyop);
CREATE INDEX idx_psyop_campaigns_status ON public.psyop_campaigns(status);