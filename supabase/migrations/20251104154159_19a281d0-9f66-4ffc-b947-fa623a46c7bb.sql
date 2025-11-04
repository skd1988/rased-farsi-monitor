-- Fix infinite recursion in user_roles RLS policies
-- The issue: policies that query user_roles within user_roles policies cause recursion

-- ========================================
-- FIX user_roles table policies
-- ========================================

-- Drop all existing policies on user_roles
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role full access on user_roles" ON public.user_roles;

-- Create simple policy for users to view their own role
-- This is safe because it only checks auth.uid() = user_id
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role needs full access for edge functions
CREATE POLICY "Service role full access on user_roles"
ON public.user_roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- For super_admin operations, we'll rely on the security definer function
-- or use service_role context in edge functions
-- DO NOT create a policy that queries user_roles to check if user is super_admin
-- as that creates infinite recursion!