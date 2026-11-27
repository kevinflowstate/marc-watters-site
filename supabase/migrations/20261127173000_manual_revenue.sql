create table public.cbb_manual_sales (
  id uuid primary key,
  paid_on date not null,
  method text not null check (method in ('cash', 'bank_transfer')),
  amount_pence integer not null check (amount_pence > 0),
  reference text not null default '' check (length(reference) <= 160),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index cbb_manual_sales_paid_on_idx on public.cbb_manual_sales (paid_on);
alter table public.cbb_manual_sales enable row level security;
revoke all on public.cbb_manual_sales from public, anon, authenticated, service_role;
grant select, insert on public.cbb_manual_sales to service_role;

create view public.cbb_manual_sales_daily with (security_invoker = true) as
select paid_on, sum(amount_pence) as pence, count(*) as payments
from public.cbb_manual_sales group by paid_on;
revoke all on public.cbb_manual_sales_daily from public, anon, authenticated, service_role;
grant select on public.cbb_manual_sales_daily to service_role;
