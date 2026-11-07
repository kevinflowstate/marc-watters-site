-- Internal onboarding retries must never overwrite a human's task edits.
-- Shared advisory-lock namespace matches ops_mutate_task's external_ref lock.
CREATE OR REPLACE FUNCTION public.ops_create_onboarding_task(p_data jsonb)
RETURNS public.ops_tasks LANGUAGE plpgsql SET search_path=public AS $$
DECLARE t public.ops_tasks; ref text; client_text text; field text;
BEGIN
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'Onboarding task object required';
 END IF;
 FOR field IN SELECT jsonb_object_keys(p_data) LOOP
  IF NOT field=ANY(ARRAY['kind','area','assignee','source','title','detail','external_ref','client_id','payload','due_at']) THEN
   RAISE EXCEPTION 'Unsupported onboarding task field';
  END IF;
 END LOOP;
 IF p_data->>'kind' IS DISTINCT FROM 'task' OR p_data->>'area' IS DISTINCT FROM 'onboarding'
  OR p_data->>'assignee' IS DISTINCT FROM 'eimear' OR p_data->>'source' IS DISTINCT FROM 'system'
  OR nullif(btrim(p_data->>'title'),'') IS NULL THEN
  RAISE EXCEPTION 'Invalid onboarding task';
 END IF;
 ref=p_data->>'external_ref'; client_text=p_data->>'client_id';
 IF client_text IS NULL THEN
  IF ref IS NULL OR ref !~ '^onboarding-intake:[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Invalid intake reference';
  END IF;
 ELSE
  -- Cast validates UUID before comparing the stable reference.
  client_text=(client_text::uuid)::text;
  IF ref IS NULL OR ref NOT IN ('onboarding:'||client_text||':admission',
    'onboarding:'||client_text||':community_added','onboarding:'||client_text||':pack_sent') THEN
   RAISE EXCEPTION 'Onboarding reference does not match client';
  END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(ref,0));
 SELECT * INTO t FROM public.ops_tasks WHERE external_ref=ref FOR UPDATE;
 IF FOUND THEN
  IF t.kind<>'task' OR t.area<>'onboarding' OR t.client_id IS DISTINCT FROM client_text::uuid THEN
   RAISE EXCEPTION 'Onboarding reference belongs to different work';
  END IF;
  RETURN t;
 END IF;
 SELECT * INTO t FROM public.ops_mutate_task('create',p_data||jsonb_build_object('status','open'),'onboarding');
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.ops_create_onboarding_task(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_create_onboarding_task(jsonb) TO service_role;
