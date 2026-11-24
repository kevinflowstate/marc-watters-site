-- Run only in a disposable database with payment migrations installed.
begin;
do $$
declare a uuid=gen_random_uuid(); b uuid=gen_random_uuid(); result text; failed boolean=false;
begin
  insert into ops_payment_cases(id,stripe_account_id,invoice_id,contact_id,state)
  values(a,'acct_FixtureA','in_Fixture','contactFixture01','unpaid'),
        (b,'acct_FixtureB','in_Fixture','contactFixture01','unpaid');
  insert into ops_payment_workflow_owners values('contactFixture01',a,'active');
  begin
    insert into ops_payment_workflow_owners values('contactFixture01',b,'adding');
  exception when unique_violation then failed=true; end;
  if not failed then raise exception 'Second invoice able to claim shared workflow'; end if;
  result=ops_apply_invoice_progress(a,'contactFixture01','reminder_2_sent','second',now());
  if result<>'applied' then raise exception 'First outcome was not recorded'; end if;
  result=ops_apply_invoice_progress(a,'contactFixture01','reminder_2_sent','second',now());
  if result<>'duplicate' then raise exception 'Retry recorded twice'; end if;
  perform ops_apply_invoice_progress(a,'contactFixture01','reminder_1_sent','late-first',now());
  if (select reminder_count<>2 or latest_delivery<>'reminder_2_sent' from ops_payment_cases where id=a)
    or (select reminder_count<>0 from ops_payment_cases where id=b) then
    raise exception 'Incorrect attribution or reminder count'; end if;
  perform ops_apply_invoice_progress(a,'contactFixture01','reminder_failed','failed',now());
  perform ops_apply_invoice_progress(a,'contactFixture01','reminder_1_sent','later-first',now());
  if (select not manual_pause or latest_delivery<>'reminder_failed' from ops_payment_cases where id=a)
    then raise exception 'Late callback cleared failed-send hold'; end if;
  perform ops_apply_invoice_progress(b,'contactFixture01','dnd','dnd1',now());
  if (select not contact_dnd from ops_payment_cases where id=b)
    then raise exception 'Opt-out disappeared'; end if;
  update ops_payment_cases set state='paid' where id=a;
  result=ops_apply_invoice_progress(a,'contactFixture01','escalated','after-paid',now());
  if result<>'closed' or exists(select 1 from ops_payment_case_events where external_id='progress:after-paid:'||a)
    then raise exception 'Closed case was reopened'; end if;
  if has_function_privilege('authenticated','ops_apply_invoice_progress(uuid,text,text,text,timestamptz)','execute')
    or has_table_privilege('anon','ops_payment_workflow_owners','select') then
    raise exception 'CRM server-only controls exposed'; end if;
end $$;
rollback;
