-- Non-live only, after migrations 024 and 026. All synthetic fixtures roll back.
BEGIN;
DO $$
DECLARE r jsonb;c public.ops_payment_cases;actor uuid;attempt uuid;t0 timestamptz=now(); blocked boolean=false;
BEGIN
 IF public.ops_payment_reminder_due_at('2026-11-06T16:00:00Z',NULL)<>'2026-11-09T09:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Friday failure did not roll to Monday'; END IF;
 IF public.ops_payment_reminder_due_at('2026-03-27T08:00:00Z',NULL)<>'2026-03-30T08:00:00Z'::timestamptz THEN RAISE EXCEPTION 'BST start changed local 09:00'; END IF;
 IF public.ops_payment_reminder_due_at('2026-10-23T16:00:00Z',NULL)<>'2026-10-26T09:00:00Z'::timestamptz THEN RAISE EXCEPTION 'BST end changed local 09:00'; END IF;
 IF public.ops_payment_reminder_due_at('2026-11-01T12:00:00Z','2026-11-05T15:00:00Z')<>'2026-11-09T09:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Three calendar days plus weekend roll was not applied'; END IF;
 IF public.ops_payment_reminder_due_at('2026-03-01T12:00:00Z','2026-03-27T09:00:00Z')<>'2026-03-30T08:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Follow-up used 72 hours rather than London calendar dates'; END IF;
 SELECT id INTO actor FROM public.users WHERE role='admin' LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Non-live synthetic admin fixture required'; END IF;
 r=public.ops_record_payment_snapshot(jsonb_build_object('stripe_account_id','acct_calendarFixture','invoice_id','in_calendarFixture','stripe_customer_id','cus_calendarFixture','state','unpaid','amount_minor',10000,'currency','GBP','customer_name','Demo calendar reminder','source_verified_at',t0),'calendar-fixture:failed','invoice.payment_failed',t0-interval '10 days');
 c=public.ops_bind_payment_contact((r->'case'->>'id')::uuid,'contactCalendarFixture',true,'Synthetic permission evidence',actor);
 UPDATE public.ops_tasks SET assignee='marc' WHERE id=c.task_id;
 -- Synthetic provider fixture: one real-world earlier sent receipt and a second reservation.
 -- Direct fixture insertion avoids pretending that SQL wall clock can advance three days.
 INSERT INTO public.ops_payment_attempts(case_id,step_key,rules_revision,template_id,expected_body_hash,contact_id,location_id,state,provider_message_id,receipt_verified,verified_sent_at,created_at,expires_at)
 VALUES(c.id,'first','synthetic-calendar','synthetic-first',repeat('a',64),c.contact_id,'93GJEdsr0cT9el3OINXq','sent','calendar-fixture-first',true,t0-interval '6 days',t0-interval '6 days',t0-interval '6 days'+interval '2 minutes');
 INSERT INTO public.ops_payment_attempts(case_id,step_key,rules_revision,template_id,expected_body_hash,contact_id,location_id)
 VALUES(c.id,'second','synthetic-calendar','synthetic-second',repeat('a',64),c.contact_id,'93GJEdsr0cT9el3OINXq') RETURNING id INTO attempt;
 r=public.ops_record_payment_ghl_event(jsonb_build_object('stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,'location_id','93GJEdsr0cT9el3OINXq','contact_id',c.contact_id,'external_id','calendar-fixture:second','event_type','reminder_sent','occurred_at',t0,'attempt_id',attempt,'provider_message_id','calendar-fixture-second','receipt_verified',true,'delivery_state','sent','verified_sent_at',t0));
 IF (r->'case'->>'reminder_count')::integer<>2 THEN RAISE EXCEPTION 'Two verified reminders were not counted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_tasks WHERE id=c.task_id AND assignee='eimear' AND status='open' AND detail LIKE '%Both agreed WhatsApp reminders%') THEN RAISE EXCEPTION 'Final human handoff missing'; END IF;
 BEGIN
  PERFORM public.ops_reserve_payment_reminder(c.id,(r->'case'->>'updated_at')::timestamptz,'third','synthetic-third','synthetic-calendar','93GJEdsr0cT9el3OINXq',repeat('a',64));
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%Two agreed reminder attempts maximum%' THEN blocked=true; ELSE RAISE; END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Third reminder was permitted'; END IF;
 IF has_function_privilege('authenticated','public.ops_payment_reminder_due_at(timestamptz,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'New function ACL exposed'; END IF;
 RAISE NOTICE 'PASS: approved calendar dates/DST, two verified sends, Eimear handoff and no third reminder';
END $$;
ROLLBACK;
