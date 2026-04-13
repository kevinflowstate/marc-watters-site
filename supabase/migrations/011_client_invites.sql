-- Persistent client activation links.
-- These replace short-lived Supabase recovery links so a client can complete
-- portal setup whenever they are ready, until the invite is used or replaced.

CREATE TABLE IF NOT EXISTS public.client_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  used_ip INET
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_invites_token_hash
  ON public.client_invites(token_hash);

ALTER TABLE public.client_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage client invites" ON public.client_invites;
CREATE POLICY "Admins can manage client invites" ON public.client_invites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
