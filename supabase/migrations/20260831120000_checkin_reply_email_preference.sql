ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS checkin_reply_email_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.client_profiles.checkin_reply_email_enabled IS
  'Whether Marc replies to this client''s check-ins are also sent by email.';
