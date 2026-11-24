ALTER TABLE public.client_profiles
  ADD COLUMN checkin_prompts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN checkin_prompts_resumed_at timestamptz;

-- Clients can edit ordinary profile fields. These settings belong to the staff account.
CREATE FUNCTION public.guard_checkin_preference() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.checkin_prompts_enabled IS NOT DISTINCT FROM OLD.checkin_prompts_enabled
       AND NEW.checkin_prompts_resumed_at IS NOT DISTINCT FROM OLD.checkin_prompts_resumed_at THEN RETURN NEW; END IF;
  ELSIF NEW.checkin_prompts_enabled AND NEW.checkin_prompts_resumed_at IS NULL THEN RETURN NEW;
  END IF;
  IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'Only staff can change check-in prompts';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_checkin_preference BEFORE INSERT OR UPDATE OF checkin_prompts_enabled,checkin_prompts_resumed_at
ON public.client_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_checkin_preference();

CREATE OR REPLACE FUNCTION public.claim_weekly_checkin_reminder(p_client uuid, p_week date, p_channel text)
RETURNS text LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF p_week IS DISTINCT FROM date_trunc('week', now() AT TIME ZONE 'Europe/London')::date THEN
    RAISE EXCEPTION 'Invalid reminder week';
  END IF;
  PERFORM 1 FROM public.client_profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.id = p_client AND u.role = 'client' AND p.archived_at IS NULL
      AND p.checkin_prompts_enabled AND coalesce(p.payment_status,'current') NOT IN ('paused','cancelled')
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

-- The daily sweep creates one follow-up for each uninterrupted gap. A real
-- submission closes only system-generated overdue flags for that client.
CREATE OR REPLACE FUNCTION public.ops_reconcile_engagement_tasks(
  p_now timestamptz DEFAULT now(), p_client_id uuid DEFAULT NULL
) RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  client record;
  task public.ops_tasks%ROWTYPE;
  latest_submission timestamptz;
  gap_start timestamptz;
  gap_ref text;
  existing boolean;
  managed_pattern text;
  reason text;
BEGIN
  -- submit_checkin_atomic locks the same client row. Re-read submissions and
  -- tasks after acquiring this lock so a stale sweep cannot recreate a flag.
  FOR client IN
    SELECT p.id, p.created_at, p.last_checkin, p.checkin_prompts_enabled, p.checkin_prompts_resumed_at, p.archived_at, p.payment_status,
           coalesce(nullif(u.full_name, ''), nullif(p.business_name, ''), 'Client') AS name
    FROM public.client_profiles p LEFT JOIN public.users u ON u.id = p.user_id
    WHERE p.id = p_client_id OR (p_client_id IS NULL AND (
      (p.checkin_prompts_enabled AND p.archived_at IS NULL AND p.payment_status NOT IN ('paused','cancelled')
       AND coalesce(p.last_checkin, p.created_at) <= p_now - interval '14 days')
      OR EXISTS (SELECT 1 FROM public.ops_tasks t WHERE t.client_id = p.id
                 AND t.area = 'engagement' AND t.kind = 'flag' AND t.source = 'system'
                 AND t.status IN ('open','in_progress'))
    ))
    ORDER BY p.id FOR UPDATE OF p
  LOOP
    SELECT max(ci.created_at) INTO latest_submission FROM public.checkins ci WHERE ci.client_id = client.id;
    gap_start := greatest(coalesce(greatest(latest_submission, client.last_checkin), client.created_at), client.checkin_prompts_resumed_at);
    gap_ref := 'engagement:' || client.id || ':gap-' || (extract(epoch FROM gap_start) * 1000000)::bigint;
    managed_pattern := '^engagement:' || client.id || ':([0-9]{4}-W[0-9]{2}|gap-[0-9]+)$';
    existing := false;

    FOR task IN
      SELECT t.* FROM public.ops_tasks t
      WHERE t.client_id = client.id AND t.source = 'system' AND t.kind = 'flag' AND t.area = 'engagement'
        AND t.created_by = 'system' AND t.external_ref ~ managed_pattern
        AND (t.status IN ('open','in_progress') OR t.created_at >= gap_start OR t.external_ref = gap_ref)
      ORDER BY t.created_at, t.id FOR UPDATE
    LOOP
      -- Preserve a human's prior completion/dismissal for this same gap.
      IF task.status NOT IN ('open','in_progress') THEN
        IF task.external_ref = gap_ref OR (task.external_ref LIKE '%-W%' AND task.created_at > gap_start) THEN
          existing := true;
        END IF;
        CONTINUE;
      END IF;

      reason := NULL;
      IF NOT client.checkin_prompts_enabled THEN
        reason := 'Check-in prompts disabled on the client profile.';
      ELSIF latest_submission IS NOT NULL AND (
        latest_submission >= task.created_at OR
        (task.external_ref LIKE '%:gap-%' AND
         (extract(epoch FROM latest_submission) * 1000000) > substring(task.external_ref FROM 'gap-([0-9]+)$')::numeric)
      ) THEN
        reason := 'Check-in received. Review the submission separately.';
      ELSIF existing THEN
        reason := 'This check-in gap already has a follow-up.';
      ELSE
        existing := true;
      END IF;
      IF reason IS NOT NULL THEN
        PERFORM public.ops_mutate_task('complete',
          jsonb_build_object('status','done','decision_note',coalesce(task.decision_note,reason)),
          'engagement-reconciliation',task.id);
        RETURN NEXT task.id;
      END IF;
    END LOOP;

    -- The submission trigger reconciles only. Creation belongs to the sweep.
    IF p_client_id IS NULL AND NOT existing AND client.checkin_prompts_enabled AND client.archived_at IS NULL
       AND client.payment_status NOT IN ('paused','cancelled') AND gap_start <= p_now - interval '14 days' THEN
      -- External references are also accepted on manually-created tasks. Never
      -- upsert over a human-owned record that happens to use the same reference.
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(gap_ref,0));
      IF EXISTS (SELECT 1 FROM public.ops_tasks WHERE external_ref = gap_ref) THEN CONTINUE; END IF;
      task := public.ops_mutate_task('create', jsonb_build_object(
        'kind','flag','area','engagement','source','system','assignee','eimear',
        'title',client.name || ' · overdue check-in',
        'detail','Review the agreed check-in schedule and recent contact before following up. Refer coaching questions to Marc.',
        'client_id',client.id,'external_ref',gap_ref
      ),'system');
      RETURN NEXT task.id;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.ops_reconcile_engagement_tasks(timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_reconcile_engagement_tasks(timestamptz,uuid) TO service_role;


CREATE FUNCTION public.ops_set_checkin_prompts(p_client uuid,p_enabled boolean,p_actor text)
RETURNS public.client_profiles LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE profile public.client_profiles;
BEGIN
  SELECT * INTO STRICT profile FROM public.client_profiles WHERE id=p_client FOR UPDATE;
  IF profile.checkin_prompts_enabled = p_enabled THEN RETURN profile; END IF;
  UPDATE public.client_profiles SET checkin_prompts_enabled=p_enabled,
    checkin_prompts_resumed_at=CASE WHEN p_enabled THEN now() ELSE checkin_prompts_resumed_at END
  WHERE id=p_client RETURNING * INTO profile;
  PERFORM public.ops_reconcile_engagement_tasks(now(),p_client);
  INSERT INTO public.ops_events(actor,action,data) VALUES
    (p_actor,'checkin_prompts_updated',jsonb_build_object('client_id',p_client,'enabled',p_enabled));
  RETURN profile;
END $$;
REVOKE ALL ON FUNCTION public.ops_set_checkin_prompts(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_set_checkin_prompts(uuid,boolean,text) TO service_role;
