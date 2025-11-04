-- Fix RLS policies to prevent query timeouts and allow proper user authentication

-- ========================================
-- 1. FIX users table RLS policies
-- ========================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins view all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create correct policies for users table
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can view all users"
ON public.users FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update all users"
ON public.users FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role full access on users"
ON public.users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ========================================
-- 2. FIX user_roles table RLS policies
-- ========================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;

-- Create correct policies for user_roles table
-- NOTE: Cannot use has_role() here as it would cause infinite recursion
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'::app_role
  )
);

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'::app_role
  )
);

CREATE POLICY "Service role full access on user_roles"
ON public.user_roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ========================================
-- 3. FIX user_daily_limits table RLS policies
-- ========================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users view own limits" ON public.user_daily_limits;
DROP POLICY IF EXISTS "Admins view all limits" ON public.user_daily_limits;
DROP POLICY IF EXISTS "Super admins can manage limits" ON public.user_daily_limits;

-- Create correct policies for user_daily_limits table
CREATE POLICY "Users can view own limits"
ON public.user_daily_limits FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all limits"
ON public.user_daily_limits FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage all limits"
ON public.user_daily_limits FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role full access on limits"
ON public.user_daily_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ========================================
-- 4. FIX user_daily_usage table RLS policies
-- ========================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own usage" ON public.user_daily_usage;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.user_daily_usage;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.user_daily_usage;
DROP POLICY IF EXISTS "Super admins can view all usage" ON public.user_daily_usage;

-- Create correct policies for user_daily_usage table
CREATE POLICY "Users can view own usage"
ON public.user_daily_usage FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own usage"
ON public.user_daily_usage FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own usage"
ON public.user_daily_usage FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can view all usage"
ON public.user_daily_usage FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role full access on usage"
ON public.user_daily_usage FOR ALL
TO service_role
USING (true)
WITH CHECK (true);