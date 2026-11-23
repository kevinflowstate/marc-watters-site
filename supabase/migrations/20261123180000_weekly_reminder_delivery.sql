-- One attempt per client, check-in week and delivery channel, including overlapping cron runs.
CREATE TABLE public.weekly_checkin_reminder_delivery (
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','push')),
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed','accepted','partial','unconfirmed','no_destination','rejected')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY (client_id, week_start, channel)
);
ALTER TABLE public.weekly_checkin_reminder_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_checkin_reminder_delivery FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.weekly_checkin_reminder_delivery TO service_role;

CREATE FUNCTION public.claim_weekly_checkin_reminder(p_client uuid, p_week date, p_channel text)
RETURNS text LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF p_week IS DISTINCT FROM date_trunc('week', now() AT TIME ZONE 'Europe/London')::date THEN
    RAISE EXCEPTION 'Invalid reminder week';
  END IF;
  PERFORM 1 FROM public.client_profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.id = p_client AND u.role = 'client' AND p.archived_at IS NULL
      AND coalesce(p.payment_status,'current') NOT IN ('paused','cancelled')
    FOR SHARE OF p;
  IF NOT FOUND THEN RETURN 'ineligible'; END IF;

  IF EXISTS (SELECT 1 FROM public.checkins c WHERE c.client_id = p_client
    AND c.created_at >= (p_week::timestamp AT TIME ZONE 'Europe/London')
    AND c.created_at < ((p_week + 7)::timestamp AT TIME ZONE 'Europe/London')) THEN
    RETURN 'checked_in';
  END IF;
  INSERT INTO public.weekly_checkin_reminder_delivery(client_id, week_start, channel)
    VALUES(p_client,p_week,p_channel) ON CONFLICT DO NOTHING;
  IF FOUND THEN RETURN 'claimed'; END IF;
  RETURN 'already_attempted';
END;
$$;
REVOKE ALL ON FUNCTION public.claim_weekly_checkin_reminder(uuid,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_weekly_checkin_reminder(uuid,date,text) TO service_role;
