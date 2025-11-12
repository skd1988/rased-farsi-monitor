-- =====================================
-- FIX: Update Platform in social_media_channels
-- =====================================
-- Problem: All records have platform = "Other"
-- Solution: Update based on posts.source data

-- Step 1: Update platform based on posts.source
UPDATE social_media_channels smc
SET platform = CASE
  WHEN EXISTS (
    SELECT 1 FROM posts p
    WHERE p.channel_name = smc.channel_name
    AND p.source = 't.me'
    LIMIT 1
  ) THEN 'Telegram'

  WHEN EXISTS (
    SELECT 1 FROM posts p
    WHERE p.channel_name = smc.channel_name
    AND p.source = 'facebook.com'
    LIMIT 1
  ) THEN 'Facebook'

  WHEN EXISTS (
    SELECT 1 FROM posts p
    WHERE p.channel_name = smc.channel_name
    AND p.source = 'youtube.com'
    LIMIT 1
  ) THEN 'YouTube'

  WHEN EXISTS (
    SELECT 1 FROM posts p
    WHERE p.channel_name = smc.channel_name
    AND p.source IN ('twitter.com', 'x.com')
    LIMIT 1
  ) THEN 'Twitter'

  WHEN EXISTS (
    SELECT 1 FROM posts p
    WHERE p.channel_name = smc.channel_name
    AND p.source = 'instagram.com'
    LIMIT 1
  ) THEN 'Instagram'

  ELSE 'Other'
END
WHERE platform = 'Other' OR platform IS NULL;

-- Step 2: Verification Query
-- Run this separately to verify the changes
-- SELECT
--   platform,
--   COUNT(*) AS channel_count,
--   SUM(last_30days_psyop_count) AS total_psyops_30d,
--   SUM(historical_psyop_count) AS total_psyops_all
-- FROM social_media_channels
-- GROUP BY platform
-- ORDER BY channel_count DESC;
