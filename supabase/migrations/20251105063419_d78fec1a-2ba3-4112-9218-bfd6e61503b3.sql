-- Remove super_admin checks from policies that block initial login
-- Super admins will use service_role for admin operations

-- ========================================
-- FIX users table - remove super_admin policies
-- ========================================

DROP POLICY IF EXISTS "Super admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can update all users" ON public.users;

-- ========================================
-- FIX user_daily_limits - remove super_admin policies  
-- ========================================

DROP POLICY IF EXISTS "Super admins can view all limits" ON public.user_daily_limits;
DROP POLICY IF EXISTS "Super admins can manage all limits" ON public.user_daily_limits;

-- ========================================
-- FIX user_daily_usage - remove super_admin policies
-- ========================================

DROP POLICY IF EXISTS "Super admins can view all usage" ON public.user_daily_usage;

-- Now all users (including super_admin) will only see their own data through the simple policies
-- Admin operations will be done through edge functions using service_role