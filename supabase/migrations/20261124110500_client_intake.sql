-- Existing clients retain portal access. Only profiles created after this release require intake.
alter table public.client_profiles add column first_login_intake_required boolean not null default false;
alter table public.client_profiles alter column first_login_intake_required set default true;

-- Delivery details are private to the authenticated client submission and the admin workflow.
create table public.client_intake_details (
  client_id uuid primary key references public.client_profiles(id) on delete cascade,
  home_address text not null, business_address text not null,
  questionnaire jsonb not null default '{}',
  completed_at timestamptz not null default now()
);
alter table public.client_intake_details enable row level security;
revoke all on public.client_intake_details from public, anon, authenticated;
grant select,insert,update,delete on public.client_intake_details to service_role;

create function public.cbb_complete_client_intake(p_user uuid, p_fields jsonb)
returns void language plpgsql set search_path = public as $$
declare profile_id uuid; field text;
begin
  select p.id into strict profile_id from client_profiles p join users u on u.id=p.user_id
   where p.user_id=p_user and p.archived_at is null and u.role='client' for update of p;
  foreach field in array array['full_name','phone','business_name','home_address','business_address','goals'] loop
    if nullif(btrim(p_fields->>field),'') is null then raise exception 'Required onboarding field missing'; end if;
  end loop;
  update users set full_name=p_fields->>'full_name' where id=p_user;
  update client_profiles set phone=p_fields->>'phone', business_name=p_fields->>'business_name',
    goals=p_fields->>'goals', business_type=coalesce(nullif(p_fields->>'business_type',''),business_type),
    first_login_intake_required=false where id=profile_id;
  insert into client_intake_details(client_id,home_address,business_address,questionnaire)
  values (profile_id,p_fields->>'home_address',p_fields->>'business_address',
    p_fields - array['home_address','business_address','phone','full_name','goals','business_name'])
  on conflict (client_id) do update set home_address=excluded.home_address,business_address=excluded.business_address,
    questionnaire=excluded.questionnaire;
end $$;
revoke all on function public.cbb_complete_client_intake(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cbb_complete_client_intake(uuid,jsonb) to service_role;
