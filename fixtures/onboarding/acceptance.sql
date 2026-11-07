-- Root only: authorised isolated preview abmmlybdqwzujcysagvf after migration030.
-- No users, accounts, modules, invites, provider requests or client notifications.
BEGIN;
DO $$
DECLARE ref text='onboarding-intake:'||encode(digest(gen_random_uuid()::text,'sha256'),'hex'); proposal jsonb; first_task public.ops_tasks; replay public.ops_tasks; human public.ops_tasks;
BEGIN
 proposal=jsonb_build_object('kind','task','area','onboarding','assignee','eimear','source','system','title','Synthetic onboarding acceptance','detail','Initial machine wording','external_ref',ref,'client_id',null,'payload',jsonb_build_object('admission','needs_human_review','intake_email','fixture@example.invalid'));
 first_task=public.ops_create_onboarding_task(proposal);
 IF first_task.assignee<>'eimear' OR first_task.status<>'open' OR first_task.client_id IS NOT NULL THEN RAISE EXCEPTION 'Pending admission owner or access boundary changed'; END IF;
 replay=public.ops_create_onboarding_task(proposal);
 IF replay.id<>first_task.id OR (SELECT count(*) FROM public.ops_tasks WHERE external_ref=ref)<>1 THEN RAISE EXCEPTION 'Intake created duplicate tasks'; END IF;
 human=public.ops_mutate_task('complete',jsonb_build_object('status','done','detail','Human reviewed the offer','decision_note','Keep this human decision','payload',jsonb_build_object('reviewed_by_person',true)),'synthetic-human',first_task.id);
 replay=public.ops_create_onboarding_task(proposal||jsonb_build_object('title','Changed automated wording'));
 IF replay.id<>human.id OR replay.status<>'done' OR replay.title<>human.title OR replay.detail<>human.detail OR replay.decision_note<>human.decision_note OR replay.payload<>human.payload THEN RAISE EXCEPTION 'Repeated intake overwrote human work'; END IF;
 IF has_function_privilege('anon','public.ops_create_onboarding_task(jsonb)','execute') OR has_function_privilege('authenticated','public.ops_create_onboarding_task(jsonb)','execute') THEN RAISE EXCEPTION 'Client can call service-only onboarding preparation'; END IF;
 RAISE NOTICE 'PASS: one pending Eimear task, no client provisioning, replay keeps human title/detail/payload/decision and service-only ACL';
END $$;
ROLLBACK;
