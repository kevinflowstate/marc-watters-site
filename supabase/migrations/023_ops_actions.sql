-- Versioned preparation and authenticated human decisions. No provider action runs here.
CREATE TABLE public.ops_artifacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_ref text NOT NULL,
 version integer NOT NULL CHECK(version>0), kind text NOT NULL CHECK(kind IN ('content','lesson')),
 action text NOT NULL CHECK(action IN ('schedule_content','publish_lesson')),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300), payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 destination jsonb NOT NULL CHECK(jsonb_typeof(destination)='object'), item_keys text[] NOT NULL CHECK(cardinality(item_keys) BETWEEN 1 AND 100),
 manifest_hash text NOT NULL CHECK(manifest_hash ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected','superseded','running','completed','needs_attention')),
 submitted_by text NOT NULL, approved_by uuid REFERENCES public.users(id), approved_at timestamptz,
 claim_id uuid, execution_started_at timestamptz, finished_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(external_ref,version), CHECK((kind='content' AND action='schedule_content') OR (kind='lesson' AND action='publish_lesson'))
);
CREATE TABLE public.ops_artifact_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL REFERENCES public.ops_artifacts(id),
 version integer NOT NULL, manifest_hash text NOT NULL, action text NOT NULL, destination jsonb NOT NULL,
 decision text NOT NULL CHECK(decision IN ('approved','rejected')), actor_id uuid NOT NULL REFERENCES public.users(id),
 note text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_artifact_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL REFERENCES public.ops_artifacts(id), item_key text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','succeeded','failed','unknown')),
 receipt jsonb CHECK(receipt IS NULL OR jsonb_typeof(receipt)='object'), error text,
 started_at timestamptz, finished_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(artifact_id,item_key)
);
CREATE TABLE public.ops_artifact_reconciliations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL REFERENCES public.ops_artifacts(id), item_key text NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.users(id), previous_status text NOT NULL, resolution text NOT NULL,
 receipt jsonb, note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_artifact_imports (
 artifact_id uuid PRIMARY KEY REFERENCES public.ops_artifacts(id), provider text NOT NULL CHECK(provider='google_drive'),
 manifest_hash text NOT NULL CHECK(manifest_hash ~ '^[a-f0-9]{64}$'),
 file_id text NOT NULL CHECK(length(file_id) BETWEEN 1 AND 200), version text NOT NULL CHECK(length(version) BETWEEN 1 AND 200),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), actor_id uuid NOT NULL REFERENCES public.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(artifact_id,provider,file_id,version,sha256)
);
CREATE INDEX ops_artifacts_current ON public.ops_artifacts(external_ref,version DESC);
CREATE INDEX ops_artifact_items_state ON public.ops_artifact_items(artifact_id,status);
ALTER TABLE public.ops_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_artifact_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_artifact_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_artifact_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_artifact_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_artifacts,public.ops_artifact_decisions,public.ops_artifact_items,public.ops_artifact_reconciliations,public.ops_artifact_imports FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ops_artifacts,public.ops_artifact_decisions,public.ops_artifact_items,public.ops_artifact_reconciliations,public.ops_artifact_imports TO service_role;

CREATE FUNCTION public.ops_artifact_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF ROW(NEW.id,NEW.external_ref,NEW.version,NEW.kind,NEW.action,NEW.title,NEW.payload,NEW.destination,NEW.item_keys,NEW.manifest_hash,NEW.submitted_by,NEW.created_at)
 IS DISTINCT FROM ROW(OLD.id,OLD.external_ref,OLD.version,OLD.kind,OLD.action,OLD.title,OLD.payload,OLD.destination,OLD.item_keys,OLD.manifest_hash,OLD.submitted_by,OLD.created_at)
 THEN RAISE EXCEPTION 'Artifact content is immutable; submit a new version'; END IF;
 NEW.updated_at=clock_timestamp(); RETURN NEW;
END $$;
CREATE TRIGGER ops_artifact_immutable BEFORE UPDATE ON public.ops_artifacts FOR EACH ROW EXECUTE FUNCTION public.ops_artifact_immutable();

CREATE FUNCTION public.ops_submit_artifact(p_document jsonb,p_actor text,p_expected_version integer DEFAULT NULL,p_expected_hash text DEFAULT NULL)
 RETURNS public.ops_artifacts LANGUAGE plpgsql SET search_path=public AS $$
DECLARE previous ops_artifacts; result ops_artifacts; keys text[];
BEGIN
 IF jsonb_typeof(p_document)<>'object' OR length(p_document->>'external_ref') NOT BETWEEN 1 AND 300 OR length(p_actor) NOT BETWEEN 1 AND 200
 THEN RAISE EXCEPTION 'Invalid artifact submission'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_document->>'external_ref',88231));
 SELECT * INTO previous FROM ops_artifacts WHERE external_ref=p_document->>'external_ref' ORDER BY version DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF previous.manifest_hash=p_document->>'manifest_hash' THEN RETURN previous; END IF;
  IF p_expected_version IS NULL OR previous.version<>p_expected_version OR previous.manifest_hash IS DISTINCT FROM p_expected_hash
  THEN RAISE EXCEPTION 'Artifact changed; read current version before revising'; END IF;
  IF previous.execution_started_at IS NOT NULL THEN RAISE EXCEPTION 'Execution already started; reconcile before preparing another action'; END IF;
  UPDATE ops_artifacts SET status='superseded',approved_by=NULL,approved_at=NULL WHERE id=previous.id;
 ELSE
  IF p_expected_version IS NOT NULL OR p_expected_hash IS NOT NULL THEN RAISE EXCEPTION 'Artifact no longer exists'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_document->'item_keys') k WHERE jsonb_typeof(k)<>'string') THEN RAISE EXCEPTION 'Invalid item keys'; END IF;
 SELECT array_agg(value ORDER BY ordinal) INTO keys FROM jsonb_array_elements_text(p_document->'item_keys') WITH ORDINALITY k(value,ordinal);
 IF cardinality(keys) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(keys) k WHERE length(k) NOT BETWEEN 1 AND 200) OR cardinality(keys)<>(SELECT count(DISTINCT k) FROM unnest(keys) k)
 THEN RAISE EXCEPTION 'Provide unique item keys'; END IF;
 INSERT INTO ops_artifacts(external_ref,version,kind,action,title,payload,destination,item_keys,manifest_hash,submitted_by)
 VALUES(p_document->>'external_ref',coalesce(previous.version,0)+1,p_document->>'kind',p_document->>'action',p_document->>'title',p_document->'payload',p_document->'destination',keys,p_document->>'manifest_hash',p_actor)
 RETURNING * INTO result;
 INSERT INTO ops_artifact_items(artifact_id,item_key) SELECT result.id,k FROM unnest(keys) k;
 RETURN result;
END $$;

CREATE FUNCTION public.ops_decide_artifact(p_id uuid,p_version integer,p_hash text,p_decision text,p_actor uuid,p_note text DEFAULT NULL)
 RETURNS public.ops_artifacts LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a ops_artifacts;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Authenticated admin required'; END IF;
 IF p_decision NOT IN ('approved','rejected') OR (p_decision='rejected' AND coalesce(length(trim(p_note)),0)=0) OR length(p_note)>20000 THEN RAISE EXCEPTION 'Invalid decision/note'; END IF;
 SELECT * INTO a FROM ops_artifacts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Artifact not found' USING ERRCODE='P0002'; END IF;
 IF a.version<>p_version OR a.manifest_hash IS DISTINCT FROM p_hash OR EXISTS(SELECT 1 FROM ops_artifacts WHERE external_ref=a.external_ref AND version>a.version)
 THEN RAISE EXCEPTION 'Artifact changed; review the latest version'; END IF;
 IF a.status=p_decision THEN RETURN a; END IF;
 IF a.status<>'draft' THEN RAISE EXCEPTION 'Artifact is not awaiting a decision'; END IF;
 INSERT INTO ops_artifact_decisions(artifact_id,version,manifest_hash,action,destination,decision,actor_id,note)
 VALUES(a.id,a.version,a.manifest_hash,a.action,a.destination,p_decision,p_actor,p_note);
 UPDATE ops_artifacts SET status=p_decision,approved_by=CASE WHEN p_decision='approved' THEN p_actor ELSE NULL END,approved_at=CASE WHEN p_decision='approved' THEN now() ELSE NULL END WHERE id=a.id RETURNING * INTO a;
 RETURN a;
END $$;

CREATE FUNCTION public.ops_claim_artifact(p_id uuid,p_version integer,p_hash text,p_actor uuid)
 RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a ops_artifacts; reused boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Authenticated admin required'; END IF;
 SELECT * INTO a FROM ops_artifacts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Artifact not found' USING ERRCODE='P0002'; END IF;
 IF a.version<>p_version OR a.manifest_hash IS DISTINCT FROM p_hash OR EXISTS(SELECT 1 FROM ops_artifacts WHERE external_ref=a.external_ref AND version>a.version)
 THEN RAISE EXCEPTION 'Artifact changed; review the latest version'; END IF;
 IF a.approved_by IS NULL OR NOT EXISTS(SELECT 1 FROM ops_artifact_decisions d WHERE d.artifact_id=a.id AND d.version=a.version AND d.manifest_hash=a.manifest_hash AND d.action=a.action AND d.destination=a.destination AND d.decision='approved' AND d.actor_id=a.approved_by)
 THEN RAISE EXCEPTION 'Exact-version approval required'; END IF;
 IF a.status NOT IN ('approved','running','completed') THEN RAISE EXCEPTION 'Action needs reconciliation before execution'; END IF;
 reused=a.status IN ('running','completed');
 IF a.status='approved' THEN
  UPDATE ops_artifacts SET status='running',claim_id=gen_random_uuid(),execution_started_at=coalesce(execution_started_at,now()),finished_at=NULL WHERE id=a.id RETURNING * INTO a;
 END IF;
 RETURN jsonb_build_object('artifact',to_jsonb(a),'claim_id',a.claim_id,'reused',reused);
END $$;

CREATE FUNCTION public.ops_claim_artifact_item(p_id uuid,p_claim uuid,p_item text) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a ops_artifacts; i ops_artifact_items; claimed boolean;
BEGIN
 SELECT * INTO a FROM ops_artifacts WHERE id=p_id FOR UPDATE;
 IF a.id IS NULL OR a.claim_id IS DISTINCT FROM p_claim OR a.status<>'running' THEN RAISE EXCEPTION 'Execution claim is not active'; END IF;
 SELECT * INTO i FROM ops_artifact_items WHERE artifact_id=p_id AND item_key=p_item FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Action item not found' USING ERRCODE='P0002'; END IF;
 claimed=i.status='pending';
 IF claimed THEN UPDATE ops_artifact_items SET status='running',started_at=now(),updated_at=clock_timestamp() WHERE id=i.id RETURNING * INTO i; END IF;
 RETURN jsonb_build_object('item',to_jsonb(i),'claimed',claimed);
END $$;

CREATE FUNCTION public.ops_record_artifact_item(p_id uuid,p_claim uuid,p_item text,p_status text,p_receipt jsonb DEFAULT NULL,p_error text DEFAULT NULL)
 RETURNS public.ops_artifact_items LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a ops_artifacts; i ops_artifact_items;
BEGIN
 SELECT * INTO a FROM ops_artifacts WHERE id=p_id FOR UPDATE;
 IF a.id IS NULL OR a.claim_id IS DISTINCT FROM p_claim OR a.status NOT IN ('running','completed') THEN RAISE EXCEPTION 'Execution claim is not active'; END IF;
 IF p_status NOT IN ('succeeded','failed','unknown') OR length(p_error)>20000 THEN RAISE EXCEPTION 'Invalid execution outcome'; END IF;
 IF p_status='succeeded' AND (p_receipt IS NULL OR jsonb_typeof(p_receipt)<>'object' OR p_receipt='{}'::jsonb) THEN RAISE EXCEPTION 'Successful action requires receipt'; END IF;
 SELECT * INTO i FROM ops_artifact_items WHERE artifact_id=p_id AND item_key=p_item FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Action item not found' USING ERRCODE='P0002'; END IF;
 IF i.status=p_status AND i.receipt IS NOT DISTINCT FROM p_receipt AND i.error IS NOT DISTINCT FROM p_error THEN RETURN i; END IF;
 IF i.status<>'running' OR a.status<>'running' THEN RAISE EXCEPTION 'Outcome already recorded; reconcile instead of retrying'; END IF;
 UPDATE ops_artifact_items SET status=p_status,receipt=p_receipt,error=p_error,finished_at=now(),updated_at=clock_timestamp() WHERE id=i.id RETURNING * INTO i;
 RETURN i;
END $$;

CREATE FUNCTION public.ops_finish_artifact(p_id uuid,p_claim uuid) RETURNS public.ops_artifacts LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a ops_artifacts;
BEGIN
 SELECT * INTO a FROM ops_artifacts WHERE id=p_id FOR UPDATE;
 IF a.id IS NULL OR a.claim_id IS DISTINCT FROM p_claim OR a.status NOT IN ('running','completed','needs_attention') THEN RAISE EXCEPTION 'Execution claim is not active'; END IF;
 IF a.status IN ('completed','needs_attention') THEN RETURN a; END IF;
 -- Another click may hold a different item. Do not close its active claim early.
 IF EXISTS(SELECT 1 FROM ops_artifact_items WHERE artifact_id=p_id AND status='running') THEN RETURN a; END IF;
 UPDATE ops_artifacts SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM ops_artifact_items WHERE artifact_id=p_id AND status<>'succeeded') THEN 'completed' ELSE 'needs_attention' END,finished_at=now() WHERE id=p_id RETURNING * INTO a;
 RETURN a;
END $$;

CREATE FUNCTION public.ops_reconcile_artifact_item(p_id uuid,p_item text,p_expected_updated_at timestamptz,p_resolution text,p_receipt jsonb,p_note text,p_actor uuid,p_executor_stopped boolean DEFAULT false)
 RETURNS public.ops_artifacts LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a ops_artifacts; i ops_artifact_items;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Authenticated admin required'; END IF;
 IF coalesce(length(trim(p_note)),0)=0 OR length(p_note)>20000 OR p_resolution NOT IN ('succeeded','retryable_failure') THEN RAISE EXCEPTION 'Reconciliation evidence required'; END IF;
 SELECT * INTO a FROM ops_artifacts WHERE id=p_id FOR UPDATE;
 IF a.id IS NULL OR a.status NOT IN ('running','needs_attention') THEN RAISE EXCEPTION 'Artifact is not awaiting reconciliation'; END IF;
 SELECT * INTO i FROM ops_artifact_items WHERE artifact_id=p_id AND item_key=p_item FOR UPDATE;
 IF i.id IS NULL OR i.updated_at IS DISTINCT FROM p_expected_updated_at OR i.status NOT IN ('pending','running','failed','unknown') THEN RAISE EXCEPTION 'Item changed; reload before reconciling'; END IF;
 IF i.status='running' AND p_executor_stopped IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm the previous executor has stopped before reconciling a running item'; END IF;
 IF EXISTS(SELECT 1 FROM ops_artifact_items WHERE artifact_id=p_id AND item_key<>p_item AND status='running') THEN RAISE EXCEPTION 'Other items are still running; stop/reconcile that executor first'; END IF;
 IF p_resolution='succeeded' AND (p_receipt IS NULL OR jsonb_typeof(p_receipt)<>'object' OR p_receipt='{}'::jsonb) THEN RAISE EXCEPTION 'Verified provider receipt required'; END IF;
 INSERT INTO ops_artifact_reconciliations(artifact_id,item_key,actor_id,previous_status,resolution,receipt,note) VALUES(p_id,p_item,p_actor,i.status,p_resolution,p_receipt,p_note);
 UPDATE ops_artifact_items SET status=CASE WHEN p_resolution='succeeded' THEN 'succeeded' ELSE 'pending' END,receipt=CASE WHEN p_resolution='succeeded' THEN p_receipt ELSE NULL END,error=NULL,started_at=CASE WHEN p_resolution='succeeded' THEN started_at ELSE NULL END,finished_at=CASE WHEN p_resolution='succeeded' THEN now() ELSE NULL END,updated_at=clock_timestamp() WHERE id=i.id;
 UPDATE ops_artifacts SET status=CASE
  WHEN NOT EXISTS(SELECT 1 FROM ops_artifact_items WHERE artifact_id=p_id AND status<>'succeeded') THEN 'completed'
  WHEN EXISTS(SELECT 1 FROM ops_artifact_items WHERE artifact_id=p_id AND status IN ('running','failed','unknown')) THEN 'needs_attention'
  ELSE 'approved' END,
  claim_id=NULL,finished_at=NULL WHERE id=p_id RETURNING * INTO a;
 RETURN a;
END $$;

CREATE FUNCTION public.ops_record_artifact_import(p_artifact uuid,p_source jsonb,p_actor uuid)
 RETURNS public.ops_artifact_imports LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a ops_artifacts; existing ops_artifact_imports;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Authenticated admin required'; END IF;
 SELECT * INTO a FROM ops_artifacts WHERE id=p_artifact FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Artifact not found' USING ERRCODE='P0002'; END IF;
 IF a.kind<>'content' OR p_source->>'provider' IS DISTINCT FROM 'google_drive' THEN RAISE EXCEPTION 'Verified Drive content import required'; END IF;
 SELECT * INTO existing FROM ops_artifact_imports WHERE artifact_id=p_artifact FOR UPDATE;
 IF FOUND THEN
  IF existing.manifest_hash=a.manifest_hash AND existing.provider=p_source->>'provider' AND existing.file_id=p_source->>'file_id' AND existing.version=p_source->>'version' AND existing.sha256=p_source->>'sha256' THEN RETURN existing; END IF;
  RAISE EXCEPTION 'A different import receipt is already attached';
 END IF;
 IF a.status<>'draft' THEN RAISE EXCEPTION 'Attach verified provenance before approval'; END IF;
 INSERT INTO ops_artifact_imports(artifact_id,manifest_hash,provider,file_id,version,sha256,actor_id) VALUES(p_artifact,a.manifest_hash,p_source->>'provider',p_source->>'file_id',p_source->>'version',p_source->>'sha256',p_actor) RETURNING * INTO existing;
 RETURN existing;
END $$;

REVOKE ALL ON FUNCTION public.ops_artifact_immutable() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_submit_artifact(jsonb,text,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_decide_artifact(uuid,integer,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_claim_artifact(uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_claim_artifact_item(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_record_artifact_item(uuid,uuid,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_finish_artifact(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_reconcile_artifact_item(uuid,text,timestamptz,text,jsonb,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_record_artifact_import(uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_submit_artifact(jsonb,text,integer,text),public.ops_decide_artifact(uuid,integer,text,text,uuid,text),public.ops_claim_artifact(uuid,integer,text,uuid),public.ops_claim_artifact_item(uuid,uuid,text),public.ops_record_artifact_item(uuid,uuid,text,text,jsonb,text),public.ops_finish_artifact(uuid,uuid),public.ops_reconcile_artifact_item(uuid,text,timestamptz,text,jsonb,text,uuid,boolean),public.ops_record_artifact_import(uuid,jsonb,uuid) TO service_role;
