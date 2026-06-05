ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_status integer,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_revoked
  ON public.push_subscriptions(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS public.push_notification_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  endpoint_hash text,
  notification_type text,
  notification_tag text,
  status text NOT NULL CHECK (status IN ('success', 'failure', 'skipped')),
  error_status integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_notification_attempts_user_created
  ON public.push_notification_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_attempts_subscription_created
  ON public.push_notification_attempts(subscription_id, created_at DESC);

ALTER TABLE public.push_notification_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push attempts" ON public.push_notification_attempts;
CREATE POLICY "Users can view own push attempts" ON public.push_notification_attempts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all push attempts" ON public.push_notification_attempts;
CREATE POLICY "Admins can view all push attempts" ON public.push_notification_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
