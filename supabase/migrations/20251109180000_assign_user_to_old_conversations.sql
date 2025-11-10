-- Assign user_id to old conversations that have NULL user_id
-- This fixes the issue where old conversations can't load messages due to RLS policies

DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first user from the users table
  SELECT id INTO first_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  -- If we found a user, update all conversations with NULL user_id
  IF first_user_id IS NOT NULL THEN
    UPDATE public.chat_conversations
    SET user_id = first_user_id
    WHERE user_id IS NULL;

    RAISE NOTICE 'Updated % conversations with user_id',
      (SELECT COUNT(*) FROM public.chat_conversations WHERE user_id = first_user_id);
  ELSE
    RAISE NOTICE 'No users found in the system';
  END IF;
END $$;
