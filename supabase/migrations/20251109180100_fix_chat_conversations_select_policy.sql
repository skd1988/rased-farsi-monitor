-- Fix the RLS policy for viewing conversations
-- Current policy allows ALL logged in users to see ALL conversations (too permissive)
-- New policy: Users can only see conversations without user_id (old conversations) OR their own conversations

DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;

CREATE POLICY "Users can view own conversations"
  ON public.chat_conversations FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    (user_id IS NULL OR auth.uid() = user_id)
  );
