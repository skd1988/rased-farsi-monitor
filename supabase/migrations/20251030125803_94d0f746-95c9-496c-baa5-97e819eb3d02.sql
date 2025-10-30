-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view all posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete posts" ON public.posts;

-- Create new policies that allow access with the anon key
-- This is appropriate for an internal monitoring tool where all users should see all posts

CREATE POLICY "Anyone can view posts"
ON public.posts
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert posts"
ON public.posts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update posts"
ON public.posts
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete posts"
ON public.posts
FOR DELETE
USING (true);