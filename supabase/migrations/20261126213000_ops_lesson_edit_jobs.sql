-- Source recordings stay private. The scheduler supplies editorial text only.
create table public.ops_lesson_edit_jobs (
  lesson_date date primary key references public.ops_lesson_sources(lesson_date),
  recording_id bigint not null,
  plan jsonb not null,
  state text not null default 'queued' check (state in ('queued','running','done','failed')),
  attempts integer not null default 0,
  run_id uuid,
  sandbox_name text,
  expires_at timestamptz,
  receipt jsonb,
  last_error text,
  verify_only boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.ops_lesson_edit_jobs enable row level security;
revoke all on public.ops_lesson_edit_jobs from public, anon, authenticated;
grant select,insert,update on public.ops_lesson_edit_jobs to service_role;
