-- Kevin-approved calendar rules; adds to the already applied invoice-case migration.
-- No send flag, workflow, template or provider action is enabled by this migration.
ALTER TABLE public.ops_payment_attempts ADD COLUMN IF NOT EXISTS verified_sent_at timestamptz;
CREATE OR REPLACE FUNCTION public.ops_payment_reminder_due_at(p_failed timestamptz,p_first_sent timestamptz DEFAULT NULL) RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE d date;
BEGIN
 IF coalesce(p_first_sent,p_failed) IS NULL THEN RETURN NULL; END IF;
 d=(coalesce(p_first_sent,p_failed) AT TIME ZONE 'Europe/London')::date+CASE WHEN p_first_sent IS NULL THEN 1 ELSE 3 END;
 WHILE extract(isodow FROM d)>5 LOOP d=d+1; END LOOP;
 RETURN (d+time '09:00') AT TIME ZONE 'Europe/London';
END $$;

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
 IF c.reminder_count>=2 THEN detail=detail||E'\nBoth agreed WhatsApp reminders have verified sent/delivered receipts. Eimear needs to follow up personally; automatic reminders have ended.'; END IF;
 IF c.reply_needs_human OR c.manual_pause OR c.contact_dnd THEN detail=detail||E'\nAutomatic follow-up stopped; Eimear needs to review this case.';
 ELSIF c.contact_id IS NULL OR NOT c.whatsapp_opt_in THEN detail=detail||E'\nVerify the CRM contact and WhatsApp permission before any reminder.'; END IF;
 t=ops_mutate_task('create',jsonb_build_object('kind','flag','area','payments','title',CASE WHEN c.reminder_count>=2 THEN 'Eimear: follow up on unpaid payment — ' ELSE 'Payment needs checking — ' END||label,'detail',detail,'assignee','eimear','external_ref','payment-case:'||c.id,'payload',jsonb_build_object('payment_case_id',c.id,'stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,'state',c.state,'latest_delivery',c.latest_delivery),'links',jsonb_build_array(jsonb_build_object('label','Review payment case','url','/admin/automation?payment='||c.id))),'payment-case');
 IF c.reminder_count>=2 AND t.assignee<>'eimear' THEN t=ops_mutate_task('update',jsonb_build_object('assignee','eimear'),'payment-handoff',t.id); END IF;
 IF t.status IN ('done','cancelled','rejected') THEN t=ops_mutate_task('update',jsonb_build_object('status','open'),'payment-case',t.id); END IF;
 UPDATE ops_payment_cases SET task_id=t.id WHERE id=c.id;
 RETURN t.id;
END $$;

CREATE OR REPLACE FUNCTION public.ops_reserve_payment_reminder(p_case uuid,p_expected timestamptz,p_step text,p_template text,p_rules text,p_location text,p_body_hash text) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c ops_payment_cases;a ops_payment_attempts;first_sent timestamptz;due_at timestamptz;
BEGIN
 SELECT * INTO c FROM ops_payment_cases WHERE id=p_case FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment case not found'; END IF;
 SELECT * INTO a FROM ops_payment_attempts WHERE case_id=c.id AND step_key=p_step;
 IF FOUND THEN RETURN jsonb_build_object('authorised_send',false,'reason','Reminder step already reserved; reconcile existing attempt','attempt',to_jsonb(a)); END IF;
 IF c.updated_at<>p_expected OR c.state<>'unpaid' OR c.source_verified_at<now()-interval '2 minutes' OR c.source_verified_at IS NULL OR c.manual_pause OR c.reply_needs_human OR c.contact_dnd OR c.contact_id IS NULL OR NOT c.whatsapp_opt_in OR c.bound_by IS NULL THEN RAISE EXCEPTION 'Payment case changed or reminder is blocked'; END IF;
 IF p_location<>'93GJEdsr0cT9el3OINXq' OR nullif(p_step,'') IS NULL OR nullif(p_template,'') IS NULL OR nullif(p_rules,'') IS NULL OR p_body_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Verified destination and rules required'; END IF;
 IF EXISTS(SELECT 1 FROM ops_payment_attempts WHERE case_id=c.id AND state IN ('reserved','requested','unknown','failed')) THEN RAISE EXCEPTION 'Earlier delivery needs reconciliation'; END IF;
 IF p_step NOT IN ('first','second') OR (SELECT count(*) FROM ops_payment_attempts WHERE case_id=c.id)>=2 THEN RAISE EXCEPTION 'Two agreed reminder attempts maximum; Eimear must handle further follow-up'; END IF;
 IF p_step='second' THEN
  SELECT verified_sent_at INTO first_sent FROM ops_payment_attempts WHERE case_id=c.id AND step_key='first' AND state IN ('sent','delivered') AND receipt_verified=true;
  IF first_sent IS NULL THEN RAISE EXCEPTION 'Verified first-send timestamp required before follow-up'; END IF;
 END IF;
 due_at=ops_payment_reminder_due_at(c.first_failed_at,first_sent);
 IF due_at IS NULL OR now()<due_at OR extract(isodow FROM now() AT TIME ZONE 'Europe/London')>5 THEN RAISE EXCEPTION 'Reminder is not due on an agreed working day'; END IF;
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
  IF coalesce((p_event->>'receipt_verified')::boolean,false) AND s IN ('sent','delivered') AND (p_event->>'verified_sent_at' IS NULL OR (p_event->>'verified_sent_at')::timestamptz<a.created_at-interval '5 seconds' OR (p_event->>'verified_sent_at')::timestamptz>a.expires_at) THEN RAISE EXCEPTION 'Provider-verified send timestamp required'; END IF;
  -- Workflow-reported progress is retained separately and cannot become a delivery receipt.
  UPDATE ops_payment_attempts SET reported_status=kind,state=CASE WHEN a.state='delivered' THEN 'delivered' WHEN coalesce((p_event->>'receipt_verified')::boolean,false) AND s IN ('sent','delivered','failed') THEN s WHEN kind='reminder_requested' AND a.state='reserved' THEN 'requested' ELSE CASE WHEN a.state IN ('sent','delivered') THEN a.state ELSE 'unknown' END END,provider_message_id=coalesce(provider_message_id,p_event->>'provider_message_id'),verified_sent_at=CASE WHEN coalesce((p_event->>'receipt_verified')::boolean,false) AND s IN ('sent','delivered') THEN coalesce(a.verified_sent_at,(p_event->>'verified_sent_at')::timestamptz) ELSE a.verified_sent_at END,receipt_verified=receipt_verified OR coalesce((p_event->>'receipt_verified')::boolean,false),error=p_event->>'error' WHERE id=a.id;
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

REVOKE ALL ON FUNCTION public.ops_payment_reminder_due_at(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_payment_reminder_due_at(timestamptz,timestamptz) TO service_role;
-- Replaced existing service-only functions retain their existing ACLs.
