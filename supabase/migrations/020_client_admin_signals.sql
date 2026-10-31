ALTER TABLE public.client_profiles
 ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'current' CHECK(payment_status IN ('current','failed','chasing','paused','cancelled')),
 ADD COLUMN IF NOT EXISTS payment_status_updated_at timestamptz,
 ADD COLUMN IF NOT EXISTS payment_chase_count smallint NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
 ADD COLUMN IF NOT EXISTS onboarding_stage text NOT NULL DEFAULT 'none' CHECK(onboarding_stage IN ('none','invited','form_received','paid','welcomed','community_added','pack_sent','complete')),
 ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz,
 ADD COLUMN IF NOT EXISTS onboarding_due_at timestamptz,
 ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
 ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
 ADD COLUMN IF NOT EXISTS next_action text,
 ADD COLUMN IF NOT EXISTS next_action_due timestamptz;
CREATE TABLE public.client_payment_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,external_id text UNIQUE NOT NULL,event_type text NOT NULL,amount_pence integer,currency text,occurred_at timestamptz NOT NULL,raw jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.client_payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_events_admin ON public.client_payment_events FOR SELECT USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
CREATE OR REPLACE FUNCTION public.ops_payment_event(p_event jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c client_profiles; e uuid; occurred timestamptz=(p_event->>'occurred_at')::timestamptz; kind text=p_event->>'event_type'; t ops_tasks; matches integer; chases integer; last_paid timestamptz; stale boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_event->>'external_id',1));
 IF EXISTS(SELECT 1 FROM client_payment_events WHERE external_id=p_event->>'external_id') THEN RETURN '{"duplicate":true}'::jsonb; END IF;
 SELECT count(*) INTO matches FROM client_profiles p JOIN users u ON u.id=p.user_id WHERE lower(u.email)=lower(p_event->>'contact_email');
 IF matches=1 THEN SELECT p.* INTO c FROM client_profiles p JOIN users u ON u.id=p.user_id WHERE lower(u.email)=lower(p_event->>'contact_email') FOR UPDATE OF p; END IF;
 INSERT INTO client_payment_events(client_id,external_id,event_type,amount_pence,currency,occurred_at,raw) VALUES(c.id,p_event->>'external_id',kind,(p_event->>'amount_pence')::integer,p_event->>'currency',occurred,p_event) RETURNING id INTO e;
 IF c.id IS NULL THEN
  PERFORM ops_mutate_task('create',jsonb_build_object('kind','flag','area','payments','title','payments: match incoming payment event','external_ref','payment-unmatched:'||(p_event->>'external_id'),'payload',p_event),'payment-webhook');
  RETURN jsonb_build_object('unmatched',true,'event_id',e);
 END IF;
 SELECT max(occurred_at) INTO last_paid FROM client_payment_events WHERE client_id=c.id AND event_type='payment_succeeded';
 SELECT least(count(*),32767) INTO chases FROM client_payment_events WHERE client_id=c.id AND event_type='chase_sent' AND occurred_at>coalesce(last_paid,'-infinity'::timestamptz);
 stale=c.payment_status_updated_at IS NOT NULL AND occurred<c.payment_status_updated_at;
 IF stale THEN
  UPDATE client_profiles SET payment_chase_count=chases,last_payment_at=greatest(last_payment_at,last_paid) WHERE id=c.id RETURNING * INTO c;
 ELSE
  UPDATE client_profiles SET payment_status=CASE kind WHEN 'payment_failed' THEN 'failed' WHEN 'payment_succeeded' THEN 'current' WHEN 'chase_sent' THEN 'chasing' WHEN 'subscription_cancelled' THEN 'cancelled' WHEN 'payment_paused' THEN 'paused' END,payment_status_updated_at=occurred,payment_chase_count=chases,last_payment_at=greatest(last_paid,last_payment_at) WHERE id=c.id RETURNING * INTO c;
 END IF;
 IF kind='chase_sent' AND occurred>coalesce(last_paid,'-infinity'::timestamptz) AND c.payment_chase_count>=2 AND c.payment_status<>'current' THEN
  PERFORM ops_mutate_task('create',jsonb_build_object('kind','task','area','payments','title','payments: resolve '||coalesce(c.business_name,'client'),'client_id',c.id,'external_ref','payment-chase:'||c.id||':'||(p_event->>'external_id')),'payment-webhook');
 END IF;
 IF kind='payment_succeeded' AND NOT stale THEN
  FOR t IN SELECT * FROM ops_tasks WHERE client_id=c.id AND area='payments' AND status IN ('open','in_progress','awaiting_approval') LOOP
   PERFORM ops_mutate_task('complete','{"status":"done","decision_note":"Payment received; follow-up closed automatically."}', 'payment-webhook',t.id);
  END LOOP;
 END IF;
 RETURN jsonb_build_object('duplicate',false,'stale',stale,'client_id',c.id,'payment_status',c.payment_status,'chase_count',c.payment_chase_count);
END $$;
REVOKE ALL ON FUNCTION public.ops_payment_event(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_payment_event(jsonb) TO service_role;

-- Compare and save onboarding in one transaction; concurrent completion cannot regress.
CREATE OR REPLACE FUNCTION public.ops_update_client_signals(p_client uuid,p_data jsonb,p_actor text) RETURNS public.client_profiles LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c client_profiles; u client_profiles; t ops_tasks; stages text[]=ARRAY['none','invited','form_received','paid','welcomed','community_added','pack_sent','complete']; idx integer;
BEGIN
 SELECT * INTO c FROM client_profiles WHERE id=p_client FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client not found'; END IF;
 u=jsonb_populate_record(c,p_data);
 IF array_position(stages,u.onboarding_stage)<array_position(stages,c.onboarding_stage) THEN RAISE EXCEPTION 'Onboarding cannot move backwards'; END IF;
 UPDATE client_profiles SET onboarding_stage=u.onboarding_stage,onboarding_completed_at=CASE WHEN u.onboarding_stage='complete' THEN coalesce(c.onboarding_completed_at,now()) ELSE c.onboarding_completed_at END,payment_status=u.payment_status,payment_status_updated_at=u.payment_status_updated_at,next_action=u.next_action,next_action_due=u.next_action_due WHERE id=c.id RETURNING * INTO c;
 idx=array_position(stages,c.onboarding_stage);
 FOR t IN SELECT * FROM ops_tasks WHERE client_id=c.id AND area='onboarding' AND status NOT IN ('done','cancelled') LOOP
  IF (t.external_ref='onboarding:'||c.id||':community_added' AND idx>=6) OR (t.external_ref='onboarding:'||c.id||':pack_sent' AND idx>=7) THEN
   PERFORM ops_mutate_task('complete',jsonb_build_object('status','done','decision_note','Onboarding advanced to '||c.onboarding_stage),p_actor,t.id);
  END IF;
 END LOOP;
 INSERT INTO ops_events(actor,action,data) VALUES(p_actor,'client_signals_updated',jsonb_build_object('client_id',c.id,'updates',p_data));
 RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.ops_update_client_signals(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_update_client_signals(uuid,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.ops_start_onboarding(p_client uuid) RETURNS public.client_profiles LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c client_profiles; t ops_tasks; step text; idx integer; stages text[]=ARRAY['none','invited','form_received','paid','welcomed','community_added','pack_sent','complete'];
BEGIN
 SELECT * INTO c FROM client_profiles WHERE id=p_client FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client not found'; END IF;
 IF c.onboarding_stage='none' THEN UPDATE client_profiles SET onboarding_stage='invited',onboarding_started_at=now(),onboarding_due_at=now()+interval '48 hours' WHERE id=c.id RETURNING * INTO c; END IF;
 idx=array_position(stages,c.onboarding_stage);
 FOREACH step IN ARRAY ARRAY['community_added','pack_sent'] LOOP
  t=ops_mutate_task('create',jsonb_build_object('kind','task','area','onboarding','title','onboarding: '||CASE WHEN step='community_added' THEN 'Admit to community' ELSE 'Send welcome pack' END,'client_id',c.id,'external_ref','onboarding:'||c.id||':'||step,'due_at',coalesce(c.onboarding_due_at,now()+interval '48 hours')),'onboarding');
  IF idx>=array_position(stages,step) AND t.status<>'done' THEN PERFORM ops_mutate_task('complete',jsonb_build_object('status','done','decision_note','Step already confirmed'), 'onboarding',t.id); END IF;
 END LOOP;
 RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.ops_start_onboarding(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_start_onboarding(uuid) TO service_role;
