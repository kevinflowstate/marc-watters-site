create table public.client_contract_terms (
 client_id uuid not null references public.client_profiles(id) on delete cascade,
 term_end date not null, decision text not null default 'pending' check(decision in ('pending','renew_term','monthly','superseded')),
 recorded_by uuid references public.users(id), decided_at timestamptz,
 primary key(client_id,term_end)
);
create unique index client_contract_one_pending on public.client_contract_terms(client_id) where decision='pending';
alter table public.client_contract_terms enable row level security;
revoke all on public.client_contract_terms from public,anon,authenticated;
grant select,insert,update,delete on public.client_contract_terms to service_role;

create function public.cbb_due_contract_reviews(p_today date) returns integer language plpgsql set search_path=public as $$
declare term record; total integer:=0;
begin
 for term in select t.client_id,t.term_end,u.full_name from client_contract_terms t join client_profiles p on p.id=t.client_id
   join users u on u.id=p.user_id where t.decision='pending' and t.term_end<=p_today+7 and p.archived_at is null
   and coalesce(p.payment_status,'current') <> 'cancelled' order by t.client_id for update of t loop
   if not exists(select from ops_tasks where external_ref='term-review:'||term.client_id||':'||term.term_end) then
     perform ops_mutate_task('create',jsonb_build_object('kind','task','area','payments','assignee','eimear',
       'source','system','title','Confirm renewal with Marc · '||term.full_name,'client_id',term.client_id,
       'detail','Term ends '||to_char(term.term_end,'DD Mon YYYY')||'. Ask Marc whether the client renews for another term or moves to monthly payments. Record his decision on the client profile before setting up billing.',
       'external_ref','term-review:'||term.client_id||':'||term.term_end,'due_at',((term.term_end-7)+time '09:00') at time zone 'Europe/London'), 'contract-review');
     total:=total+1;
   end if;
 end loop;
 return total;
end $$;

create function public.cbb_set_contract_term(p_client uuid,p_end date,p_previous date,p_decision text,p_actor uuid)
returns void language plpgsql set search_path=public as $$
declare old_end date; old_task uuid;
begin
 perform 1 from client_profiles where id=p_client and archived_at is null for update;
 if not found then raise exception 'Active client required'; end if;
 if p_end is null or p_decision not in ('pending','renew_term','monthly') or p_decision is null then raise exception 'Invalid term'; end if;
 select term_end into old_end from client_contract_terms where client_id=p_client and decision='pending' for update;
 if old_end is distinct from p_previous then raise exception 'Term changed. Refresh before saving.'; end if;
 if p_decision<>'pending' and p_end is distinct from old_end then raise exception 'Save a term end first'; end if;
 if old_end is not null and (old_end<>p_end or p_decision<>'pending') then
   update client_contract_terms set decision=case when old_end<>p_end then 'superseded' else p_decision end,recorded_by=p_actor,decided_at=now()
    where client_id=p_client and term_end=old_end;
   select id into old_task from ops_tasks where external_ref='term-review:'||p_client||':'||old_end and status in ('open','in_progress');
   if old_task is not null then
    perform ops_mutate_task('update',jsonb_build_object('status',case when old_end<>p_end then 'cancelled' else 'done' end,
       'decision_note',case when old_end<>p_end then 'Term date corrected' when p_decision='monthly' then 'Marc confirmed monthly payments' else 'Marc confirmed a new term' end),p_actor::text,old_task);
   end if;
 end if;
 if p_decision='pending' and p_end is distinct from old_end then
   insert into client_contract_terms(client_id,term_end,recorded_by) values(p_client,p_end,p_actor);
 end if;
end $$;
revoke all on function public.cbb_set_contract_term(uuid,date,date,text,uuid),public.cbb_due_contract_reviews(date) from public,anon,authenticated;
grant execute on function public.cbb_set_contract_term(uuid,date,date,text,uuid),public.cbb_due_contract_reviews(date) to service_role;
