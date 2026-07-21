ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE INDEX IF NOT EXISTS idx_client_profiles_archived_at
  ON public.client_profiles(archived_at);

ALTER TABLE public.client_invites
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.client_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('archive', 'restore', 'export')),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_lifecycle_events_client_created
  ON public.client_lifecycle_events(client_id, created_at DESC);

ALTER TABLE public.client_lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view client lifecycle events" ON public.client_lifecycle_events;
CREATE POLICY "Admins can view client lifecycle events" ON public.client_lifecycle_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.archive_client_atomic(
  p_client_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_was_archived boolean;
BEGIN
  SELECT user_id, archived_at IS NOT NULL
  INTO v_user_id, v_was_archived
  FROM public.client_profiles
  WHERE id = p_client_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  IF NOT v_was_archived THEN
    UPDATE public.client_profiles
    SET archived_at = now(), archived_by = p_actor_user_id, archive_reason = NULLIF(trim(p_reason), '')
    WHERE id = p_client_id;

    INSERT INTO public.client_lifecycle_events (client_id, event_type, actor_user_id, reason)
    VALUES (p_client_id, 'archive', p_actor_user_id, NULLIF(trim(p_reason), ''));
  END IF;

  UPDATE public.push_subscriptions
  SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
  WHERE user_id = v_user_id AND revoked_at IS NULL;

  UPDATE public.client_invites
  SET revoked_at = COALESCE(revoked_at, now())
  WHERE user_id = v_user_id AND used_at IS NULL AND revoked_at IS NULL;

  RETURN jsonb_build_object('userId', v_user_id, 'alreadyArchived', v_was_archived);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_client_atomic(
  p_client_id uuid,
  p_actor_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_was_archived boolean;
BEGIN
  SELECT archived_at IS NOT NULL
  INTO v_was_archived
  FROM public.client_profiles
  WHERE id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  IF v_was_archived THEN
    UPDATE public.client_profiles
    SET archived_at = NULL, archived_by = NULL, archive_reason = NULL
    WHERE id = p_client_id;

    INSERT INTO public.client_lifecycle_events (client_id, event_type, actor_user_id)
    VALUES (p_client_id, 'restore', p_actor_user_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_client_atomic(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_client_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_client_atomic(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_client_atomic(uuid, uuid) TO service_role;

-- Restrictive policies combine with existing policies using AND. This closes
-- direct Supabase API access for archived clients while preserving admin access.
CREATE OR REPLACE FUNCTION public.current_user_is_active_portal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE user_id = auth.uid() AND archived_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_active_portal_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_active_portal_user() TO authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'users', 'client_profiles', 'training_modules', 'module_content',
    'client_modules', 'content_progress', 'checkins', 'notifications',
    'business_plans', 'business_plan_phases', 'business_plan_items',
    'phase_training_links', 'form_config', 'calendar_events',
    'client_questionnaires', 'client_monthly_metrics', 'inbox_messages',
    'inbox_message_reactions', 'push_subscriptions', 'push_notification_attempts',
    'ai_usage'
  ]
  LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Active portal users only" ON public.%I', v_table);
      EXECUTE format(
        'CREATE POLICY "Active portal users only" ON public.%I AS RESTRICTIVE FOR ALL USING (public.current_user_is_active_portal_user()) WITH CHECK (public.current_user_is_active_portal_user())',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;
