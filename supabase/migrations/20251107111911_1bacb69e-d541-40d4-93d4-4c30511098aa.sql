-- Fix target_profiles RLS policies to require authentication

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view target_profiles" ON target_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert target_profiles" ON target_profiles;
DROP POLICY IF EXISTS "Authenticated users can update target_profiles" ON target_profiles;

-- Require authentication for SELECT
CREATE POLICY "Authenticated users can view target_profiles"
  ON target_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only analysts+ can INSERT
CREATE POLICY "Analysts can insert target_profiles"
  ON target_profiles FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'analyst') OR
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'super_admin')
    )
  );

-- Only analysts+ can UPDATE
CREATE POLICY "Analysts can update target_profiles"
  ON target_profiles FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'analyst') OR
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'super_admin')
    )
  );

-- Only admins can DELETE
CREATE POLICY "Admins can delete target_profiles"
  ON target_profiles FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'super_admin')
    )
  );