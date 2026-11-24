-- Other products can share the non-live Supabase installation. Only CBB accounts enter this form.
alter table public.client_profiles alter column first_login_intake_required set default false;

create function public.cbb_mark_first_login_intake() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.first_login_intake_required := exists (
   select from auth.users a where a.id=new.user_id and a.raw_user_meta_data->>'app_name'='marc-watters-portal'
 );
 return new;
end $$;
revoke all on function public.cbb_mark_first_login_intake() from public,anon,authenticated;
create trigger cbb_first_login_intake before insert on public.client_profiles for each row execute function public.cbb_mark_first_login_intake();

update public.client_profiles p set first_login_intake_required=false
 where p.first_login_intake_required and not exists (
 select from auth.users a where a.id=p.user_id and a.raw_user_meta_data->>'app_name'='marc-watters-portal'
 );
