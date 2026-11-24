-- A scoped, confirmed single send claim. This function has no sending side effects.
create function public.ops_reserve_native_reminder(
  p_case uuid, p_contact text, p_account text, p_invoice text, p_step text,
  p_observed timestamptz, p_expected timestamptz, p_due timestamptz
) returns boolean language plpgsql set search_path=public as $$
declare c ops_payment_cases; first_report timestamptz;
begin
  select * into c from ops_payment_cases where id=p_case for update;
  if not found or not coalesce(
    p_step in ('first','second') and c.stripe_account_id=p_account and c.invoice_id=p_invoice
    and c.contact_id=p_contact and c.updated_at=p_expected and c.state='unpaid'
    and c.whatsapp_opt_in and not(c.manual_pause or c.reply_needs_human or c.contact_dnd)
    and c.first_failed_at is not null and p_due<=now()
    and p_observed between now()-interval '1 minute' and now()+interval '5 seconds'
    and exists(select 1 from ops_payment_workflow_owners
               where case_id=c.id and contact_id=p_contact and phase='active'), false) then return false;
  end if;
  if p_step='first' then
    if c.reminder_count<>0 or c.latest_delivery is distinct from 'enrolled' then return false; end if;
  else
    select min(occurred_at) into first_report from ops_payment_case_events
      where case_id=c.id and source='ghl' and event_type='reminder_1_sent';
    if c.reminder_count<>1 or c.latest_delivery is distinct from 'reminder_1_sent' or
      first_report is null or first_report+interval '48 hours'>now() or not exists(
        select 1 from ops_payment_case_events where source='ghl' and external_id='native-claim:'||c.id||':first'
      ) then return false; end if;
  end if;
  insert into ops_payment_case_events(case_id,source,external_id,event_type,occurred_at,data)
  values(c.id,'ghl','native-claim:'||c.id||':'||p_step,'native_reminder_reserved',now(),
    jsonb_build_object('step',p_step))
  on conflict(source,external_id) do nothing;
  return found;
end $$;
revoke all on function public.ops_reserve_native_reminder(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.ops_reserve_native_reminder(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz) to service_role;
