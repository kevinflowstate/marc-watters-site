CREATE TABLE public.ops_event_boards (
  id uuid PRIMARY KEY, name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 180),
  event_date date NOT NULL, venue text NOT NULL DEFAULT '', agenda text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ops_event_boards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_event_boards FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.ops_event_boards TO service_role;

-- Create the board and its preparation tasks together. A retried request returns
-- the original board without resetting any work the team has already done.
CREATE FUNCTION public.ops_create_event_board(p_board uuid,p_name text,p_date date,p_venue text,p_agenda text,p_actor text)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE step text;
BEGIN
  INSERT INTO public.ops_event_boards(id,name,event_date,venue,agenda)
    VALUES(p_board,p_name,p_date,p_venue,p_agenda) ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND THEN RETURN p_board; END IF;
  FOREACH step IN ARRAY ARRAY['Confirm headcount','Confirm the venue','Arrange the deposit','Agree meal choices','Prepare merchandise','Prepare presentation slides','Print and deliver workbooks']
  LOOP
    PERFORM public.ops_mutate_task('create',jsonb_build_object(
      'kind','task','area','events','assignee','eimear','source','human','title',step,
      'detail',p_name,'payload',jsonb_build_object('event_board_id',p_board)
    ),p_actor);
  END LOOP;
  RETURN p_board;
END $$;

CREATE FUNCTION public.ops_update_event_step(p_board uuid,p_task uuid,p_version timestamptz,p_status text,p_owner text,p_due date,p_note text,p_actor text)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE step public.ops_tasks; event_name text;
BEGIN
  SELECT * INTO STRICT step FROM public.ops_tasks WHERE id=p_task AND area='events'
    AND payload->>'event_board_id'=p_board::text FOR UPDATE;
  SELECT name INTO STRICT event_name FROM public.ops_event_boards WHERE id=p_board;
  IF step.updated_at IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'This task changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
  IF p_status NOT IN ('open','in_progress','awaiting_approval','done') OR p_owner NOT IN ('marc','eimear') THEN RAISE EXCEPTION 'Invalid stage or owner'; END IF;
  IF p_status='awaiting_approval' AND length(trim(coalesce(p_note,'')))=0 THEN RAISE EXCEPTION 'Enter the question for Marc'; END IF;
  PERFORM public.ops_mutate_task(CASE WHEN p_status='done' THEN 'complete' ELSE 'update' END,
    jsonb_build_object('status',p_status,'assignee',CASE WHEN p_status='awaiting_approval' THEN 'marc' ELSE p_owner END,
    'detail',event_name || CASE WHEN length(trim(coalesce(p_note,'')))>0 THEN E'\n'||p_note ELSE '' END,
    'due_at',(p_due+time '12:00') AT TIME ZONE 'Europe/London',
    'payload',step.payload || jsonb_build_object('event_note',p_note)),p_actor,p_task);
  RETURN p_task;
END $$;
REVOKE ALL ON FUNCTION public.ops_create_event_board(uuid,text,date,text,text,text),public.ops_update_event_step(uuid,uuid,timestamptz,text,text,date,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_create_event_board(uuid,text,date,text,text,text),public.ops_update_event_step(uuid,uuid,timestamptz,text,text,date,text,text) TO service_role;

CREATE FUNCTION public.ops_create_event_step(p_board uuid,p_step uuid,p_title text,p_actor text)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE event_name text; ref text := 'event-step:'||p_board||':'||p_step; task_id uuid;
BEGIN
  SELECT name INTO STRICT event_name FROM public.ops_event_boards WHERE id=p_board;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(ref,0));
  SELECT id INTO task_id FROM public.ops_tasks WHERE external_ref=ref;
  IF FOUND THEN RETURN task_id; END IF;
  SELECT id INTO task_id FROM public.ops_mutate_task('create',jsonb_build_object(
    'kind','task','area','events','assignee','eimear','source','human','title',p_title,
    'external_ref',ref,'detail',event_name,'payload',jsonb_build_object('event_board_id',p_board)),p_actor);
  RETURN task_id;
END $$;
REVOKE ALL ON FUNCTION public.ops_create_event_step(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_create_event_step(uuid,uuid,text,text) TO service_role;
