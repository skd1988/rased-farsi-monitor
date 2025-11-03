-- Fix RLS policies to avoid has_role() evaluation delays for basic user data access
-- The issue is that when fetching user data, even though "Users can view their own profile" 
-- policy should work, PostgreSQL evaluates ALL policies including the super_admin one
-- which calls has_role() and can cause delays or hangs

-- Drop and recreate users table SELECT policies
DROP POLICY IF EXISTS "Super admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

-- Simple policy: authenticated users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Super admins can view all (but check this last, after own profile check)
CREATE POLICY "Admins view all users"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Fix user_roles SELECT policies
DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
);

-- Fix user_daily_limits SELECT policies
DROP POLICY IF EXISTS "Super admins can view all limits" ON public.user_daily_limits;
DROP POLICY IF EXISTS "Users can view their own limits" ON public.user_daily_limits;

CREATE POLICY "Users view own limits"
ON public.user_daily_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all limits"
ON public.user_daily_limits
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);