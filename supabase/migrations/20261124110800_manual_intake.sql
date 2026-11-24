create table public.client_manual_intakes (
 email text primary key check (email=lower(btrim(email))), contact_id text not null unique,
 payment_method text not null check(payment_method in ('cash','bank_transfer')),
 actor uuid not null references public.users(id), created_at timestamptz not null default now(),
 state text not null default 'reserved' check(state in ('reserved','started','needs_review'))
);
alter table public.client_manual_intakes enable row level security;
revoke all on public.client_manual_intakes from public,anon,authenticated;
grant select,insert,update on public.client_manual_intakes to service_role;
