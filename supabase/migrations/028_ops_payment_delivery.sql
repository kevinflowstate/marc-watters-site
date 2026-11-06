-- One immutable workflow context and one native-action grant per reminder.
-- This migration sends nothing and never enables the payment reminder flag.
ALTER TABLE public.ops_payment_attempts
 ADD COLUMN IF NOT EXISTS workflow_run_id text,
 ADD COLUMN IF NOT EXISTS context_token_hash text,
 ADD COLUMN IF NOT EXISTS dispatch_claimed_at timestamptz;
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.ops_payment_attempts'::regclass AND conname='ops_payment_context_pair') THEN
ALTER TABLE public.ops_payment_attempts ADD CONSTRAINT ops_payment_context_pair CHECK (
 (workflow_run_id IS NULL AND context_token_hash IS NULL) OR
 (workflow_run_id IS NOT NULL AND workflow_run_id~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
  AND context_token_hash IS NOT NULL AND context_token_hash~'^[a-f0-9]{64}$')
);
END IF; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS ops_payment_context_token_unique
 ON public.ops_payment_attempts(context_token_hash) WHERE context_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ops_payment_workflow_step_unique
 ON public.ops_payment_attempts(workflow_run_id,step_key) WHERE workflow_run_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ops_keep_payment_attempt_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF (NEW.case_id,NEW.step_key,NEW.rules_revision,NEW.template_id,NEW.expected_body_hash,NEW.contact_id,NEW.location_id,NEW.created_at,NEW.expires_at)
    IS DISTINCT FROM
    (OLD.case_id,OLD.step_key,OLD.rules_revision,OLD.template_id,OLD.expected_body_hash,OLD.contact_id,OLD.location_id,OLD.created_at,OLD.expires_at)
 THEN RAISE EXCEPTION 'A reserved reminder identity cannot be changed'; END IF;
 IF OLD.context_token_hash IS NOT NULL AND
    (NEW.context_token_hash,NEW.workflow_run_id) IS DISTINCT FROM (OLD.context_token_hash,OLD.workflow_run_id)
 THEN RAISE EXCEPTION 'A saved workflow context cannot be replaced'; END IF;
 IF OLD.dispatch_claimed_at IS NOT NULL AND NEW.dispatch_claimed_at IS DISTINCT FROM OLD.dispatch_claimed_at
 THEN RAISE EXCEPTION 'A native sender claim cannot be reset'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER ops_payment_attempt_identity BEFORE UPDATE ON public.ops_payment_attempts
 FOR EACH ROW EXECUTE FUNCTION public.ops_keep_payment_attempt_identity();

CREATE OR REPLACE FUNCTION public.ops_reserve_payment_delivery(
 p_case uuid,p_expected timestamptz,p_step text,p_template text,p_rules text,
 p_location text,p_body_hash text,p_run text,p_context_hash text
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r jsonb;a ops_payment_attempts;
BEGIN
 IF p_run IS NULL OR p_run!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
 OR p_context_hash IS NULL OR p_context_hash!~'^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'A unique workflow run and protected context are required'; END IF;
 -- Prevent one enrollment from claiming the same step on two different invoices.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_run,28));
 IF EXISTS(SELECT 1 FROM ops_payment_attempts WHERE workflow_run_id=p_run AND step_key=p_step)
 THEN RETURN jsonb_build_object('authorised_send',false,'reason','This workflow run already reserved that reminder step'); END IF;
 r=ops_reserve_payment_reminder(p_case,p_expected,p_step,p_template,p_rules,p_location,p_body_hash);
 IF NOT coalesce((r->>'authorised_send')::boolean,false) THEN
  IF r ? 'attempt' THEN r=jsonb_set(r,'{attempt}',(r->'attempt')-'context_token_hash'); END IF;
  RETURN r;
 END IF;
 UPDATE ops_payment_attempts SET workflow_run_id=p_run,context_token_hash=p_context_hash
 WHERE id=(r->'attempt'->>'id')::uuid RETURNING * INTO a;
 RETURN jsonb_build_object('authorised_send',true,'attempt',to_jsonb(a)-'context_token_hash');
END $$;

CREATE OR REPLACE FUNCTION public.ops_claim_payment_dispatch(
 p_attempt uuid,p_context_hash text,p_run text,p_expected timestamptz,
 p_hour_start integer,p_hour_end integer
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a ops_payment_attempts;c ops_payment_cases;case_id uuid;local_hour integer;
BEGIN
 SELECT attempts.case_id INTO case_id FROM ops_payment_attempts attempts WHERE id=p_attempt;
 IF case_id IS NULL THEN RAISE EXCEPTION 'Saved reminder not found'; END IF;
 -- Match lock order used by payment updates and receipt handlers.
 SELECT * INTO c FROM ops_payment_cases WHERE id=case_id FOR UPDATE;
 SELECT * INTO a FROM ops_payment_attempts WHERE id=p_attempt FOR UPDATE;
 IF a.context_token_hash IS DISTINCT FROM p_context_hash OR a.workflow_run_id IS DISTINCT FROM p_run
 OR a.context_token_hash IS NULL OR a.location_id<>'93GJEdsr0cT9el3OINXq'
 THEN RAISE EXCEPTION 'The workflow context does not match'; END IF;
 IF a.dispatch_claimed_at IS NOT NULL THEN
  RETURN jsonb_build_object('authorised_send',false,'reason','This reminder was already handed to the sender; reconcile its outcome');
 END IF;
 IF a.state<>'reserved' OR now()>a.expires_at THEN
  RETURN jsonb_build_object('authorised_send',false,'reason','This reminder is no longer available for an automatic send');
 END IF;
 IF c.updated_at<>p_expected OR c.state<>'unpaid' OR c.source_verified_at IS NULL
 OR c.source_verified_at<now()-interval '2 minutes' OR c.source_verified_at>now()+interval '5 seconds'
 OR c.manual_pause OR c.reply_needs_human OR c.contact_dnd OR NOT c.whatsapp_opt_in
 OR c.bound_by IS NULL OR c.contact_id IS DISTINCT FROM a.contact_id
 THEN RETURN jsonb_build_object('authorised_send',false,'reason','The payment or client follow-up state changed; Eimear needs to review it'); END IF;
 IF (SELECT count(*) FROM ops_payment_cases WHERE contact_id=c.contact_id AND state IN ('unpaid','unknown','paused','uncollectible'))<>1
 THEN RETURN jsonb_build_object('authorised_send',false,'reason','Several unresolved invoices need Eimear to review them'); END IF;
 local_hour=extract(hour FROM now() AT TIME ZONE 'Europe/London');
 IF p_hour_start IS NULL OR p_hour_end IS NULL OR p_hour_start<0 OR p_hour_end>24 OR p_hour_start>=p_hour_end
 OR extract(isodow FROM now() AT TIME ZONE 'Europe/London')>5 OR local_hour<p_hour_start OR local_hour>=p_hour_end
 THEN RETURN jsonb_build_object('authorised_send',false,'reason','Outside the agreed reminder hours'); END IF;
 UPDATE ops_payment_attempts SET dispatch_claimed_at=now(),state='requested',reported_status='native_action_authorised'
 WHERE id=a.id;
 RETURN jsonb_build_object('authorised_send',true,'attempt_id',a.id);
END $$;

-- A late status callback for the first reminder must not replace the latest
-- reminder's outcome, and a stale unverified callback must not erase delivery.
CREATE OR REPLACE FUNCTION public.ops_record_payment_ghl_event(p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c ops_payment_cases;a ops_payment_attempts;kind text=p_event->>'event_type';
 s text=p_event->>'delivery_state';other ops_payment_cases;existing_event ops_payment_case_events;
 duplicate boolean=false;old_message text;new_message text;message_at timestamptz;r_receipt jsonb;
BEGIN
 IF kind NOT IN ('reminder_requested','reminder_sent','reminder_delivered','reminder_failed','reply_needs_human','contact_dnd','manual_pause') THEN RAISE EXCEPTION 'Unsupported CRM payment event'; END IF;
 SELECT * INTO c FROM ops_payment_cases WHERE stripe_account_id=p_event->>'stripe_account_id' AND invoice_id=p_event->>'invoice_id' FOR UPDATE;
 IF NOT FOUND OR c.contact_id IS DISTINCT FROM p_event->>'contact_id' OR p_event->>'location_id'<>'93GJEdsr0cT9el3OINXq' THEN RAISE EXCEPTION 'Verified case/contact binding required'; END IF;
 IF kind LIKE 'reminder_%' THEN
  SELECT * INTO a FROM ops_payment_attempts WHERE id=(p_event->>'attempt_id')::uuid AND case_id=c.id FOR UPDATE;
  IF NOT FOUND OR a.contact_id<>c.contact_id THEN RAISE EXCEPTION 'Matching reserved reminder attempt required'; END IF;
  IF a.provider_message_id IS NOT NULL AND p_event->>'provider_message_id' IS NOT NULL AND a.provider_message_id<>p_event->>'provider_message_id' THEN RAISE EXCEPTION 'Provider message differs; reconcile before retrying'; END IF;
 END IF;
 SELECT * INTO existing_event FROM ops_payment_case_events WHERE source='ghl' AND external_id=p_event->>'external_id' FOR UPDATE;
 IF FOUND THEN
  old_message=coalesce(existing_event.data->>'provider_message_id',existing_event.data->>'reported_provider_message_id');
  new_message=coalesce(p_event->>'provider_message_id',p_event->>'reported_provider_message_id');
  IF existing_event.case_id<>c.id OR existing_event.event_type IS DISTINCT FROM kind
  OR existing_event.occurred_at IS DISTINCT FROM (p_event->>'occurred_at')::timestamptz
  OR existing_event.data->>'attempt_id' IS DISTINCT FROM p_event->>'attempt_id'
  OR existing_event.data->>'contact_id' IS DISTINCT FROM p_event->>'contact_id'
  OR (old_message IS NOT NULL AND old_message IS DISTINCT FROM new_message)
  THEN RAISE EXCEPTION 'The CRM event identifier is already bound to different reminder evidence'; END IF;
  duplicate=true;
  -- The same stable callback can recover after a transient read failure. Only
  -- matching, newly provider-verified evidence may advance an existing event.
  IF NOT (kind LIKE 'reminder_%' AND coalesce((p_event->>'receipt_verified')::boolean,false)
   AND s IN ('sent','delivered','failed') AND
   (NOT coalesce((existing_event.data->>'receipt_verified')::boolean,false)
    OR (existing_event.data->>'delivery_state'='sent' AND s='delivered'))) THEN
   IF kind LIKE 'reminder_%' THEN r_receipt=jsonb_build_object('verified',a.receipt_verified,'state',CASE WHEN a.receipt_verified THEN a.state ELSE NULL END,'sent_at',a.verified_sent_at); END IF;
   RETURN jsonb_build_object('duplicate',true,'reconciled',false,'case',to_jsonb(c),'receipt',r_receipt);
  END IF;
 END IF;
 IF kind LIKE 'reminder_%' THEN
  message_at=coalesce(p_event->>'verified_message_at',p_event->>'verified_sent_at')::timestamptz;
  IF coalesce((p_event->>'receipt_verified')::boolean,false) AND a.context_token_hash IS NOT NULL
   AND (a.dispatch_claimed_at IS NULL OR message_at IS NULL OR message_at<a.dispatch_claimed_at OR message_at>a.expires_at)
  THEN RAISE EXCEPTION 'Provider message must be created after this reminder dispatch'; END IF;
  IF coalesce((p_event->>'receipt_verified')::boolean,false) AND s IN ('sent','delivered')
   AND (p_event->>'verified_sent_at' IS NULL OR (p_event->>'verified_sent_at')::timestamptz<a.created_at-interval '5 seconds' OR (p_event->>'verified_sent_at')::timestamptz>a.expires_at)
  THEN RAISE EXCEPTION 'Provider-verified send timestamp required'; END IF;
  UPDATE ops_payment_attempts SET reported_status=kind,
   state=CASE WHEN a.state='delivered' THEN 'delivered' WHEN coalesce((p_event->>'receipt_verified')::boolean,false) AND s IN ('sent','delivered','failed') THEN s WHEN kind='reminder_requested' AND a.state='reserved' THEN 'requested' ELSE CASE WHEN a.state IN ('sent','delivered') THEN a.state ELSE 'unknown' END END,
   provider_message_id=coalesce(provider_message_id,p_event->>'provider_message_id'),
   verified_sent_at=CASE WHEN coalesce((p_event->>'receipt_verified')::boolean,false) AND s IN ('sent','delivered') THEN coalesce(a.verified_sent_at,(p_event->>'verified_sent_at')::timestamptz) ELSE a.verified_sent_at END,
   receipt_verified=receipt_verified OR coalesce((p_event->>'receipt_verified')::boolean,false),
   error=CASE WHEN a.state IN ('sent','delivered') AND NOT coalesce((p_event->>'receipt_verified')::boolean,false) THEN a.error ELSE p_event->>'error' END
   WHERE id=a.id;
  UPDATE ops_payment_cases SET
   latest_delivery=(SELECT state FROM ops_payment_attempts WHERE case_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1),
   reminder_count=(SELECT count(*) FROM ops_payment_attempts WHERE case_id=c.id AND state IN ('sent','delivered') AND receipt_verified)
   WHERE id=c.id;
  SELECT * INTO a FROM ops_payment_attempts WHERE id=a.id;
  r_receipt=jsonb_build_object('verified',a.receipt_verified,'state',CASE WHEN a.receipt_verified THEN a.state ELSE NULL END,'sent_at',a.verified_sent_at);
 ELSIF kind IN ('reply_needs_human','contact_dnd') THEN
  FOR other IN SELECT * FROM ops_payment_cases WHERE contact_id=c.contact_id FOR UPDATE LOOP
   UPDATE ops_payment_cases SET reply_needs_human=reply_needs_human OR kind='reply_needs_human',contact_dnd=contact_dnd OR kind='contact_dnd' WHERE id=other.id;
   PERFORM ops_sync_payment_case_task(other.id);
  END LOOP;
 ELSE UPDATE ops_payment_cases SET manual_pause=true WHERE id=c.id;
 END IF;
 IF duplicate THEN
  UPDATE ops_payment_case_events SET data=p_event||jsonb_build_object('initial_report',coalesce(existing_event.data->'initial_report',existing_event.data),'verified_readback_at',now()) WHERE id=existing_event.id;
 ELSE
  INSERT INTO ops_payment_case_events(case_id,source,external_id,event_type,occurred_at,data) VALUES(c.id,'ghl',p_event->>'external_id',kind,(p_event->>'occurred_at')::timestamptz,p_event);
 END IF;
 PERFORM ops_sync_payment_case_task(c.id);
 SELECT * INTO c FROM ops_payment_cases WHERE id=c.id;
 RETURN jsonb_build_object('duplicate',duplicate,'reconciled',duplicate,'case',to_jsonb(c),'receipt',r_receipt);
END $$;

REVOKE ALL ON FUNCTION public.ops_keep_payment_attempt_identity(),
 public.ops_reserve_payment_delivery(uuid,timestamptz,text,text,text,text,text,text,text),
 public.ops_claim_payment_dispatch(uuid,text,text,timestamptz,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_keep_payment_attempt_identity(),
 public.ops_reserve_payment_delivery(uuid,timestamptz,text,text,text,text,text,text,text),
 public.ops_claim_payment_dispatch(uuid,text,text,timestamptz,integer,integer)
 TO service_role;
