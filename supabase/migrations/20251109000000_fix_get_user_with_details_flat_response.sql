-- Migration: Fix get_user_with_details to return flat structure instead of nested
-- This fixes the login issue where the frontend expects a flat object

-- Drop existing function
DROP FUNCTION IF EXISTS get_user_with_details(UUID);

-- Create new function that returns a flat structure
CREATE OR REPLACE FUNCTION get_user_with_details(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  status user_status,
  preferences JSONB,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  role app_role,
  daily_ai_analysis_limit INTEGER,
  daily_chat_messages_limit INTEGER,
  daily_exports_limit INTEGER,
  daily_ai_analysis_used INTEGER,
  daily_chat_messages_used INTEGER,
  daily_exports_used INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today DATE;
BEGIN
  -- Get current date for usage lookup
  today := CURRENT_DATE;

  -- Return flat structure with all user data
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.full_name,
    u.status,
    u.preferences,
    u.last_login,
    u.created_at,
    u.updated_at,
    ur.role,
    udl.ai_analysis AS daily_ai_analysis_limit,
    udl.chat_messages AS daily_chat_messages_limit,
    udl.exports AS daily_exports_limit,
    COALESCE(udu.ai_analysis, 0) AS daily_ai_analysis_used,
    COALESCE(udu.chat_messages, 0) AS daily_chat_messages_used,
    COALESCE(udu.exports, 0) AS daily_exports_used
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN user_daily_limits udl ON udl.user_id = u.id
  LEFT JOIN user_daily_usage udu ON udu.user_id = u.id AND udu.usage_date = today
  WHERE u.id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_with_details(UUID) TO authenticated;

-- Add function comment
COMMENT ON FUNCTION get_user_with_details(UUID) IS
'Returns user details in a flat structure for easier consumption by the frontend.
Combines data from users, user_roles, user_daily_limits, and user_daily_usage tables.
Uses SECURITY DEFINER to bypass RLS policies during execution.';
