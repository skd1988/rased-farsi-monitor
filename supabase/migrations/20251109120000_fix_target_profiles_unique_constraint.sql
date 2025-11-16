-- Fix target_profiles unique constraint to support multiple names
-- This migration addresses the issue where targets without name_persian
-- would fail to upload photos due to duplicate constraint violations

-- Drop existing unique constraint on name_persian
ALTER TABLE target_profiles
DROP CONSTRAINT IF EXISTS target_profiles_name_persian_key;

-- Add a unique identifier column if not exists
ALTER TABLE target_profiles
ADD COLUMN IF NOT EXISTS unique_identifier TEXT;

-- Create a unique index that combines all three name fields
-- This ensures that targets are unique based on their complete identity
CREATE UNIQUE INDEX IF NOT EXISTS idx_target_profiles_unique_names
ON target_profiles (
  COALESCE(name_persian, ''),
  COALESCE(name_english, ''),
  COALESCE(name_arabic, '')
);

-- Create a function to generate unique identifier
CREATE OR REPLACE FUNCTION generate_target_identifier(
  p_name_persian TEXT,
  p_name_english TEXT,
  p_name_arabic TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(p_name_persian, '') || '|' ||
         COALESCE(p_name_english, '') || '|' ||
         COALESCE(p_name_arabic, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing records to have unique_identifier
UPDATE target_profiles
SET unique_identifier = generate_target_identifier(name_persian, name_english, name_arabic)
WHERE unique_identifier IS NULL;

-- Add unique constraint on unique_identifier
ALTER TABLE target_profiles
ADD CONSTRAINT target_profiles_unique_identifier_key UNIQUE (unique_identifier);

-- Create trigger to automatically set unique_identifier on insert/update
CREATE OR REPLACE FUNCTION set_target_unique_identifier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.unique_identifier := generate_target_identifier(
    NEW.name_persian,
    NEW.name_english,
    NEW.name_arabic
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_target_unique_identifier
BEFORE INSERT OR UPDATE ON target_profiles
FOR EACH ROW
EXECUTE FUNCTION set_target_unique_identifier();

-- Add comment for documentation
COMMENT ON COLUMN target_profiles.unique_identifier IS
  'Auto-generated unique identifier combining all name fields';
