-- Make all target name fields nullable
-- Since we now use unique_identifier, we don't need name_persian to be NOT NULL

-- Make name_persian nullable
ALTER TABLE target_profiles
ALTER COLUMN name_persian DROP NOT NULL;

-- Add check constraint to ensure at least one name exists
ALTER TABLE target_profiles
ADD CONSTRAINT check_at_least_one_name
CHECK (
  name_persian IS NOT NULL OR
  name_english IS NOT NULL OR
  name_arabic IS NOT NULL
);

-- Add comment for documentation
COMMENT ON CONSTRAINT check_at_least_one_name ON target_profiles IS
  'Ensures that each target has at least one name (Persian, English, or Arabic)';
