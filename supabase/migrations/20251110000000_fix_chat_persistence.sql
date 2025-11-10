-- Fix chat message metadata structure
-- This migration ensures metadata JSONB column can store nested structured_data

-- Add comment to document expected structure
COMMENT ON COLUMN chat_messages.metadata IS
'JSONB containing: sources, statistics, keyFindings, recommendations, structured_data (nested object), followUpQuestions (array)';

-- Verify RLS policies are correct
DO $$
BEGIN
  -- Check if policies exist and are permissive
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_messages'
    AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON public.chat_messages
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_messages'
    AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON public.chat_messages
      FOR SELECT USING (true);
  END IF;
END $$;

-- Create index on conversation_id for faster loading
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_timestamp
ON chat_messages(conversation_id, timestamp DESC);

-- Create index on metadata for structured queries (optional)
CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata_gin
ON chat_messages USING gin(metadata);
