-- Execute only against the authorised non-live project, after migration 024.
-- Everything, including task/audit writes, is rolled back.
BEGIN;
DO $$
DECLARE a jsonb;b jsonb;r jsonb;c public.ops_payment_cases;attempt uuid;actor uuid;t0 timestamptz=now();t1 timestamptz=now()+interval '1 second';
BEGIN
 SELECT id INTO actor FROM public.users WHERE role='admin' LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Non-live synthetic admin fixture is required'; END IF;
 a=public.ops_record_payment_snapshot(jsonb_build_object('stripe_account_id','acct_fixtureA','invoice_id','in_fixtureSame','stripe_customer_id','cus_fixtureA','state','unpaid','amount_minor',10000,'currency','GBP','customer_name','Demo payment A','contact_email','payment-a@example.invalid','hosted_invoice_url','https://invoice.stripe.com/i/fixtureA','source_verified_at',t0),'fixture:acctA:failed','invoice.payment_failed',t0-interval '2 days');
 b=public.ops_record_payment_snapshot(jsonb_build_object('stripe_account_id','acct_fixtureB','invoice_id','in_fixtureSame','stripe_customer_id','cus_fixtureB','state','unpaid','amount_minor',20000,'currency','GBP','customer_name','Demo payment B','contact_email','payment-b@example.invalid','hosted_invoice_url','https://invoice.stripe.com/i/fixtureB','source_verified_at',t0),'fixture:acctB:failed','invoice.payment_failed',t0-interval '2 days');
 IF a->'case'->>'id'=b->'case'->>'id' THEN RAISE EXCEPTION 'Merchant identities were collapsed'; END IF;
 r=public.ops_record_payment_snapshot(a->'case','fixture:acctA:failed','invoice.payment_failed',t0);
 IF NOT (r->>'duplicate')::boolean THEN RAISE EXCEPTION 'Duplicate event was reapplied'; END IF;
 r=public.ops_record_payment_snapshot((a->'case')||jsonb_build_object('state','paid','amount_minor',0,'source_verified_at',t1),'fixture:acctA:paid','invoice.paid',t1);
 IF NOT EXISTS(SELECT 1 FROM public.ops_tasks WHERE id=(a->'case'->>'task_id')::uuid AND status='done') THEN RAISE EXCEPTION 'Paid invoice task was not closed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_tasks WHERE id=(b->'case'->>'task_id')::uuid AND status='open') THEN RAISE EXCEPTION 'Another merchant invoice task was closed'; END IF;
 PERFORM public.ops_record_payment_snapshot((a->'case')||jsonb_build_object('state','unpaid','source_verified_at',t0),'fixture:acctA:late-failure','invoice.payment_failed',t0-interval '1 day');
 IF NOT EXISTS(SELECT 1 FROM public.ops_payment_cases WHERE id=(a->'case'->>'id')::uuid AND state='paid') THEN RAISE EXCEPTION 'Old failure reopened a paid invoice'; END IF;
 c=public.ops_bind_payment_contact((b->'case'->>'id')::uuid,'contactFixture0001',true,'Synthetic opt-in test evidence',actor);
 r=public.ops_reserve_payment_reminder(c.id,c.updated_at,'first','synthetic-template','synthetic-approved-rules','93GJEdsr0cT9el3OINXq',repeat('a',64));
 IF NOT (r->>'authorised_send')::boolean THEN RAISE EXCEPTION 'First eligible claim was not reserved'; END IF;
 attempt=(r->'attempt'->>'id')::uuid;
 r=public.ops_reserve_payment_reminder(c.id,c.updated_at,'first','synthetic-template','synthetic-approved-rules','93GJEdsr0cT9el3OINXq',repeat('a',64));
 IF (r->>'authorised_send')::boolean THEN RAISE EXCEPTION 'Duplicate claim authorised another send'; END IF;
 r=public.ops_record_payment_ghl_event(jsonb_build_object('stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,'location_id','93GJEdsr0cT9el3OINXq','contact_id',c.contact_id,'external_id','fixture:workflow-reported','event_type','reminder_delivered','occurred_at',t0,'attempt_id',attempt,'receipt_verified',false));
 IF r->'case'->>'latest_delivery'<>'unknown' OR (r->'case'->>'reminder_count')::integer<>0 THEN RAISE EXCEPTION 'Workflow status fabricated delivered receipt'; END IF;
 r=public.ops_record_payment_ghl_event(jsonb_build_object('stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,'location_id','93GJEdsr0cT9el3OINXq','contact_id',c.contact_id,'external_id','fixture:verified-sent','event_type','reminder_sent','occurred_at',t0,'attempt_id',attempt,'provider_message_id','fixture-message','receipt_verified',true,'delivery_state','sent','verified_sent_at',t0));
 IF r->'case'->>'latest_delivery'<>'sent' OR (r->'case'->>'reminder_count')::integer<>1 THEN RAISE EXCEPTION 'Verified sent receipt was lost'; END IF;
 r=public.ops_record_payment_ghl_event(jsonb_build_object('stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,'location_id','93GJEdsr0cT9el3OINXq','contact_id',c.contact_id,'external_id','fixture:dnd','event_type','contact_dnd','occurred_at',t0));
 IF NOT (r->'case'->>'contact_dnd')::boolean THEN RAISE EXCEPTION 'DND was not retained'; END IF;
 IF has_function_privilege('authenticated','public.ops_reserve_payment_reminder(uuid,timestamptz,text,text,text,text,text)','execute') OR has_table_privilege('authenticated','public.ops_payment_cases','UPDATE') THEN RAISE EXCEPTION 'Client mutation privileges leaked'; END IF;
 RAISE NOTICE 'PASS: merchant/invoice independence, duplicates, paid settlement, late events, one-use claim, workflow versus verified receipt and DND';
END $$;
ROLLBACK;
