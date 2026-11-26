-- Keep a distinct machine identity for a technical media check. Publication still
-- requires the existing exact-version human approval and claim.
alter table public.ops_lesson_media_verifications alter column verified_by drop not null,
  add column verified_by_render uuid,
  add constraint lesson_verifier_identity check (num_nonnulls(verified_by, verified_by_render)=1);

create function public.ops_register_rendered_lesson_media(p_object jsonb, p_run uuid) returns jsonb
language plpgsql set search_path=public as $$
declare
  current_object jsonb;
  result ops_lesson_media_verifications;
begin
  if not exists (
    select 1 from ops_lesson_edit_jobs j join ops_lesson_sources s using (lesson_date)
      join ops_tasks t on t.id=s.task_id
    where j.run_id=p_run and j.state='running' and not j.verify_only and s.recording_id=j.recording_id
      and t.payload#>>'{lesson_package,media,storage_path}'=p_object->>'storage_path'
      and t.payload#>>'{lesson_package,media,sha256}'=p_object->>'sha256'
  ) then raise exception 'Active matching lesson render required'; end if;
  perform 1 from storage.objects where bucket_id='lesson-media' and name=p_object->>'storage_path' for share;
  current_object=ops_inspect_lesson_object(p_object->>'storage_path');
  if (p_object - 'sha256' - 'duration_s') <> current_object then raise exception 'Stored media changed during verification'; end if;
  insert into ops_lesson_media_verifications(object_id,storage_path,updated_at,etag,bytes,mime_type,sha256,duration_s,verified_by_render)
  values ((current_object->>'object_id')::uuid,current_object->>'storage_path',(current_object->>'updated_at')::timestamptz,
    current_object->>'etag',(current_object->>'bytes')::bigint,current_object->>'mime_type',p_object->>'sha256',
    (p_object->>'duration_s')::double precision,p_run)
  on conflict(object_id,updated_at,sha256) do nothing returning * into result;
  if result.id is null then
    select * into strict result from ops_lesson_media_verifications where object_id=(current_object->>'object_id')::uuid
      and updated_at=(current_object->>'updated_at')::timestamptz and sha256=p_object->>'sha256';
  end if;
  return to_jsonb(result);
end $$;
revoke all on function public.ops_register_rendered_lesson_media(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ops_register_rendered_lesson_media(jsonb,uuid) to service_role;
