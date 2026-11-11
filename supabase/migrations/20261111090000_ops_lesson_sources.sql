-- One row per Tuesday lesson call: the portal finds the Fathom recording, asks Fathom to prepare
-- the video, and hands the scheduled Codex lesson job short-lived links through the Drive snapshot.
create table if not exists public.ops_lesson_sources (
  lesson_date date primary key,
  status text not null check (status in ('no_recording','requested','ready','packaged','failed')),
  recording_id bigint,
  title text,
  recording_start timestamptz,
  recording_end timestamptz,
  download_id text,
  video_bytes bigint,
  error text,
  task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ops_lesson_sources enable row level security;
revoke all on public.ops_lesson_sources from anon, authenticated;
