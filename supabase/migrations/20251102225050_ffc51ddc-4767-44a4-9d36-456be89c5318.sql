-- Create storage bucket for target photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'target-photos',
  'target-photos',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'target-photos');

-- Allow authenticated upload
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'target-photos');

-- Allow authenticated update
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'target-photos');

-- Allow authenticated delete
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'target-photos');

-- Create target_profiles table
CREATE TABLE IF NOT EXISTS public.target_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_english TEXT UNIQUE NOT NULL,
  name_persian TEXT,
  name_arabic TEXT,
  photo_url TEXT,
  photo_source TEXT, -- 'manual', 'wikipedia', 'generated'
  position TEXT,
  organization TEXT,
  category TEXT,
  bio_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.target_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Anyone can view target_profiles"
ON public.target_profiles FOR SELECT
USING (true);

-- Allow authenticated insert/update
CREATE POLICY "Authenticated can insert target_profiles"
ON public.target_profiles FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update target_profiles"
ON public.target_profiles FOR UPDATE
TO authenticated
USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_target_profiles_name ON public.target_profiles(name_english);
CREATE INDEX IF NOT EXISTS idx_target_profiles_persian ON public.target_profiles(name_persian);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION public.update_target_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_target_profiles_timestamp
BEFORE UPDATE ON public.target_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_target_profiles_updated_at();