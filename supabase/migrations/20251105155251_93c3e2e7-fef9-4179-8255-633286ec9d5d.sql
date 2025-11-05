-- Fix RLS policies for target_profiles to allow authenticated users to upsert
DROP POLICY IF EXISTS "Authenticated can insert target_profiles" ON target_profiles;
DROP POLICY IF EXISTS "Authenticated can update target_profiles" ON target_profiles;

-- Create new policies that allow authenticated users to insert and update
CREATE POLICY "Authenticated users can insert target_profiles"
  ON target_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update target_profiles"
  ON target_profiles
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);