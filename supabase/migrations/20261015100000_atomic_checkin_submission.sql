-- Atomic persistence and content-checked retries for weekly check-ins.
-- Apply before deploying the API/form update; no historical records are rewritten.
-- Uses the existing checkins.id as a stable submission ID; no new column needed.
-- A retired ID prevents an earlier in-flight request from saving after the form is unlocked.
CREATE TABLE IF NOT EXISTS public.cancelled_checkin_submissions (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cancelled_checkin_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cancelled_checkin_submissions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.cancelled_checkin_submissions TO service_role;

CREATE OR REPLACE FUNCTION public.submit_checkin_atomic(
  p_client_id uuid, p_submission_id uuid, p_mood text, p_responses jsonb, p_cancel boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_archived_at timestamptz;
  v_checkin public.checkins%ROWTYPE;
  v_week integer;
  v_cancelled_client uuid;
BEGIN
  IF p_submission_id IS NULL OR p_client_id IS NULL
    OR p_responses IS NULL OR jsonb_typeof(p_responses) <> 'object'
    OR p_mood IS NULL OR length(trim(p_mood)) = 0 THEN
    RAISE EXCEPTION 'invalid_submission';
  END IF;

  -- Serialise allocation for this client, including concurrent retries.
  SELECT archived_at INTO v_archived_at FROM public.client_profiles
    WHERE id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'client_not_found'; END IF;
  IF v_archived_at IS NOT NULL THEN RAISE EXCEPTION 'client_archived'; END IF;

  SELECT * INTO v_checkin FROM public.checkins WHERE id = p_submission_id;
  IF FOUND THEN
    IF v_checkin.client_id <> p_client_id
      OR v_checkin.responses IS DISTINCT FROM p_responses
      OR v_checkin.mood IS DISTINCT FROM p_mood THEN
      RAISE EXCEPTION 'submission_conflict';
    END IF;
    RETURN jsonb_build_object('id', v_checkin.id, 'week_number', v_checkin.week_number,
      'created_at', v_checkin.created_at, 'replayed', true);
  END IF;

  IF p_cancel THEN
    INSERT INTO public.cancelled_checkin_submissions(id, client_id)
      VALUES(p_submission_id, p_client_id) ON CONFLICT (id) DO NOTHING;
  END IF;
  SELECT client_id INTO v_cancelled_client FROM public.cancelled_checkin_submissions
    WHERE id = p_submission_id;
  IF FOUND THEN
    IF v_cancelled_client <> p_client_id THEN RAISE EXCEPTION 'submission_conflict'; END IF;
    RETURN jsonb_build_object('cancelled', true);
  END IF;

  SELECT COALESCE(MAX(week_number), 0) + 1 INTO v_week
    FROM public.checkins WHERE client_id = p_client_id;
  INSERT INTO public.checkins(id, client_id, week_number, mood, responses, wins, challenges, questions)
    VALUES(p_submission_id, p_client_id, v_week, p_mood, p_responses,
      COALESCE(NULLIF(p_responses->>'what_went_well_detail',''), p_responses->>'wins'),
      COALESCE(NULLIF(p_responses->>'what_didnt_go_well_detail',''), p_responses->>'challenges'),
      COALESCE(NULLIF(p_responses->>'need_anything_from_marc',''), p_responses->>'questions'))
    RETURNING * INTO v_checkin;
  UPDATE public.client_profiles
    SET last_checkin = GREATEST(last_checkin, v_checkin.created_at)
    WHERE id = p_client_id;
  RETURN jsonb_build_object('id', v_checkin.id, 'week_number', v_checkin.week_number,
    'created_at', v_checkin.created_at, 'replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_checkin_atomic(uuid, uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_checkin_atomic(uuid, uuid, text, jsonb, boolean) TO service_role;
