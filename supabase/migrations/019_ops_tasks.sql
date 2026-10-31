CREATE TABLE IF NOT EXISTS public.ops_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('task','approval','flag')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','awaiting_approval','approved','rejected','done','cancelled')),
 title text NOT NULL, detail text,
 area text NOT NULL CHECK(area IN ('content','lessons','payments','onboarding','engagement','inbox','finance','events','reporting','other')),
 assignee text NOT NULL DEFAULT 'eimear' CHECK(assignee IN ('marc','eimear','flowstate','system')),
 priority smallint NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 3),
 client_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,
 source text NOT NULL DEFAULT 'system' CHECK(source IN ('system','ai','human')),
 external_ref text UNIQUE, links jsonb NOT NULL DEFAULT '[]', outputs jsonb NOT NULL DEFAULT '[]', payload jsonb NOT NULL DEFAULT '{}',
 due_at timestamptz, decided_by uuid REFERENCES public.users(id), decided_at timestamptz, decision_note text, created_by text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_tasks_status_idx ON public.ops_tasks(status,due_at);
CREATE INDEX IF NOT EXISTS ops_tasks_client_idx ON public.ops_tasks(client_id);
CREATE TABLE IF NOT EXISTS public.ops_events (
 id bigserial PRIMARY KEY, task_id uuid REFERENCES public.ops_tasks(id) ON DELETE CASCADE,
 actor text NOT NULL, action text NOT NULL, data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.ops_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER ops_tasks_updated_at BEFORE UPDATE ON public.ops_tasks FOR EACH ROW EXECUTE FUNCTION public.ops_set_updated_at();
ALTER TABLE public.ops_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ops_tasks_admin ON public.ops_tasks FOR ALL USING (EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')) WITH CHECK(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
CREATE POLICY ops_events_admin ON public.ops_events FOR SELECT USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
-- A task change and its audit event commit together. Service role only; HTTP handlers enforce auth.
CREATE OR REPLACE FUNCTION public.ops_mutate_task(p_action text,p_data jsonb,p_actor text,p_id uuid DEFAULT NULL) RETURNS public.ops_tasks
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE t public.ops_tasks; prior public.ops_tasks; candidate public.ops_tasks; fresh boolean=false; field text; event_data jsonb;
BEGIN
 IF p_action='create' THEN
  IF p_data->>'external_ref' IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(p_data->>'external_ref',0));
   SELECT * INTO t FROM ops_tasks WHERE external_ref=p_data->>'external_ref' FOR UPDATE;
  END IF;
  fresh=t.id IS NULL;
  IF fresh THEN
   INSERT INTO ops_tasks(kind,status,title,detail,area,assignee,priority,client_id,source,external_ref,links,outputs,payload,due_at,created_by)
   VALUES(p_data->>'kind',coalesce(p_data->>'status','open'),p_data->>'title',p_data->>'detail',p_data->>'area',coalesce(p_data->>'assignee','eimear'),coalesce((p_data->>'priority')::smallint,2),(p_data->>'client_id')::uuid,coalesce(p_data->>'source','system'),p_data->>'external_ref',coalesce(p_data->'links','[]'),coalesce(p_data->'outputs','[]'),coalesce(p_data->'payload','{}'),(p_data->>'due_at')::timestamptz,p_actor) RETURNING * INTO t;
  ELSE
   prior=t;
   IF p_data->>'kind' IS DISTINCT FROM t.kind THEN RAISE EXCEPTION 'External reference belongs to a different work kind'; END IF;
   candidate=t;
   FOREACH field IN ARRAY ARRAY['title','detail','links','outputs','payload','due_at'] LOOP
    IF p_data ? field THEN candidate=jsonb_populate_record(candidate,jsonb_build_object(field,p_data->field)); END IF;
   END LOOP;
   IF candidate IS DISTINCT FROM prior THEN
    UPDATE ops_tasks SET title=candidate.title,detail=candidate.detail,payload=candidate.payload,links=candidate.links,outputs=candidate.outputs,due_at=candidate.due_at WHERE id=t.id RETURNING * INTO t;
   END IF;
  END IF;
 ELSE
  SELECT * INTO t FROM ops_tasks WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found' USING ERRCODE='P0002'; END IF;
  prior=t;
  IF p_action='attach_output' THEN p_data=jsonb_build_object('outputs',t.outputs || jsonb_build_array(p_data));
  ELSIF p_action='decide' THEN
   IF t.kind<>'approval' OR t.status NOT IN ('open','in_progress','awaiting_approval') THEN RAISE EXCEPTION 'Approval is already decided or unavailable'; END IF;
   p_data=p_data || jsonb_build_object('decided_at',now());
  END IF;
  t=jsonb_populate_record(t,p_data);
  UPDATE ops_tasks SET kind=t.kind,status=t.status,title=t.title,detail=t.detail,area=t.area,assignee=t.assignee,priority=t.priority,client_id=t.client_id,links=t.links,outputs=t.outputs,payload=t.payload,due_at=t.due_at,decided_by=t.decided_by,decided_at=t.decided_at,decision_note=t.decision_note WHERE id=p_id RETURNING * INTO t;
 END IF;
 -- A revised proposal needs a new decision. Delivery receipts appended by
 -- attach_output do not replace the proposed content; create/update do.
 IF NOT fresh AND t.kind='approval' AND p_action IN ('create','update') AND (
  (t.title,t.detail,t.links,t.outputs,t.payload) IS DISTINCT FROM (prior.title,prior.detail,prior.links,prior.outputs,prior.payload)
  OR (t.status IN ('open','in_progress','awaiting_approval') AND prior.status IN ('approved','rejected','done','cancelled'))
 ) THEN
  UPDATE ops_tasks SET status='awaiting_approval',decided_by=null,decided_at=null,decision_note=null WHERE id=t.id RETURNING * INTO t;
 END IF;
 event_data=p_data;
 IF fresh OR prior.status IS DISTINCT FROM t.status THEN event_data=(p_data-'status')||jsonb_build_object('status',t.status);
 ELSIF p_data ? 'status' THEN event_data=(p_data-'status')||jsonb_build_object('status_unchanged',t.status);
 END IF;
 INSERT INTO ops_events(task_id,actor,action,data) VALUES(t.id,p_actor,p_action,event_data);
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.ops_mutate_task(text,jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_mutate_task(text,jsonb,text,uuid) TO service_role;
