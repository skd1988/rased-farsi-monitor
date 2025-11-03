-- Fix infinite recursion in RLS policies by using has_role() SECURITY DEFINER function
-- The problem: policies on user_roles, users, and user_daily_limits were querying user_roles directly
-- which creates infinite recursion. Solution: use has_role() which is SECURITY DEFINER and bypasses RLS

-- Fix users table admin policy
DROP POLICY IF EXISTS "Admins view all users" ON public.users;

CREATE POLICY "Admins view all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix user_roles table admin policy
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;

CREATE POLICY "Admins view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix user_daily_limits table admin policy
DROP POLICY IF EXISTS "Admins view all limits" ON public.user_daily_limits;

CREATE POLICY "Admins view all limits"
ON public.user_daily_limits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));