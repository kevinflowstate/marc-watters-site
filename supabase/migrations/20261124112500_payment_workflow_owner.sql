-- GHL enrolment is contact-wide. Keep one invoice's ownership until its
-- removal is confirmed, including when a provider request times out.
create table public.ops_payment_workflow_owners (
  contact_id text primary key,
  case_id uuid not null unique references public.ops_payment_cases(id),
  phase text not null check (phase in ('adding','active','removing','uncertain'))
);
alter table public.ops_payment_workflow_owners enable row level security;
revoke all on public.ops_payment_workflow_owners from public, anon, authenticated;
grant select, insert, update, delete on public.ops_payment_workflow_owners to service_role;

-- Existing memberships may have been added outside the portal. They need
-- reconciliation before new enrolment on the same contact.
insert into public.ops_payment_workflow_owners (contact_id,case_id,phase)
select distinct on (contact_id) contact_id,id,'uncertain'
from public.ops_payment_cases
where contact_id is not null and latest_delivery in
  ('enrolling','enrolled','enrol_failed','reminder_1_sent','reminder_2_sent','escalated')
  and not exists (select 1 from public.ops_payment_case_events e
    where e.case_id=ops_payment_cases.id and e.event_type='removed_from_workflow')
order by contact_id,updated_at desc,id;

create function public.ops_apply_invoice_progress(
  p_case uuid,p_contact text,p_type text,p_event_id text,p_occurred timestamptz
) returns text language plpgsql set search_path=public as $$
declare c ops_payment_cases; next_count int; external text;
begin
  if p_type not in ('reminder_1_sent','reminder_2_sent','reminder_failed','escalated','reply_received','dnd') then
    raise exception 'Unknown reminder progress';
  end if;
  select * into c from ops_payment_cases where id=p_case for update;
  if not found or c.contact_id is distinct from p_contact or c.state not in ('unpaid','unknown','paused','uncollectible') then
    return 'closed';
  end if;
  external='progress:' || p_event_id || ':' || c.id;
  insert into ops_payment_case_events(case_id,source,external_id,event_type,occurred_at,data)
  values(c.id,'ghl',external,p_type,p_occurred,jsonb_build_object('contact_id',p_contact,'invoice_id',c.invoice_id,'stripe_account_id',c.stripe_account_id))
  on conflict(source,external_id) do nothing;
  if not found then return 'duplicate'; end if;
  next_count=case p_type when 'reminder_1_sent' then 1 when 'reminder_2_sent' then 2 else 0 end;
  update ops_payment_cases set
    reminder_count=greatest(reminder_count,next_count),
    contact_dnd=contact_dnd or p_type='dnd',
    reply_needs_human=reply_needs_human or p_type='reply_received',
    manual_pause=manual_pause or p_type='reminder_failed',
    latest_delivery=case
      when p_type='reminder_failed' then p_type
      when latest_delivery='reminder_failed' then latest_delivery
      when p_type='escalated' then p_type
      when latest_delivery='escalated' then latest_delivery
      when next_count>0 and next_count>=reminder_count then p_type
      else latest_delivery end
  where id=c.id;
  return 'applied';
end $$;
revoke all on function public.ops_apply_invoice_progress(uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ops_apply_invoice_progress(uuid,text,text,text,timestamptz) to service_role;
