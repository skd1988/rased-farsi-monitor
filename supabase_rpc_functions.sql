-- SQL RPC Functions for Incrementing PsyOp Counts
-- Run these in Supabase SQL Editor to enable automatic PsyOp count updates

-- Function to increment source PsyOp count
CREATE OR REPLACE FUNCTION increment_source_psyop_count(source_name text)
RETURNS void AS $$
BEGIN
  UPDATE source_profiles
  SET
    historical_psyop_count = COALESCE(historical_psyop_count, 0) + 1,
    last_30days_psyop_count = COALESCE(last_30days_psyop_count, 0) + 1
  WHERE source_profiles.source_name = increment_source_psyop_count.source_name;
END;
$$ LANGUAGE plpgsql;

-- Function to increment channel PsyOp count
CREATE OR REPLACE FUNCTION increment_channel_psyop_count(channel_name text)
RETURNS void AS $$
BEGIN
  UPDATE social_media_channels
  SET
    historical_psyop_count = COALESCE(historical_psyop_count, 0) + 1,
    last_30days_psyop_count = COALESCE(last_30days_psyop_count, 0) + 1
  WHERE social_media_channels.channel_name = increment_channel_psyop_count.channel_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_source_psyop_count(text) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_channel_psyop_count(text) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_source_psyop_count(text) TO anon;
GRANT EXECUTE ON FUNCTION increment_channel_psyop_count(text) TO anon;

-- Verification queries (optional - run these to verify the functions work)
-- SELECT increment_source_psyop_count('Test Source');
-- SELECT increment_channel_psyop_count('Test Channel');
