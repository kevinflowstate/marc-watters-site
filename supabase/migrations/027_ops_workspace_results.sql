-- Private result handoff only. No scheduler, outbound action or provider call.
CREATE TABLE public.ops_workspace_results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_key text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('daily_brief','payments','sales_review','content','weekly_report','portal_check')),
 title text NOT NULL, summary text NOT NULL, body text NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('complete','partial','failed')),
 coverage text NOT NULL, links jsonb NOT NULL DEFAULT '[]',
 observed_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 content_hash text NOT NULL, submitted_by text NOT NULL
);
CREATE INDEX ops_workspace_results_kind_time ON public.ops_workspace_results(kind,observed_at DESC,received_at DESC);
ALTER TABLE public.ops_workspace_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_workspace_results FROM anon,authenticated;
GRANT ALL ON public.ops_workspace_results TO service_role;
CREATE OR REPLACE FUNCTION public.ops_submit_workspace_result(p_document jsonb,p_hash text,p_actor text)
RETURNS public.ops_workspace_results LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r ops_workspace_results;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('workspace-result:' || (p_document->>'run_key'),0));
 SELECT * INTO r FROM ops_workspace_results WHERE run_key=p_document->>'run_key';
 IF FOUND THEN
  IF r.content_hash<>p_hash OR r.submitted_by<>p_actor THEN RAISE EXCEPTION 'Run key already used'; END IF;
  RETURN r;
 END IF;
 INSERT INTO ops_workspace_results(run_key,kind,title,summary,body,outcome,coverage,links,observed_at,content_hash,submitted_by)
 VALUES(p_document->>'run_key',p_document->>'kind',p_document->>'title',p_document->>'summary',p_document->>'body',p_document->>'outcome',p_document->>'coverage',p_document->'links',(p_document->>'observed_at')::timestamptz,p_hash,p_actor)
 RETURNING * INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.ops_submit_workspace_result(jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_submit_workspace_result(jsonb,text,text) TO service_role;
