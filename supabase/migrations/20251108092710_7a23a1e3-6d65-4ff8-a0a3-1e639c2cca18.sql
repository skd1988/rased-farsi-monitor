-- Create database function to combine all user queries into one
CREATE OR REPLACE FUNCTION public.get_user_with_details(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  today DATE := CURRENT_DATE;
BEGIN
  SELECT json_build_object(
    'user', row_to_json(u.*),
    'role', (SELECT role FROM user_roles WHERE user_id = p_user_id LIMIT 1),
    'limits', row_to_json(l.*),
    'usage', COALESCE(
      (SELECT row_to_json(udu.*) FROM user_daily_usage udu 
       WHERE udu.user_id = p_user_id AND udu.usage_date = today),
      json_build_object(
        'user_id', p_user_id,
        'usage_date', today,
        'ai_analysis', 0,
        'chat_messages', 0,
        'exports', 0
      )
    )
  ) INTO result
  FROM users u
  LEFT JOIN user_daily_limits l ON l.user_id = u.id
  WHERE u.id = p_user_id;
  
  RETURN result;
END;
$$;