-- Run only on the authorised isolated database after migration028. Everything rolls back.
BEGIN;
DO $$
DECLARE c public.ops_payment_cases;other public.ops_payment_cases;actor uuid;r jsonb;a uuid;second_attempt uuid;
 t0 timestamptz=now();blocked boolean;event jsonb;recovery jsonb;clock_case public.ops_payment_cases;clock_attempt uuid;
BEGIN
 IF extract(isodow FROM now() AT TIME ZONE 'Europe/London')>5 THEN
  RAISE EXCEPTION 'Dispatch acceptance needs a working weekday; do not loosen the production weekday guard';
 END IF;
 SELECT id INTO actor FROM public.users WHERE role='admin' LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Nonlive admin fixture required'; END IF;
 r=public.ops_record_payment_snapshot(jsonb_build_object('stripe_account_id','acct_deliveryFixture','invoice_id','in_deliveryFixture','state','unpaid','amount_minor',10000,'currency','GBP','customer_name','Synthetic delivery fixture','source_verified_at',t0),'delivery-fixture:failed','invoice.payment_failed',t0-interval '10 days');
 c=public.ops_bind_payment_contact((r->'case'->>'id')::uuid,'contactDeliveryFixture',true,'Synthetic permission evidence',actor);
 r=public.ops_reserve_payment_delivery(c.id,c.updated_at,'first','synthetic-template','synthetic-rules','93GJEdsr0cT9el3OINXq',repeat('a',64),'workflow-delivery-fixture',repeat('b',64));
 IF NOT (r->>'authorised_send')::boolean OR r->'attempt' ? 'context_token_hash' THEN RAISE EXCEPTION 'Context reservation failed or exposed its stored hash'; END IF;
 a=(r->'attempt'->>'id')::uuid;
 r=public.ops_reserve_payment_delivery(c.id,c.updated_at,'first','synthetic-template','synthetic-rules','93GJEdsr0cT9el3OINXq',repeat('a',64),'workflow-delivery-fixture',repeat('c',64));
 IF (r->>'authorised_send')::boolean THEN RAISE EXCEPTION 'Duplicate enrollment received another reservation'; END IF;
 -- A retried first webhook would generate a different server run ID. The invoice
 -- step is still unique, and no replacement token/hash is disclosed.
 r=public.ops_reserve_payment_delivery(c.id,c.updated_at,'first','synthetic-template','synthetic-rules','93GJEdsr0cT9el3OINXq',repeat('a',64),'workflow-lost-response-fixture',repeat('d',64));
 IF (r->>'authorised_send')::boolean OR r->'attempt' ? 'context_token_hash' THEN RAISE EXCEPTION 'Lost-response retry obtained another context'; END IF;
 blocked=false;
 BEGIN UPDATE public.ops_payment_attempts SET template_id='different-template' WHERE id=a;
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%identity cannot be changed%' THEN blocked=true; ELSE RAISE; END IF; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Reserved identity changed'; END IF;
 blocked=false;
 BEGIN PERFORM public.ops_claim_payment_dispatch(a,repeat('c',64),'workflow-delivery-fixture',c.updated_at,0,24);
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%context does not match%' THEN blocked=true; ELSE RAISE; END IF; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Wrong context was accepted'; END IF;
 -- Recheck paid/reply and several-invoice states at the final atomic gate.
 UPDATE public.ops_payment_cases SET state='paid' WHERE id=c.id RETURNING * INTO c;
 r=public.ops_claim_payment_dispatch(a,repeat('b',64),'workflow-delivery-fixture',c.updated_at,0,24);
 IF (r->>'authorised_send')::boolean THEN RAISE EXCEPTION 'Paid invoice was permitted'; END IF;
 UPDATE public.ops_payment_cases SET state='unpaid',reply_needs_human=true WHERE id=c.id RETURNING * INTO c;
 r=public.ops_claim_payment_dispatch(a,repeat('b',64),'workflow-delivery-fixture',c.updated_at,0,24);
 IF (r->>'authorised_send')::boolean THEN RAISE EXCEPTION 'Replied client was permitted'; END IF;
 UPDATE public.ops_payment_cases SET reply_needs_human=false WHERE id=c.id RETURNING * INTO c;
 r=public.ops_record_payment_snapshot(jsonb_build_object('stripe_account_id','acct_deliveryOther','invoice_id','in_deliveryOther','state','unpaid','amount_minor',10000,'currency','GBP','source_verified_at',t0),'delivery-fixture:other','invoice.payment_failed',t0-interval '10 days');
 other=public.ops_bind_payment_contact((r->'case'->>'id')::uuid,c.contact_id,true,'Synthetic permission evidence',actor);
 r=public.ops_claim_payment_dispatch(a,repeat('b',64),'workflow-delivery-fixture',c.updated_at,0,24);
 IF (r->>'authorised_send')::boolean THEN RAISE EXCEPTION 'Several outstanding invoices were permitted'; END IF;
 r=public.ops_reserve_payment_delivery(other.id,other.updated_at,'first','synthetic-template','synthetic-rules','93GJEdsr0cT9el3OINXq',repeat('a',64),'workflow-delivery-fixture',repeat('d',64));
 IF (r->>'authorised_send')::boolean OR EXISTS(SELECT 1 FROM public.ops_payment_attempts WHERE case_id=other.id) THEN RAISE EXCEPTION 'One enrollment reserved another invoice'; END IF;
 UPDATE public.ops_payment_cases SET state='paid' WHERE id=other.id;
 INSERT INTO public.ops_payment_attempts(case_id,step_key,rules_revision,template_id,expected_body_hash,contact_id,location_id,state,workflow_run_id,context_token_hash,created_at,expires_at)
 VALUES(other.id,'first','synthetic-rules','synthetic-template',repeat('a',64),other.contact_id,'93GJEdsr0cT9el3OINXq','reserved','workflow-expired-fixture',repeat('e',64),t0-interval '5 minutes',t0-interval '3 minutes') RETURNING id INTO second_attempt;
 r=public.ops_claim_payment_dispatch(second_attempt,repeat('e',64),'workflow-expired-fixture',other.updated_at,0,24);
 IF (r->>'authorised_send')::boolean OR r->>'reason' NOT LIKE '%no longer available%' THEN RAISE EXCEPTION 'Expired permission was reusable'; END IF;
 r=public.ops_claim_payment_dispatch(a,repeat('b',64),'workflow-delivery-fixture',c.updated_at,0,24);
 IF NOT (r->>'authorised_send')::boolean THEN RAISE EXCEPTION 'Eligible final dispatch did not receive its one grant: %',r; END IF;
 r=public.ops_claim_payment_dispatch(a,repeat('b',64),'workflow-delivery-fixture',c.updated_at,0,24);
 IF (r->>'authorised_send')::boolean THEN RAISE EXCEPTION 'Dispatch retry received another grant'; END IF;
 blocked=false;
 BEGIN UPDATE public.ops_payment_attempts SET dispatch_claimed_at=NULL WHERE id=a;
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%cannot be reset%' THEN blocked=true; ELSE RAISE; END IF; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Dispatch claim could be reset'; END IF;
 recovery=jsonb_build_object('stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,'location_id','93GJEdsr0cT9el3OINXq','contact_id',c.contact_id,'external_id','delivery-fixture:recover-same-event','event_type','reminder_sent','occurred_at',t0,'attempt_id',a,'reported_provider_message_id','delivery-fixture-message','receipt_verified',false,'delivery_state',NULL,'error','Synthetic transient provider read failure');
 r=public.ops_record_payment_ghl_event(recovery);
 IF coalesce((r->'receipt'->>'verified')::boolean,false) OR (r->'case'->>'reminder_count')::integer<>0 THEN RAISE EXCEPTION 'Unknown receipt was represented as verified'; END IF;
 recovery=recovery||jsonb_build_object('provider_message_id','delivery-fixture-message','receipt_verified',true,'delivery_state','sent','verified_sent_at',t0,'verified_message_at',t0,'error',NULL);
 r=public.ops_record_payment_ghl_event(recovery);
 IF NOT (r->>'duplicate')::boolean OR NOT (r->>'reconciled')::boolean OR NOT (r->'receipt'->>'verified')::boolean OR r->'receipt'->>'state'<>'sent' OR (r->'case'->>'reminder_count')::integer<>1 THEN RAISE EXCEPTION 'Identical callback did not commit its recovered provider receipt'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_payment_case_events WHERE external_id='delivery-fixture:recover-same-event' AND data ? 'initial_report') THEN RAISE EXCEPTION 'Recovery lost the original unknown evidence'; END IF;
 r=public.ops_record_payment_ghl_event(recovery);
 IF NOT (r->>'duplicate')::boolean OR (r->>'reconciled')::boolean OR (r->'case'->>'reminder_count')::integer<>1 THEN RAISE EXCEPTION 'Verified replay was not idempotent'; END IF;
 r=public.ops_record_payment_ghl_event(recovery||jsonb_build_object('receipt_verified',false,'delivery_state',NULL,'provider_message_id',NULL,'error','Synthetic late provider failure'));
 IF NOT (r->'receipt'->>'verified')::boolean OR r->'receipt'->>'state'<>'sent' THEN RAISE EXCEPTION 'Unverified replay hid the committed receipt'; END IF;
 blocked=false;
 BEGIN PERFORM public.ops_record_payment_ghl_event(recovery||jsonb_build_object('provider_message_id','different-message','reported_provider_message_id','different-message'));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%Provider message differs%' OR SQLERRM LIKE '%bound to different reminder evidence%' THEN blocked=true; ELSE RAISE; END IF; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Same event accepted a conflicting message'; END IF;
 blocked=false;
 BEGIN PERFORM public.ops_record_payment_ghl_event(recovery||jsonb_build_object('event_type','reminder_delivered'));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%bound to different reminder evidence%' THEN blocked=true; ELSE RAISE; END IF; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Same event accepted a conflicting event type'; END IF;
 event=jsonb_build_object('stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,'location_id','93GJEdsr0cT9el3OINXq','contact_id',c.contact_id,'external_id','delivery-fixture:delivered','event_type','reminder_delivered','occurred_at',t0,'attempt_id',a,'provider_message_id','delivery-fixture-message','receipt_verified',true,'delivery_state','delivered','verified_sent_at',t0);
 r=public.ops_record_payment_ghl_event(event);
 r=public.ops_record_payment_ghl_event(event);
 IF NOT (r->>'duplicate')::boolean THEN RAISE EXCEPTION 'Repeated receipt was not idempotent'; END IF;
 r=public.ops_record_payment_ghl_event(event||jsonb_build_object('external_id','delivery-fixture:late-request','event_type','reminder_requested','receipt_verified',false,'delivery_state',NULL,'error','Unverified late callback'));
 IF NOT EXISTS(SELECT 1 FROM public.ops_payment_attempts WHERE id=a AND state='delivered' AND receipt_verified AND error IS NULL) THEN RAISE EXCEPTION 'Late workflow callback erased verified delivery'; END IF;
 INSERT INTO public.ops_payment_attempts(case_id,step_key,rules_revision,template_id,expected_body_hash,contact_id,location_id,state,created_at,expires_at)
 VALUES(c.id,'second','synthetic-rules','synthetic-template',repeat('a',64),c.contact_id,'93GJEdsr0cT9el3OINXq','unknown',t0+interval '1 second',t0+interval '2 minutes') RETURNING id INTO second_attempt;
 blocked=false;
 BEGIN PERFORM public.ops_record_payment_ghl_event(recovery||jsonb_build_object('attempt_id',second_attempt,'provider_message_id',NULL));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%bound to different reminder evidence%' THEN blocked=true; ELSE RAISE; END IF; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Same event accepted another reminder attempt'; END IF;
 r=public.ops_record_payment_ghl_event(event||jsonb_build_object('attempt_id',second_attempt,'external_id','delivery-fixture:second-failed','event_type','reminder_failed','provider_message_id','delivery-fixture-second','receipt_verified',true,'delivery_state','failed'));
 r=public.ops_record_payment_ghl_event(event||jsonb_build_object('external_id','delivery-fixture:first-late','event_type','reminder_delivered'));
 IF (r->'case'->>'latest_delivery')<>'failed' THEN RAISE EXCEPTION 'Late first receipt replaced the second reminder outcome'; END IF;
 -- Separate context fixture: reservation started two minutes ago, dispatch one
 -- minute ago. An identical provider message created between them is unrelated.
 r=public.ops_record_payment_snapshot(jsonb_build_object('stripe_account_id','acct_deliveryClock','invoice_id','in_deliveryClock','state','unpaid','amount_minor',10000,'currency','GBP','source_verified_at',t0),'delivery-fixture:clock','invoice.payment_failed',t0-interval '10 days');
 clock_case=public.ops_bind_payment_contact((r->'case'->>'id')::uuid,'contactDeliveryClock',true,'Synthetic permission evidence',actor);
 INSERT INTO public.ops_payment_attempts(case_id,step_key,rules_revision,template_id,expected_body_hash,contact_id,location_id,state,workflow_run_id,context_token_hash,created_at,expires_at,dispatch_claimed_at)
 VALUES(clock_case.id,'first','synthetic-rules','synthetic-template',repeat('a',64),clock_case.contact_id,'93GJEdsr0cT9el3OINXq','requested','workflow-clock-fixture',repeat('f',64),t0-interval '2 minutes',t0+interval '1 minute',t0-interval '1 minute') RETURNING id INTO clock_attempt;
 event=jsonb_build_object('stripe_account_id',clock_case.stripe_account_id,'invoice_id',clock_case.invoice_id,'location_id','93GJEdsr0cT9el3OINXq','contact_id',clock_case.contact_id,'external_id','delivery-fixture:clock-bad','event_type','reminder_sent','occurred_at',t0,'attempt_id',clock_attempt,'provider_message_id','delivery-clock-message','receipt_verified',true,'delivery_state','sent','verified_sent_at',t0-interval '90 seconds','verified_message_at',t0-interval '90 seconds');
 blocked=false;
 BEGIN PERFORM public.ops_record_payment_ghl_event(event);
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%after this reminder dispatch%' THEN blocked=true; ELSE RAISE; END IF; END;
 IF NOT blocked THEN RAISE EXCEPTION 'A pre-dispatch provider message counted as this reminder'; END IF;
 r=public.ops_record_payment_ghl_event(event||jsonb_build_object('external_id','delivery-fixture:clock-valid','verified_sent_at',t0-interval '1 minute','verified_message_at',t0-interval '1 minute'));
 IF NOT (r->'receipt'->>'verified')::boolean THEN RAISE EXCEPTION 'Exact dispatch-time receipt was not accepted'; END IF;
 IF has_function_privilege('authenticated','public.ops_claim_payment_dispatch(uuid,text,text,timestamptz,integer,integer)','EXECUTE')
 OR has_function_privilege('anon','public.ops_reserve_payment_delivery(uuid,timestamptz,text,text,text,text,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Workflow functions exposed to browser roles'; END IF;
 RAISE NOTICE 'PASS: immutable context, invoice/run isolation, paid/reply/multiple-invoice stops, one-use dispatch, duplicate/out-of-order receipts and service-only ACLs';
END $$;
ROLLBACK;
SELECT 'PASS: delivery acceptance completed and all synthetic data rolled back' AS result;
