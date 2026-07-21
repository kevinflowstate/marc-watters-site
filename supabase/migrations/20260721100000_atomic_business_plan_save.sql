-- Save a complete business plan as one transaction. Any invalid phase, item, or
-- training link rolls the whole edit back instead of leaving a partial plan.

CREATE OR REPLACE FUNCTION public.save_business_plan_atomic(p_plan JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID := (p_plan->>'id')::UUID;
  v_client_id UUID := (p_plan->>'client_id')::UUID;
  v_existing_client_id UUID;
  v_phase RECORD;
  v_item RECORD;
  v_training RECORD;
  v_phase_id UUID;
  v_requested_phases INTEGER := 0;
  v_requested_items INTEGER := 0;
  v_requested_training_links INTEGER := 0;
  v_saved_phases INTEGER := 0;
  v_saved_items INTEGER := 0;
  v_saved_training_links INTEGER := 0;
BEGIN
  IF NULLIF(BTRIM(p_plan->>'summary'), '') IS NULL THEN
    RAISE EXCEPTION 'Business plan summary is required';
  END IF;

  IF jsonb_typeof(COALESCE(p_plan->'phases', '[]'::JSONB)) <> 'array'
    OR jsonb_array_length(COALESCE(p_plan->'phases', '[]'::JSONB)) = 0 THEN
    RAISE EXCEPTION 'At least one business plan phase is required';
  END IF;

  SELECT client_id
    INTO v_existing_client_id
    FROM public.business_plans
   WHERE id = v_plan_id
   FOR UPDATE;

  IF v_existing_client_id IS NOT NULL AND v_existing_client_id <> v_client_id THEN
    RAISE EXCEPTION 'Business plan client cannot be changed';
  END IF;

  IF v_existing_client_id IS NULL THEN
    INSERT INTO public.business_plans (
      id,
      client_id,
      summary,
      status,
      created_at,
      completed_at,
      discovery_answers,
      pdf_url
    ) VALUES (
      v_plan_id,
      v_client_id,
      p_plan->>'summary',
      CASE WHEN p_plan->>'status' = 'completed' THEN 'completed' ELSE 'active' END,
      COALESCE(NULLIF(p_plan->>'created_at', '')::TIMESTAMPTZ, NOW()),
      NULLIF(p_plan->>'completed_at', '')::TIMESTAMPTZ,
      p_plan->'discovery_answers',
      NULLIF(p_plan->>'pdf_url', '')
    );
  ELSE
    UPDATE public.business_plans
       SET summary = p_plan->>'summary',
           discovery_answers = p_plan->'discovery_answers',
           pdf_url = NULLIF(p_plan->>'pdf_url', '')
     WHERE id = v_plan_id;
  END IF;

  DELETE FROM public.business_plan_phases WHERE plan_id = v_plan_id;

  FOR v_phase IN
    SELECT value, ordinality
      FROM jsonb_array_elements(p_plan->'phases') WITH ORDINALITY
  LOOP
    v_requested_phases := v_requested_phases + 1;
    v_phase_id := (v_phase.value->>'id')::UUID;

    INSERT INTO public.business_plan_phases (
      id,
      plan_id,
      name,
      notes,
      order_index
    ) VALUES (
      v_phase_id,
      v_plan_id,
      COALESCE(NULLIF(BTRIM(v_phase.value->>'name'), ''), 'Untitled phase'),
      COALESCE(v_phase.value->>'notes', ''),
      (v_phase.ordinality - 1)::INTEGER
    );

    FOR v_item IN
      SELECT value, ordinality
        FROM jsonb_array_elements(COALESCE(v_phase.value->'items', '[]'::JSONB)) WITH ORDINALITY
    LOOP
      v_requested_items := v_requested_items + 1;

      INSERT INTO public.business_plan_items (
        id,
        phase_id,
        title,
        completed,
        completed_at,
        order_index
      ) VALUES (
        (v_item.value->>'id')::UUID,
        v_phase_id,
        COALESCE(NULLIF(BTRIM(v_item.value->>'title'), ''), 'Untitled action'),
        COALESCE((v_item.value->>'completed')::BOOLEAN, FALSE),
        NULLIF(v_item.value->>'completed_at', '')::TIMESTAMPTZ,
        (v_item.ordinality - 1)::INTEGER
      );
    END LOOP;

    FOR v_training IN
      SELECT value
        FROM jsonb_array_elements_text(COALESCE(v_phase.value->'linked_trainings', '[]'::JSONB))
    LOOP
      v_requested_training_links := v_requested_training_links + 1;

      INSERT INTO public.phase_training_links (phase_id, content_id)
      VALUES (v_phase_id, v_training.value::UUID);
    END LOOP;
  END LOOP;

  SELECT COUNT(*)
    INTO v_saved_phases
    FROM public.business_plan_phases
   WHERE plan_id = v_plan_id;

  SELECT COUNT(*)
    INTO v_saved_items
    FROM public.business_plan_items item
    JOIN public.business_plan_phases phase ON phase.id = item.phase_id
   WHERE phase.plan_id = v_plan_id;

  SELECT COUNT(*)
    INTO v_saved_training_links
    FROM public.phase_training_links link
    JOIN public.business_plan_phases phase ON phase.id = link.phase_id
   WHERE phase.plan_id = v_plan_id;

  IF v_requested_phases <> v_saved_phases
    OR v_requested_items <> v_saved_items
    OR v_requested_training_links <> v_saved_training_links THEN
    RAISE EXCEPTION 'Business plan verification failed (phases %/%, items %/%, links %/%)',
      v_requested_phases,
      v_saved_phases,
      v_requested_items,
      v_saved_items,
      v_requested_training_links,
      v_saved_training_links;
  END IF;

  RETURN jsonb_build_object(
    'planId', v_plan_id,
    'phaseCount', v_saved_phases,
    'itemCount', v_saved_items,
    'trainingLinkCount', v_saved_training_links
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_business_plan_atomic(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_business_plan_atomic(JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.save_business_plan_atomic(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_business_plan_atomic(JSONB) TO service_role;
