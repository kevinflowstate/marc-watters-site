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
DECLARE c client_profiles; e uuid; occurred timestamptz=(p_event->>'occurred_at')::timestamptz; kind text=p_event->>'event_type'; t ops_tasks; matches integer;
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
 IF c.payment_status_updated_at IS NOT NULL AND occurred<c.payment_status_updated_at THEN RETURN jsonb_build_object('stale',true,'event_id',e); END IF;
 UPDATE client_profiles SET payment_status=CASE kind WHEN 'payment_failed' THEN 'failed' WHEN 'payment_succeeded' THEN 'current' WHEN 'chase_sent' THEN 'chasing' WHEN 'subscription_cancelled' THEN 'cancelled' WHEN 'payment_paused' THEN 'paused' END,payment_status_updated_at=occurred,payment_chase_count=CASE kind WHEN 'chase_sent' THEN least(payment_chase_count+1,32767) WHEN 'payment_succeeded' THEN 0 ELSE payment_chase_count END,last_payment_at=CASE WHEN kind='payment_succeeded' THEN occurred ELSE last_payment_at END WHERE id=c.id RETURNING * INTO c;
 IF kind='chase_sent' AND c.payment_chase_count>=2 THEN
  PERFORM ops_mutate_task('create',jsonb_build_object('kind','task','area','payments','title','payments: resolve '||coalesce(c.business_name,'client'),'client_id',c.id,'external_ref','payment-chase:'||c.id||':'||(p_event->>'external_id')),'payment-webhook');
 END IF;
 IF kind='payment_succeeded' THEN
  FOR t IN SELECT * FROM ops_tasks WHERE client_id=c.id AND area='payments' AND status IN ('open','in_progress','awaiting_approval') LOOP
   PERFORM ops_mutate_task('complete','{"status":"done","decision_note":"Payment received; follow-up closed automatically."}', 'payment-webhook',t.id);
  END LOOP;
 END IF;
 RETURN jsonb_build_object('duplicate',false,'client_id',c.id,'payment_status',c.payment_status,'chase_count',c.payment_chase_count);
END $$;
REVOKE ALL ON FUNCTION public.ops_payment_event(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_payment_event(jsonb) TO service_role;
