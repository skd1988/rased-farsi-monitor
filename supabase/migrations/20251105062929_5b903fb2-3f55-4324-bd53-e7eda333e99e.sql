-- Fix RLS policies for all user-related tables to prevent loading issues

-- ========================================
-- FIX users table policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Super admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Service role full access on users" ON public.users;

-- Simple policy: users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Service role full access for edge functions
CREATE POLICY "Service role full access on users"
ON public.users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ========================================
-- FIX user_daily_limits table policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own limits" ON public.user_daily_limits;
DROP POLICY IF EXISTS "Super admins can view all limits" ON public.user_daily_limits;
DROP POLICY IF EXISTS "Super admins can update all limits" ON public.user_daily_limits;
DROP POLICY IF EXISTS "Service role full access on user_daily_limits" ON public.user_daily_limits;

-- Simple policy: users can view their own limits
CREATE POLICY "Users can view own limits"
ON public.user_daily_limits FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access on user_daily_limits"
ON public.user_daily_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ========================================
-- FIX user_daily_usage table policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own usage" ON public.user_daily_usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.user_daily_usage;
DROP POLICY IF EXISTS "Users can update own usage" ON public.user_daily_usage;
DROP POLICY IF EXISTS "Super admins can view all usage" ON public.user_daily_usage;
DROP POLICY IF EXISTS "Service role full access on user_daily_usage" ON public.user_daily_usage;

-- Users can view their own usage
CREATE POLICY "Users can view own usage"
ON public.user_daily_usage FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own usage (for creating today's record)
CREATE POLICY "Users can insert own usage"
ON public.user_daily_usage FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own usage (for incrementing counts)
CREATE POLICY "Users can update own usage"
ON public.user_daily_usage FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access on user_daily_usage"
ON public.user_daily_usage FOR ALL
TO service_role
USING (true)
WITH CHECK (true);