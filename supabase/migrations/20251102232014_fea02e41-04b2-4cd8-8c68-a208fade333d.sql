
-- Remove the unique constraint on name_english
ALTER TABLE target_profiles 
DROP CONSTRAINT IF EXISTS target_profiles_name_english_key;

-- Add unique constraint on name_persian instead (since all targets have Persian names)
ALTER TABLE target_profiles 
ADD CONSTRAINT target_profiles_name_persian_key UNIQUE (name_persian);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_target_profiles_name_persian 
ON target_profiles(name_persian);
