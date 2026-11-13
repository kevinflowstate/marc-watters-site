-- Additive; service role only. No browser role can read or mutate this queue.
create table public.content_videos (
 id uuid primary key default gen_random_uuid(), drive_file_id text not null unique,
 drive_md5 text, file_name text not null, mime_type text not null default 'video/mp4', size_bytes bigint,
 status text not null default 'new' check (status in ('new','importing','ready','failed','scheduled','partly_scheduled','skipped','replaced')),
 failure_reason text, media_url text, media_file_id text, caption text not null default '',
 caption_source text check (caption_source in ('sidecar','manual')), suggested_at timestamptz, schedule_at timestamptz,
 platforms text[] not null default '{instagram,facebook,linkedin}' check (platforms <@ array['instagram','facebook','linkedin']::text[] and cardinality(platforms) > 0),
 approved_by uuid references public.users(id), approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index content_videos_day on public.content_videos (((suggested_at at time zone 'Europe/London')::date)) where status <> 'skipped';
create table public.content_video_posts (
 id uuid primary key default gen_random_uuid(), video_id uuid not null references public.content_videos(id) on delete cascade,
 platform text not null check (platform in ('instagram','facebook','linkedin')), account_id text not null,
 outcome text not null check (outcome in ('claimed','scheduled','failed','uncertain')), provider_post_id text,
 receipt jsonb, reason text, created_at timestamptz not null default now(), unique(video_id, platform)
);
create table public.content_intake_state (
 id boolean primary key default true check(id), lease_until timestamptz, lease_id uuid,
 checked_at timestamptz, warnings jsonb not null default '[]'
);
insert into public.content_intake_state(id) values(true);
alter table public.content_videos enable row level security;
alter table public.content_video_posts enable row level security;
alter table public.content_intake_state enable row level security;
revoke all on public.content_videos, public.content_video_posts, public.content_intake_state from anon, authenticated;
grant all on public.content_videos, public.content_video_posts, public.content_intake_state to service_role;

-- Row lock freezes the complete approval before any remote request. The unique platform
-- claim survives crashes. Only definitive failures can be explicitly retried.
create function public.claim_content_video(p_id uuid, p_revision timestamptz, p_actor uuid, p_accounts jsonb, p_retry text default null)
returns setof public.content_video_posts language plpgsql set search_path = public as $$
declare v public.content_videos; p text; a text;
begin
 select * into v from content_videos where id=p_id for update;
 if not found or v.updated_at <> p_revision then raise exception 'Video changed; refresh before approving'; end if;
 if v.status not in ('ready','partly_scheduled') or v.media_url is null or v.suggested_at is null or trim(v.caption)='' or v.suggested_at < now()+interval '5 minutes' then raise exception 'Video is not ready to schedule'; end if;
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'Admin required'; end if;
 if p_retry is not null and not (p_retry=any(v.platforms)) then raise exception 'Invalid retry'; end if;
 update content_videos set approved_at=coalesce(approved_at,now()), approved_by=coalesce(approved_by,p_actor), schedule_at=coalesce(schedule_at,suggested_at), updated_at=now() where id=p_id;
 foreach p in array v.platforms loop
  if p_retry is not null and p<>p_retry then continue; end if;
  a := p_accounts->>p;
  if a is null or a='' then raise exception 'Account missing'; end if;
  if p_retry is null then
   return query insert into content_video_posts(video_id,platform,account_id,outcome) values(p_id,p,a,'claimed') on conflict(video_id,platform) do nothing returning *;
  else
   return query update content_video_posts set outcome='claimed', reason=null, created_at=now(), account_id=a where video_id=p_id and platform=p and outcome='failed' returning *;
  end if;
 end loop;
end $$;
revoke all on function public.claim_content_video(uuid,timestamptz,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.claim_content_video(uuid,timestamptz,uuid,jsonb,text) to service_role;
