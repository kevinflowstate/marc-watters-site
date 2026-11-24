-- Latest dashboard only. Anonymous and signed-in clients must use the audience-filtered portal API.
create table public.cbb_business_overview_snapshot (
  singleton boolean primary key default true check (singleton),
  snapshot jsonb,
  refreshed_at timestamptz,
  lease_id uuid,
  lease_until timestamptz
);
alter table public.cbb_business_overview_snapshot enable row level security;
revoke all on public.cbb_business_overview_snapshot from public, anon, authenticated;
grant select, insert, update on public.cbb_business_overview_snapshot to service_role;
insert into public.cbb_business_overview_snapshot (singleton) values (true);
