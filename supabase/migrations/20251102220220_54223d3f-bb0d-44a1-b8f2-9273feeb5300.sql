-- Add performance indexes for posts table

-- Single column indexes for common filters
CREATE INDEX IF NOT EXISTS idx_posts_is_psyop ON public.posts(is_psyop) WHERE is_psyop = true;
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON public.posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_threat_level ON public.posts(threat_level);
CREATE INDEX IF NOT EXISTS idx_posts_narrative_theme ON public.posts(narrative_theme);
CREATE INDEX IF NOT EXISTS idx_posts_analyzed_at ON public.posts(analyzed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_posts_analysis_stage ON public.posts(analysis_stage);
CREATE INDEX IF NOT EXISTS idx_posts_source ON public.posts(source);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_posts_psyop_threat ON public.posts(is_psyop, threat_level) WHERE is_psyop = true;
CREATE INDEX IF NOT EXISTS idx_posts_psyop_date ON public.posts(is_psyop, published_at DESC) WHERE is_psyop = true;
CREATE INDEX IF NOT EXISTS idx_posts_psyop_narrative ON public.posts(is_psyop, narrative_theme) WHERE is_psyop = true;
CREATE INDEX IF NOT EXISTS idx_posts_unanalyzed ON public.posts(analyzed_at, published_at DESC) WHERE analyzed_at IS NULL;

-- Indexes for target analysis
CREATE INDEX IF NOT EXISTS idx_posts_target_entity ON public.posts USING GIN(target_entity) WHERE is_psyop = true;
CREATE INDEX IF NOT EXISTS idx_posts_target_persons ON public.posts USING GIN(target_persons) WHERE is_psyop = true;

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_posts_title_search ON public.posts USING gin(to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS idx_posts_source_country ON public.posts(source_country);

-- Indexes for alerts table
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.psyop_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON public.psyop_campaigns(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_posts_campaign ON public.campaign_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_posts_post ON public.campaign_posts(post_id);

-- Update table statistics for query planner
ANALYZE public.posts;
ANALYZE public.alerts;
ANALYZE public.psyop_campaigns;