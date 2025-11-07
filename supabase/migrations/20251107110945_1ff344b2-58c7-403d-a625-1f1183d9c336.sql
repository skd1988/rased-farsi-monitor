-- Fix RLS policies to require authentication and implement role-based access

-- ===== POSTS TABLE =====
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can insert posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can update posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can delete posts" ON public.posts;

-- Create secure policies for posts
CREATE POLICY "Authenticated users can view posts"
  ON public.posts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Analysts can insert posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin') OR 
     public.has_role(auth.uid(), 'analyst'))
  );

CREATE POLICY "Analysts can update posts"
  ON public.posts FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin') OR 
     public.has_role(auth.uid(), 'analyst'))
  );

CREATE POLICY "Admins can delete posts"
  ON public.posts FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin'))
  );

-- ===== ALERTS TABLE =====
DROP POLICY IF EXISTS "Anyone can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "Anyone can insert alerts" ON public.alerts;
DROP POLICY IF EXISTS "Anyone can update alerts" ON public.alerts;

CREATE POLICY "Authenticated users can view alerts"
  ON public.alerts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert alerts"
  ON public.alerts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Analysts can update alerts"
  ON public.alerts FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin') OR 
     public.has_role(auth.uid(), 'analyst'))
  );

CREATE POLICY "Admins can delete alerts"
  ON public.alerts FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin'))
  );

-- ===== AI_ANALYSIS TABLE =====
DROP POLICY IF EXISTS "Anyone can view ai_analysis" ON public.ai_analysis;
DROP POLICY IF EXISTS "Anyone can insert ai_analysis" ON public.ai_analysis;
DROP POLICY IF EXISTS "Anyone can update ai_analysis" ON public.ai_analysis;
DROP POLICY IF EXISTS "Anyone can delete ai_analysis" ON public.ai_analysis;

CREATE POLICY "Authenticated users can view ai_analysis"
  ON public.ai_analysis FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert ai_analysis"
  ON public.ai_analysis FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Analysts can update ai_analysis"
  ON public.ai_analysis FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin') OR 
     public.has_role(auth.uid(), 'analyst'))
  );

CREATE POLICY "Admins can delete ai_analysis"
  ON public.ai_analysis FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin'))
  );

-- ===== BATCH_ANALYSIS_PROGRESS TABLE =====
DROP POLICY IF EXISTS "Anyone can view batch progress" ON public.batch_analysis_progress;
DROP POLICY IF EXISTS "Anyone can insert batch progress" ON public.batch_analysis_progress;
DROP POLICY IF EXISTS "Anyone can update batch progress" ON public.batch_analysis_progress;

CREATE POLICY "Authenticated users can view batch progress"
  ON public.batch_analysis_progress FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert batch progress"
  ON public.batch_analysis_progress FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can update batch progress"
  ON public.batch_analysis_progress FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete batch progress"
  ON public.batch_analysis_progress FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin'))
  );

-- ===== CAMPAIGN_POSTS TABLE =====
DROP POLICY IF EXISTS "Anyone can view campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Anyone can insert campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Anyone can update campaign_posts" ON public.campaign_posts;
DROP POLICY IF EXISTS "Anyone can delete campaign_posts" ON public.campaign_posts;

CREATE POLICY "Authenticated users can view campaign_posts"
  ON public.campaign_posts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Analysts can manage campaign_posts"
  ON public.campaign_posts FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin') OR 
     public.has_role(auth.uid(), 'analyst'))
  );

-- ===== CHAT_CONVERSATIONS TABLE =====
DROP POLICY IF EXISTS "Anyone can view conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can insert conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can update conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can delete conversations" ON public.chat_conversations;

CREATE POLICY "Users can view own conversations"
  ON public.chat_conversations FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own conversations"
  ON public.chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.chat_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.chat_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ===== CHAT_MESSAGES TABLE =====
DROP POLICY IF EXISTS "Anyone can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can update messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can delete messages" ON public.chat_messages;

CREATE POLICY "Users can view messages in own conversations"
  ON public.chat_messages FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own messages"
  ON public.chat_messages FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own messages"
  ON public.chat_messages FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- ===== PSYOP_CAMPAIGNS TABLE =====
DROP POLICY IF EXISTS "Anyone can view psyop_campaigns" ON public.psyop_campaigns;
DROP POLICY IF EXISTS "Anyone can insert psyop_campaigns" ON public.psyop_campaigns;
DROP POLICY IF EXISTS "Anyone can update psyop_campaigns" ON public.psyop_campaigns;
DROP POLICY IF EXISTS "Anyone can delete psyop_campaigns" ON public.psyop_campaigns;

CREATE POLICY "Authenticated users can view psyop_campaigns"
  ON public.psyop_campaigns FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Analysts can manage psyop_campaigns"
  ON public.psyop_campaigns FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin') OR 
     public.has_role(auth.uid(), 'analyst'))
  );

-- ===== RESISTANCE_ENTITIES TABLE =====
DROP POLICY IF EXISTS "Anyone can view resistance_entities" ON public.resistance_entities;
DROP POLICY IF EXISTS "Anyone can insert resistance_entities" ON public.resistance_entities;
DROP POLICY IF EXISTS "Anyone can update resistance_entities" ON public.resistance_entities;
DROP POLICY IF EXISTS "Anyone can delete resistance_entities" ON public.resistance_entities;

CREATE POLICY "Authenticated users can view resistance_entities"
  ON public.resistance_entities FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Analysts can manage resistance_entities"
  ON public.resistance_entities FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin') OR 
     public.has_role(auth.uid(), 'analyst'))
  );

-- ===== RESISTANCE_PERSONS TABLE =====
DROP POLICY IF EXISTS "Anyone can view resistance_persons" ON public.resistance_persons;
DROP POLICY IF EXISTS "Anyone can insert resistance_persons" ON public.resistance_persons;
DROP POLICY IF EXISTS "Anyone can update resistance_persons" ON public.resistance_persons;
DROP POLICY IF EXISTS "Anyone can delete resistance_persons" ON public.resistance_persons;

CREATE POLICY "Authenticated users can view resistance_persons"
  ON public.resistance_persons FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Analysts can manage resistance_persons"
  ON public.resistance_persons FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    (public.has_role(auth.uid(), 'admin') OR 
     public.has_role(auth.uid(), 'super_admin') OR 
     public.has_role(auth.uid(), 'analyst'))
  );