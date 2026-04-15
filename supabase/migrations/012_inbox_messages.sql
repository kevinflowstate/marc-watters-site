CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'client')),
  message TEXT NOT NULL,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  read_by_client BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_client_created
  ON public.inbox_messages(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_client_read_admin
  ON public.inbox_messages(client_id, read_by_admin);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_client_read_client
  ON public.inbox_messages(client_id, read_by_client);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all inbox messages" ON public.inbox_messages
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
    AND sender_role = 'admin'
    AND sender_user_id = auth.uid()
  );

CREATE POLICY "Clients can view own inbox messages" ON public.inbox_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE id = client_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can send own inbox messages" ON public.inbox_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE id = client_id AND user_id = auth.uid()
    )
    AND sender_role = 'client'
    AND sender_user_id = auth.uid()
  );

CREATE POLICY "Clients can mark own inbox messages read" ON public.inbox_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE id = client_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE id = client_id AND user_id = auth.uid()
    )
    AND sender_user_id <> auth.uid()
  );
