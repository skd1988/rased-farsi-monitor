-- =====================================
-- VERIFICATION: Check Platform Distribution
-- =====================================
-- Run this query BEFORE and AFTER the fix to see the changes

-- Query 1: Platform Distribution
SELECT
  platform,
  COUNT(*) AS channel_count,
  SUM(last_30days_psyop_count) AS total_psyops_30d,
  SUM(historical_psyop_count) AS total_psyops_all
FROM social_media_channels
GROUP BY platform
ORDER BY channel_count DESC;

-- Query 2: Sample Channels by Platform
SELECT
  platform,
  channel_name,
  last_30days_psyop_count,
  historical_psyop_count
FROM social_media_channels
ORDER BY platform, last_30days_psyop_count DESC
LIMIT 50;

-- Query 3: Check for NULL or Empty Platforms
SELECT
  COUNT(*) AS channels_with_issues
FROM social_media_channels
WHERE platform IS NULL OR platform = '' OR platform = 'Other';
