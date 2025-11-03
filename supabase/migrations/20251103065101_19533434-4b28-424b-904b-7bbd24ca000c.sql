-- Create trigger for automatically creating user records
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Manually create records for existing auth users that don't have user records
INSERT INTO public.users (id, email, full_name, status, last_login, created_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
  'active'::user_status,
  au.last_sign_in_at,
  au.created_at
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL;

-- Ensure all users have roles
INSERT INTO public.user_roles (user_id, role)
SELECT 
  u.id,
  'viewer'::app_role
FROM public.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL;

-- Ensure all users have daily limits
INSERT INTO public.user_daily_limits (user_id, ai_analysis, chat_messages, exports)
SELECT 
  u.id,
  10,
  50,
  20
FROM public.users u
LEFT JOIN public.user_daily_limits udl ON udl.user_id = u.id
WHERE udl.user_id IS NULL;

-- Ensure all users have daily usage record for today
INSERT INTO public.user_daily_usage (user_id, usage_date, ai_analysis, chat_messages, exports)
SELECT 
  u.id,
  CURRENT_DATE,
  0,
  0,
  0
FROM public.users u
LEFT JOIN public.user_daily_usage udu ON udu.user_id = u.id AND udu.usage_date = CURRENT_DATE
WHERE udu.user_id IS NULL;