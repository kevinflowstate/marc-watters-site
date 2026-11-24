-- Preserve the original create-once task store. Extend its accepted checklist keys.
-- Internal onboarding retries must never overwrite a human's task edits.
-- Shared advisory-lock namespace matches ops_mutate_task's external_ref lock.
CREATE OR REPLACE FUNCTION public.ops_create_onboarding_task(p_data jsonb)
RETURNS public.ops_tasks LANGUAGE plpgsql SET search_path=public AS $$
DECLARE t public.ops_tasks; ref text; client_text text; field text;
BEGIN
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'Onboarding task object required';
 END IF;
 FOR field IN SELECT jsonb_object_keys(p_data) LOOP
  IF NOT field=ANY(ARRAY['kind','area','assignee','source','title','detail','external_ref','client_id','payload','due_at']) THEN
   RAISE EXCEPTION 'Unsupported onboarding task field';
  END IF;
 END LOOP;
 IF p_data->>'kind' IS DISTINCT FROM 'task' OR p_data->>'area' IS DISTINCT FROM 'onboarding'
  OR p_data->>'assignee' IS DISTINCT FROM 'eimear' OR p_data->>'source' IS DISTINCT FROM 'system'
  OR nullif(btrim(p_data->>'title'),'') IS NULL THEN
  RAISE EXCEPTION 'Invalid onboarding task';
 END IF;
 ref=p_data->>'external_ref'; client_text=p_data->>'client_id';
 IF client_text IS NULL THEN
  IF ref IS NULL OR ref !~ '^onboarding-intake:[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Invalid intake reference';
  END IF;
 ELSE
  -- Cast validates UUID before comparing the stable reference.
  client_text=(client_text::uuid)::text;
  IF ref IS NULL OR ref NOT IN ('onboarding:'||client_text||':admission',
    'onboarding:'||client_text||':community_added','onboarding:'||client_text||':pack_sent',
    'onboarding:'||client_text||':card_checked','onboarding:'||client_text||':address_checked') THEN
   RAISE EXCEPTION 'Onboarding reference does not match client';
  END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(ref,0));
 SELECT * INTO t FROM public.ops_tasks WHERE external_ref=ref FOR UPDATE;
 IF FOUND THEN
  IF t.kind<>'task' OR t.area<>'onboarding' OR t.client_id IS DISTINCT FROM client_text::uuid THEN
   RAISE EXCEPTION 'Onboarding reference belongs to different work';
  END IF;
  RETURN t;
 END IF;
 SELECT * INTO t FROM public.ops_mutate_task('create',p_data||jsonb_build_object('status','open'),'onboarding');
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.ops_create_onboarding_task(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_create_onboarding_task(jsonb) TO service_role;

-- All first-payment, invitation, and CRM paths share the same atomic start.
create or replace function public.ops_start_onboarding(p_client uuid) returns public.client_profiles
language plpgsql set search_path=public as $$
declare c client_profiles; label text; step record; task ops_tasks;
begin
  select * into strict c from client_profiles where id=p_client for update;
  if c.archived_at is not null then raise exception 'Client is archived'; end if;
  if c.onboarding_stage='complete' then return c; end if;
  if c.onboarding_stage='none' then
    update client_profiles set onboarding_stage='invited',onboarding_started_at=now(),onboarding_due_at=now()+interval '48 hours'
     where id=c.id returning * into c;
  end if;
  select coalesce(nullif(u.full_name,''),nullif(c.business_name,''),'New client') into label from users u where u.id=c.user_id;
  for step in select * from (values
    ('community_added','Add to the WhatsApp community','Confirm admission and add the client to the WhatsApp community.'),
    ('card_checked','Check Stripe card on file','Check the correct Stripe customer has a card on file, including cash and bank-transfer clients.'),
    ('address_checked','Verify delivery address','Check the home delivery address on the client profile before ordering a welcome pack.'),
    ('pack_sent','Confirm welcome pack order','After confirming the delivery address, check for an existing order before triggering the supplier once. Record the order reference.'))
    as steps(key,title,detail)
  loop
    task := ops_create_onboarding_task(jsonb_build_object('kind','task','area','onboarding','assignee','eimear','source','system',
      'title',step.title||' · '||coalesce(label,'New client'),'detail',step.detail,'client_id',c.id,
      'external_ref','onboarding:'||c.id||':'||step.key,'due_at',c.onboarding_due_at));
    if task.status='open' and (
        (step.key='community_added' and c.onboarding_stage in ('community_added','pack_sent')) or
        (step.key='pack_sent' and c.onboarding_stage='pack_sent')) then
      perform ops_mutate_task('complete',jsonb_build_object('status','done','decision_note','Step already confirmed'),'onboarding',task.id);
    end if;
  end loop;
  return c;
end $$;
