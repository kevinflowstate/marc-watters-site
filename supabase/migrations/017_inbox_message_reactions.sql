CREATE TABLE IF NOT EXISTS public.inbox_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.inbox_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_inbox_message_reactions_message_id
  ON public.inbox_message_reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_inbox_message_reactions_user_id
  ON public.inbox_message_reactions(user_id);

ALTER TABLE public.inbox_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all inbox message reactions" ON public.inbox_message_reactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can view reactions on own inbox messages" ON public.inbox_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inbox_messages im
      JOIN public.client_profiles cp ON cp.id = im.client_id
      WHERE im.id = message_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can manage own reactions on own inbox messages" ON public.inbox_message_reactions
  FOR ALL USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.inbox_messages im
      JOIN public.client_profiles cp ON cp.id = im.client_id
      WHERE im.id = message_id AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.inbox_messages im
      JOIN public.client_profiles cp ON cp.id = im.client_id
      WHERE im.id = message_id AND cp.user_id = auth.uid()
    )
  );
