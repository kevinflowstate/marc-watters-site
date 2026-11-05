-- Invoice-scoped authority and reminder claims. No schedules or sending are enabled here.
CREATE TABLE public.ops_payment_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stripe_account_id text NOT NULL,invoice_id text NOT NULL,invoice_number text,
 stripe_customer_id text,subscription_id text,contact_email text,customer_name text,contact_id text,
 client_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,
 state text NOT NULL DEFAULT 'unknown' CHECK(state IN ('unpaid','paid','void','uncollectible','paused','cancelled','unknown')),
 amount_minor bigint,currency text,hosted_invoice_url text,first_failed_at timestamptz,source_verified_at timestamptz,
 manual_pause boolean NOT NULL DEFAULT false,reply_needs_human boolean NOT NULL DEFAULT false,contact_dnd boolean NOT NULL DEFAULT false,
 whatsapp_opt_in boolean NOT NULL DEFAULT false,consent_reference text,bound_by uuid REFERENCES public.users(id),bound_at timestamptz,
 latest_delivery text,reminder_count integer NOT NULL DEFAULT 0,task_id uuid REFERENCES public.ops_tasks(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(stripe_account_id,invoice_id)
);
CREATE TABLE public.ops_payment_case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES public.ops_payment_cases(id),
 source text NOT NULL CHECK(source IN ('stripe','ghl')),external_id text NOT NULL,event_type text NOT NULL,
 occurred_at timestamptz NOT NULL,data jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source,external_id)
);
CREATE TABLE public.ops_payment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES public.ops_payment_cases(id),step_key text NOT NULL,
 rules_revision text NOT NULL,template_id text NOT NULL,expected_body_hash text NOT NULL,contact_id text NOT NULL,location_id text NOT NULL,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','requested','sent','delivered','failed','unknown')),
 provider_message_id text,reported_status text,receipt_verified boolean NOT NULL DEFAULT false,error text,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '2 minutes',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(case_id,step_key),UNIQUE(provider_message_id)
);
CREATE TRIGGER ops_payment_cases_updated_at BEFORE UPDATE ON public.ops_payment_cases FOR EACH ROW EXECUTE FUNCTION public.ops_set_updated_at();
CREATE TRIGGER ops_payment_attempts_updated_at BEFORE UPDATE ON public.ops_payment_attempts FOR EACH ROW EXECUTE FUNCTION public.ops_set_updated_at();
ALTER TABLE public.ops_payment_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_payment_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_payment_attempts ENABLE ROW LEVEL SECURITY;
-- Access goes through scoped/server-session routes; no client or direct admin mutations.
REVOKE ALL ON public.ops_payment_cases,public.ops_payment_case_events,public.ops_payment_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ops_payment_cases,public.ops_payment_case_events,public.ops_payment_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.ops_sync_payment_case_task(p_case uuid) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c ops_payment_cases;t ops_tasks; label text; detail text;
BEGIN
 SELECT * INTO c FROM ops_payment_cases WHERE id=p_case FOR UPDATE;
 IF c.state='paid' THEN
  IF c.task_id IS NOT NULL AND EXISTS(SELECT 1 FROM ops_tasks WHERE id=c.task_id AND status NOT IN ('done','cancelled')) THEN
   PERFORM ops_mutate_task('complete',jsonb_build_object('status','done','decision_note','Stripe confirms this invoice is paid; this invoice follow-up is closed.'),'stripe-payment',c.task_id);
  END IF;
  RETURN c.task_id;
 END IF;
 label=coalesce(nullif(c.customer_name,''),nullif(c.contact_email,''),c.invoice_id);
 detail='Invoice '||c.invoice_id||' · '||c.stripe_account_id||E'\nPayment: '||c.state||E'\nWhatsApp: '||coalesce(c.latest_delivery,'not sent')||E'\nVerified reminders: '||c.reminder_count;
 IF c.reply_needs_human OR c.manual_pause OR c.contact_dnd THEN detail=detail||E'\nAutomatic follow-up stopped; Eimear needs to review this case.';
 ELSIF c.contact_id IS NULL OR NOT c.whatsapp_opt_in THEN detail=detail||E'\nVerify the CRM contact and WhatsApp permission before any reminder.'; END IF;
 t=ops_mutate_task('create',jsonb_build_object('kind','flag','area','payments','title','Payment needs checking — '||label,'detail',detail,'assignee','eimear','external_ref','payment-case:'||c.id,'payload',jsonb_build_object('payment_case_id',c.id,'stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,'state',c.state,'latest_delivery',c.latest_delivery),'links',jsonb_build_array(jsonb_build_object('label','Review payment case','url','/admin/automation?payment='||c.id))),'payment-case');
 IF t.status IN ('done','cancelled','rejected') THEN t=ops_mutate_task('update',jsonb_build_object('status','open'),'payment-case',t.id); END IF;
 UPDATE ops_payment_cases SET task_id=t.id WHERE id=c.id;
 RETURN t.id;
END $$;

CREATE OR REPLACE FUNCTION public.ops_record_payment_snapshot(p_snapshot jsonb,p_external text,p_event_type text,p_occurred timestamptz) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c ops_payment_cases; duplicate boolean=false; incoming text=p_snapshot->>'state'; verified timestamptz=(p_snapshot->>'source_verified_at')::timestamptz;
BEGIN
 IF incoming NOT IN ('unpaid','paid','void','uncollectible','paused','cancelled','unknown') OR p_external IS NULL OR length(p_external)>500 THEN RAISE EXCEPTION 'Invalid verified payment snapshot'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended((p_snapshot->>'stripe_account_id')||':'||(p_snapshot->>'invoice_id'),24));
 INSERT INTO ops_payment_cases(stripe_account_id,invoice_id) VALUES(p_snapshot->>'stripe_account_id',p_snapshot->>'invoice_id') ON CONFLICT DO NOTHING;
 SELECT * INTO c FROM ops_payment_cases WHERE stripe_account_id=p_snapshot->>'stripe_account_id' AND invoice_id=p_snapshot->>'invoice_id' FOR UPDATE;
 IF EXISTS(SELECT 1 FROM ops_payment_case_events WHERE source='stripe' AND external_id=p_external) THEN RETURN jsonb_build_object('duplicate',true,'case',to_jsonb(c)); END IF;
 INSERT INTO ops_payment_case_events(case_id,source,external_id,event_type,occurred_at,data) VALUES(c.id,'stripe',p_external,p_event_type,p_occurred,p_snapshot);
 -- Current provider reads may arrive out of order. A paid invoice never reopens via an old failure.
 IF incoming='paid' OR c.source_verified_at IS NULL OR verified>=c.source_verified_at THEN
  UPDATE ops_payment_cases SET invoice_number=p_snapshot->>'invoice_number',stripe_customer_id=p_snapshot->>'stripe_customer_id',subscription_id=p_snapshot->>'subscription_id',contact_email=p_snapshot->>'contact_email',customer_name=p_snapshot->>'customer_name',state=CASE WHEN c.state='paid' THEN 'paid' ELSE incoming END,amount_minor=(p_snapshot->>'amount_minor')::bigint,currency=p_snapshot->>'currency',hosted_invoice_url=p_snapshot->>'hosted_invoice_url',source_verified_at=verified,first_failed_at=CASE WHEN incoming='unpaid' AND p_event_type='invoice.payment_failed' THEN least(coalesce(c.first_failed_at,p_occurred),p_occurred) ELSE c.first_failed_at END WHERE id=c.id;
 END IF;
 PERFORM ops_sync_payment_case_task(c.id);
 SELECT * INTO c FROM ops_payment_cases WHERE id=c.id;
 RETURN jsonb_build_object('duplicate',false,'case',to_jsonb(c));
END $$;

CREATE OR REPLACE FUNCTION public.ops_bind_payment_contact(p_case uuid,p_contact text,p_opt_in boolean,p_consent text,p_actor uuid) RETURNS public.ops_payment_cases LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c ops_payment_cases;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Authenticated admin required'; END IF;
 IF p_contact IS NULL OR length(p_contact)<1 OR p_opt_in AND nullif(trim(p_consent),'') IS NULL THEN RAISE EXCEPTION 'Contact/permission evidence required'; END IF;
 SELECT * INTO c FROM ops_payment_cases WHERE id=p_case FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment case not found'; END IF;
 IF EXISTS(SELECT 1 FROM ops_payment_attempts WHERE case_id=c.id) THEN RAISE EXCEPTION 'Reconcile reminder attempts before changing contact binding'; END IF;
 UPDATE ops_payment_cases SET contact_id=p_contact,whatsapp_opt_in=p_opt_in,consent_reference=p_consent,bound_by=p_actor,bound_at=now() WHERE id=c.id RETURNING * INTO c;
 PERFORM ops_sync_payment_case_task(c.id);
 RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.ops_reserve_payment_reminder(p_case uuid,p_expected timestamptz,p_step text,p_template text,p_rules text,p_location text,p_body_hash text) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c ops_payment_cases;a ops_payment_attempts;
BEGIN
 SELECT * INTO c FROM ops_payment_cases WHERE id=p_case FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment case not found'; END IF;
 SELECT * INTO a FROM ops_payment_attempts WHERE case_id=c.id AND step_key=p_step;
 IF FOUND THEN RETURN jsonb_build_object('authorised_send',false,'reason','Reminder step already reserved; reconcile existing attempt','attempt',to_jsonb(a)); END IF;
 IF c.updated_at<>p_expected OR c.state<>'unpaid' OR c.source_verified_at<now()-interval '2 minutes' OR c.source_verified_at IS NULL OR c.manual_pause OR c.reply_needs_human OR c.contact_dnd OR c.contact_id IS NULL OR NOT c.whatsapp_opt_in OR c.bound_by IS NULL THEN RAISE EXCEPTION 'Payment case changed or reminder is blocked'; END IF;
 IF p_location<>'93GJEdsr0cT9el3OINXq' OR nullif(p_step,'') IS NULL OR nullif(p_template,'') IS NULL OR nullif(p_rules,'') IS NULL OR p_body_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Verified destination and rules required'; END IF;
 IF EXISTS(SELECT 1 FROM ops_payment_attempts WHERE case_id=c.id AND state IN ('reserved','requested','unknown','failed')) THEN RAISE EXCEPTION 'Earlier delivery needs reconciliation'; END IF;
 INSERT INTO ops_payment_attempts(case_id,step_key,rules_revision,template_id,expected_body_hash,contact_id,location_id) VALUES(c.id,p_step,p_rules,p_template,p_body_hash,c.contact_id,p_location) RETURNING * INTO a;
 RETURN jsonb_build_object('authorised_send',true,'attempt',to_jsonb(a));
END $$;

CREATE OR REPLACE FUNCTION public.ops_record_payment_ghl_event(p_event jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c ops_payment_cases;a ops_payment_attempts;kind text=p_event->>'event_type'; s text=p_event->>'delivery_state';other ops_payment_cases;
BEGIN
 IF kind NOT IN ('reminder_requested','reminder_sent','reminder_delivered','reminder_failed','reply_needs_human','contact_dnd','manual_pause') THEN RAISE EXCEPTION 'Unsupported CRM payment event'; END IF;
 SELECT * INTO c FROM ops_payment_cases WHERE stripe_account_id=p_event->>'stripe_account_id' AND invoice_id=p_event->>'invoice_id' FOR UPDATE;
 IF NOT FOUND OR c.contact_id IS DISTINCT FROM p_event->>'contact_id' OR p_event->>'location_id'<>'93GJEdsr0cT9el3OINXq' THEN RAISE EXCEPTION 'Verified case/contact binding required'; END IF;
 IF EXISTS(SELECT 1 FROM ops_payment_case_events WHERE source='ghl' AND external_id=p_event->>'external_id') THEN RETURN jsonb_build_object('duplicate',true,'case',to_jsonb(c)); END IF;
 IF kind LIKE 'reminder_%' THEN
  SELECT * INTO a FROM ops_payment_attempts WHERE id=(p_event->>'attempt_id')::uuid AND case_id=c.id FOR UPDATE;
  IF NOT FOUND OR a.contact_id<>c.contact_id THEN RAISE EXCEPTION 'Matching reserved reminder attempt required'; END IF;
  IF a.provider_message_id IS NOT NULL AND p_event->>'provider_message_id' IS NOT NULL AND a.provider_message_id<>p_event->>'provider_message_id' THEN RAISE EXCEPTION 'Provider message differs; reconcile before retrying'; END IF;
  -- Workflow-reported progress is retained separately and cannot become a delivery receipt.
  UPDATE ops_payment_attempts SET reported_status=kind,state=CASE WHEN a.state='delivered' THEN 'delivered' WHEN coalesce((p_event->>'receipt_verified')::boolean,false) AND s IN ('sent','delivered','failed') THEN s WHEN kind='reminder_requested' AND a.state='reserved' THEN 'requested' ELSE CASE WHEN a.state IN ('sent','delivered') THEN a.state ELSE 'unknown' END END,provider_message_id=coalesce(provider_message_id,p_event->>'provider_message_id'),receipt_verified=receipt_verified OR coalesce((p_event->>'receipt_verified')::boolean,false),error=p_event->>'error' WHERE id=a.id;
  UPDATE ops_payment_cases SET latest_delivery=(SELECT state FROM ops_payment_attempts WHERE id=a.id),reminder_count=(SELECT count(*) FROM ops_payment_attempts WHERE case_id=c.id AND state IN ('sent','delivered') AND receipt_verified) WHERE id=c.id;
 ELSIF kind IN ('reply_needs_human','contact_dnd') THEN
  -- Contact-level stop conditions apply to every bound invoice, including another merchant account.
  FOR other IN SELECT * FROM ops_payment_cases WHERE contact_id=c.contact_id FOR UPDATE LOOP
   UPDATE ops_payment_cases SET reply_needs_human=reply_needs_human OR kind='reply_needs_human',contact_dnd=contact_dnd OR kind='contact_dnd' WHERE id=other.id;
   PERFORM ops_sync_payment_case_task(other.id);
  END LOOP;
 ELSE UPDATE ops_payment_cases SET manual_pause=true WHERE id=c.id;
 END IF;
 INSERT INTO ops_payment_case_events(case_id,source,external_id,event_type,occurred_at,data) VALUES(c.id,'ghl',p_event->>'external_id',kind,(p_event->>'occurred_at')::timestamptz,p_event);
 PERFORM ops_sync_payment_case_task(c.id);
 SELECT * INTO c FROM ops_payment_cases WHERE id=c.id;
 RETURN jsonb_build_object('duplicate',false,'case',to_jsonb(c));
END $$;

REVOKE ALL ON FUNCTION public.ops_sync_payment_case_task(uuid),public.ops_record_payment_snapshot(jsonb,text,text,timestamptz),public.ops_bind_payment_contact(uuid,text,boolean,text,uuid),public.ops_reserve_payment_reminder(uuid,timestamptz,text,text,text,text,text),public.ops_record_payment_ghl_event(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_sync_payment_case_task(uuid),public.ops_record_payment_snapshot(jsonb,text,text,timestamptz),public.ops_bind_payment_contact(uuid,text,boolean,text,uuid),public.ops_reserve_payment_reminder(uuid,timestamptz,text,text,text,text,text),public.ops_record_payment_ghl_event(jsonb) TO service_role;
