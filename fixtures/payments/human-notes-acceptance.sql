-- Isolated preview only. All synthetic rows and audit entries roll back.
BEGIN;
DO $$
DECLARE r jsonb;c public.ops_payment_cases;t public.ops_tasks;actor uuid;
 checked timestamptz=now();note text=E'Eimear: client will call back.\nKeep this exact wording.';
 decision_time timestamptz=now()-interval '1 hour';
BEGIN
 SELECT id INTO actor FROM public.users WHERE role='admin' LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Preview admin fixture required'; END IF;
 r=public.ops_record_payment_snapshot(jsonb_build_object(
  'stripe_account_id','acct_humanNoteFixture','invoice_id','in_humanNoteFixture',
  'state','unpaid','amount_minor',10000,'currency','GBP',
  'customer_name','Synthetic payment note preservation','source_verified_at',checked),
  'human-note-fixture:failed','invoice.payment_failed',checked-interval '1 day');
 SELECT * INTO c FROM public.ops_payment_cases WHERE id=(r->'case'->>'id')::uuid;
 PERFORM public.ops_mutate_task('complete',jsonb_build_object(
  'status','done','decision_note',note,'decided_by',actor,'decided_at',decision_time),
  'synthetic-eimear-review',c.task_id);
 -- An unpaid refresh reopens the same task; it must retain the person's note.
 PERFORM public.ops_sync_payment_case_task(c.id);
 SELECT * INTO t FROM public.ops_tasks WHERE id=c.task_id;
 IF t.status<>'open' OR t.decision_note IS DISTINCT FROM note THEN
  RAISE EXCEPTION 'Unpaid refresh lost the human note or failed to reopen';
 END IF;
 r=public.ops_record_payment_snapshot(jsonb_build_object(
  'stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,
  'state','paid','amount_minor',0,'currency','GBP',
  'customer_name','Synthetic payment note preservation','source_verified_at',checked+interval '1 second'),
  'human-note-fixture:paid','invoice.paid',checked+interval '1 second');
 SELECT * INTO t FROM public.ops_tasks WHERE id=c.task_id;
 IF t.status<>'done' OR t.decision_note IS DISTINCT FROM note OR
  t.decided_by IS DISTINCT FROM actor OR t.decided_at IS DISTINCT FROM decision_time THEN
  RAISE EXCEPTION 'Automatic paid completion replaced human notes or attribution';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_events e WHERE e.task_id=t.id AND e.actor='stripe-payment'
  AND e.action='complete' AND e.data->>'completion_reason'='Stripe confirms this invoice is paid; this invoice follow-up is closed.'
  AND NOT (e.data ? 'decision_note')) THEN
  RAISE EXCEPTION 'Automatic closure reason is missing from separate audit evidence';
 END IF;
 PERFORM public.ops_sync_payment_case_task(c.id);
 IF (SELECT count(*) FROM public.ops_events e WHERE e.task_id=t.id AND e.actor='stripe-payment' AND e.action='complete')<>1 THEN
  RAISE EXCEPTION 'Repeated paid sync duplicated completion';
 END IF;
 IF has_function_privilege('authenticated','public.ops_sync_payment_case_task(uuid)','EXECUTE') OR
  has_function_privilege('anon','public.ops_sync_payment_case_task(uuid)','EXECUTE') OR
  NOT has_function_privilege('service_role','public.ops_sync_payment_case_task(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Payment task function ACL changed';
 END IF;
END $$;
SELECT 'PASS: unpaid reopen and paid completion preserve exact human notes/attribution; closure reason audited once; service-only ACL retained; fixture rolled back' AS result;
ROLLBACK;
