-- Disposable database only. No provider requests, no charges, no sends.
begin;
do $$
declare
  c ops_payment_cases;
  ok boolean;
begin
  insert into ops_payment_cases(stripe_account_id,invoice_id,contact_id,state,first_failed_at,whatsapp_opt_in,latest_delivery)
  values ('acct_Test','in_Test','contactFixture01','unpaid',now()-interval '6 days',true,'enrolled') returning * into c;
  insert into ops_payment_workflow_owners values(c.contact_id,c.id,'active');
  if ops_reserve_native_reminder(c.id,c.contact_id,'acct_Other',c.invoice_id,'first',now(),c.updated_at,now())
    or ops_reserve_native_reminder(c.id,c.contact_id,c.stripe_account_id,c.invoice_id,'first',now()-interval '4 minutes',c.updated_at,now())
    or ops_reserve_native_reminder(c.id,c.contact_id,c.stripe_account_id,c.invoice_id,'second',now(),c.updated_at,now())
    or ops_reserve_native_reminder(c.id,c.contact_id,c.stripe_account_id,c.invoice_id,'first',now(),c.updated_at,now()+interval '2 hours')
  then raise exception 'Unsafe preflight permitted'; end if;
  ok=ops_reserve_native_reminder(c.id,c.contact_id,c.stripe_account_id,c.invoice_id,'first',now(),c.updated_at,now());
  if not ok or ops_reserve_native_reminder(c.id,c.contact_id,c.stripe_account_id,c.invoice_id,'first',now(),c.updated_at,now())
    then raise exception 'First claim was absent or repeated'; end if;
  perform ops_apply_invoice_progress(c.id,c.contact_id,'reminder_1_sent','first',now()-interval '47 hours');
  select * into c from ops_payment_cases where id=c.id;
  if ops_reserve_native_reminder(c.id,c.contact_id,c.stripe_account_id,c.invoice_id,'second',now(),c.updated_at,now())
    then raise exception 'Second send accepted early'; end if;
  update ops_payment_case_events set occurred_at=now()-interval '49 hours' where case_id=c.id and event_type='reminder_1_sent';
  update ops_payment_cases set contact_dnd=true where id=c.id returning * into c;
  if ops_reserve_native_reminder(c.id,c.contact_id,c.stripe_account_id,c.invoice_id,'second',now(),c.updated_at,now())
    then raise exception 'Opt-out was ignored'; end if;
  update ops_payment_cases set contact_dnd=false where id=c.id returning * into c;
  if not ops_reserve_native_reminder(c.id,c.contact_id,c.stripe_account_id,c.invoice_id,'second',now(),c.updated_at,now())
    then raise exception 'Valid second claim rejected'; end if;
  if has_function_privilege('authenticated','ops_reserve_native_reminder(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz)','execute') then raise exception 'Preflight database function is public'; end if;
end $$;
rollback;
