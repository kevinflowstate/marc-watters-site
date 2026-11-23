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
    SELECT p.id, p.created_at, p.last_checkin, p.archived_at, p.payment_status,
           coalesce(nullif(u.full_name, ''), nullif(p.business_name, ''), 'Client') AS name
    FROM public.client_profiles p LEFT JOIN public.users u ON u.id = p.user_id
    WHERE p.id = p_client_id OR (p_client_id IS NULL AND (
      (p.archived_at IS NULL AND p.payment_status NOT IN ('paused','cancelled')
       AND coalesce(p.last_checkin, p.created_at) <= p_now - interval '14 days')
      OR EXISTS (SELECT 1 FROM public.ops_tasks t WHERE t.client_id = p.id
                 AND t.area = 'engagement' AND t.kind = 'flag' AND t.source = 'system'
                 AND t.status IN ('open','in_progress'))
    ))
    ORDER BY p.id FOR UPDATE OF p
  LOOP
    SELECT max(ci.created_at) INTO latest_submission FROM public.checkins ci WHERE ci.client_id = client.id;
    gap_start := coalesce(greatest(latest_submission, client.last_checkin), client.created_at);
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
      IF latest_submission IS NOT NULL AND (
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
    IF p_client_id IS NULL AND NOT existing AND client.archived_at IS NULL
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

CREATE OR REPLACE FUNCTION public.ops_close_engagement_on_checkin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.ops_reconcile_engagement_tasks(now(),NEW.client_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A task or audit failure must not discard a client's submission. The daily
  -- sweep also selects open flags and retries against the saved check-in.
  RAISE WARNING 'Check-in follow-up reconciliation deferred to the daily sweep (%)', SQLSTATE;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ops_close_engagement_on_checkin() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_close_engagement_on_checkin AFTER INSERT ON public.checkins
FOR EACH ROW EXECUTE FUNCTION public.ops_close_engagement_on_checkin();
