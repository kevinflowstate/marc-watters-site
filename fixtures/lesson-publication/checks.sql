-- Executed only in a temporary local PostgreSQL cluster by check-sql.py.
BEGIN;
CREATE FUNCTION pg_temp.assert_raises(command text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  EXECUTE command;
 EXCEPTION WHEN OTHERS THEN
  IF position(expected IN SQLERRM)>0 THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'Expected rejection: %',expected;
END $$;

DO $$
DECLARE admin_id uuid='11111111-1111-4111-8111-111111111111'; viewer_id uuid='22222222-2222-4222-8222-222222222222';
 module_a uuid=gen_random_uuid(); module_b uuid=gen_random_uuid(); module_c uuid=gen_random_uuid();
 object_id uuid=gen_random_uuid(); verified jsonb; manifest jsonb; a ops_artifacts; run jsonb;
 receipt jsonb; replay jsonb; count_before integer;
BEGIN
 INSERT INTO users(id,role) VALUES(admin_id,'admin'),(viewer_id,'client');
 INSERT INTO training_modules(id,title) VALUES(module_a,'Synthetic draft'),(module_b,'Synthetic publication'),(module_c,'Other private draft');
 INSERT INTO storage.objects(id,bucket_id,name,metadata,updated_at)
 VALUES(object_id,'lesson-media','approved/synthetic-v1.mp4','{"mimetype":"video/mp4","size":__MEDIA_BYTES__,"eTag":"original"}',now());
 verified=ops_register_lesson_media(ops_inspect_lesson_object('approved/synthetic-v1.mp4')||jsonb_build_object('sha256','__MEDIA_SHA256__','duration_s',1),admin_id);
 PERFORM pg_temp.assert_raises(format('SELECT ops_register_lesson_media(%L::jsonb,%L::uuid)',ops_inspect_lesson_object('approved/synthetic-v1.mp4')||jsonb_build_object('sha256','__MEDIA_SHA256__','duration_s',1),viewer_id),'Authenticated admin');
 manifest=jsonb_build_object('schema_version',1,'lesson_ref','lesson:synthetic-draft','version',1,'mode','draft','module_id',module_a,
  'title','Synthetic lesson','summary_md','Summary','workbook_md','One exercise','media',jsonb_build_object('verification_id',verified->>'id','storage_path','approved/synthetic-v1.mp4','sha256','__MEDIA_SHA256__'));
 a=ops_submit_artifact(jsonb_build_object('external_ref','lesson:synthetic-draft','kind','lesson','action','publish_lesson','title','Synthetic lesson','payload',manifest,
  'destination',jsonb_build_object('module_id',module_a),'item_keys',jsonb_build_array('lesson'),'manifest_hash',repeat('a',64)),'test');
 PERFORM pg_temp.assert_raises(format('SELECT ops_claim_artifact(%L::uuid,1,%L,%L::uuid)',a.id,a.manifest_hash,admin_id),'Exact-version approval');
 PERFORM ops_decide_artifact(a.id,1,a.manifest_hash,'approved',admin_id);
 run=ops_claim_artifact(a.id,1,a.manifest_hash,admin_id);
 PERFORM pg_temp.assert_raises(format('SELECT ops_publish_lesson_artifact(%L::uuid,%L::uuid,%L::jsonb)',a.id,run->>'claim_id',manifest),'Claim the pending');
 PERFORM ops_claim_artifact_item(a.id,(run->>'claim_id')::uuid,'lesson');
 receipt=ops_publish_lesson_artifact(a.id,(run->>'claim_id')::uuid,manifest);
 IF receipt->>'mode'<>'draft' OR (receipt->>'module_published')::boolean OR (SELECT is_published FROM training_modules WHERE id=module_a) THEN RAISE EXCEPTION 'Draft exposed'; END IF;
 IF (SELECT content_text FROM module_content WHERE id=(receipt->>'content_id')::uuid) NOT LIKE '%## Workbook%One exercise%' THEN RAISE EXCEPTION 'Workbook missing'; END IF;
 IF (SELECT status FROM ops_artifact_items WHERE artifact_id=a.id AND item_key='lesson')<>'succeeded' THEN RAISE EXCEPTION 'Receipt settlement missing'; END IF;
 SELECT count(*) INTO count_before FROM module_content;
 replay=ops_publish_lesson_artifact(a.id,(run->>'claim_id')::uuid,manifest);
 IF replay IS DISTINCT FROM receipt OR (SELECT count(*) FROM module_content)<>count_before THEN RAISE EXCEPTION 'Replay duplicated lesson'; END IF;
 PERFORM ops_finish_artifact(a.id,(run->>'claim_id')::uuid);
 replay=ops_publish_lesson_artifact(a.id,(run->>'claim_id')::uuid,manifest);
 IF replay IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'Completed replay lost receipt'; END IF;
 PERFORM pg_temp.assert_raises(format('SELECT ops_publish_lesson_artifact(%L::uuid,%L::uuid,%L::jsonb)',a.id,gen_random_uuid(),manifest),'Active approved');
 PERFORM pg_temp.assert_raises(format('SELECT ops_publish_lesson_artifact(%L::uuid,%L::uuid,%L::jsonb)',a.id,run->>'claim_id',manifest||'{"title":"Changed"}'),'differs from the claimed');

 manifest=manifest||jsonb_build_object('lesson_ref','lesson:synthetic-publish','module_id',module_b,'mode','publish');
 a=ops_submit_artifact(jsonb_build_object('external_ref','lesson:synthetic-publish','kind','lesson','action','publish_lesson','title','Synthetic lesson','payload',manifest,
  'destination',jsonb_build_object('module_id',module_b),'item_keys',jsonb_build_array('lesson'),'manifest_hash',repeat('b',64)),'test');
 PERFORM ops_decide_artifact(a.id,1,a.manifest_hash,'approved',admin_id);
 run=ops_claim_artifact(a.id,1,a.manifest_hash,admin_id);
 PERFORM ops_claim_artifact_item(a.id,(run->>'claim_id')::uuid,'lesson');
 UPDATE storage.objects SET metadata=metadata||'{"eTag":"replaced"}' WHERE id=object_id;
 PERFORM pg_temp.assert_raises(format('SELECT ops_publish_lesson_artifact(%L::uuid,%L::uuid,%L::jsonb)',a.id,run->>'claim_id',manifest),'changed or replaced');
 UPDATE storage.objects SET metadata=metadata||'{"eTag":"original"}' WHERE id=object_id;
 receipt=ops_publish_lesson_artifact(a.id,(run->>'claim_id')::uuid,manifest);
 IF NOT (receipt->>'module_published')::boolean OR NOT (SELECT is_published FROM training_modules WHERE id=module_b) THEN RAISE EXCEPTION 'Publication did not publish'; END IF;
 IF (SELECT status FROM lesson_recordings WHERE id=(receipt->>'recording_id')::uuid)<>'published' THEN RAISE EXCEPTION 'Recording publication missing'; END IF;

 INSERT INTO module_content(module_id,title) VALUES(module_c,'Unrelated private draft');
 manifest=manifest||jsonb_build_object('lesson_ref','lesson:blocked-unrelated','module_id',module_c);
 a=ops_submit_artifact(jsonb_build_object('external_ref','lesson:blocked-unrelated','kind','lesson','action','publish_lesson','title','Synthetic lesson','payload',manifest,
  'destination',jsonb_build_object('module_id',module_c),'item_keys',jsonb_build_array('lesson'),'manifest_hash',repeat('c',64)),'test');
 PERFORM ops_decide_artifact(a.id,1,a.manifest_hash,'approved',admin_id);
 run=ops_claim_artifact(a.id,1,a.manifest_hash,admin_id);
 PERFORM ops_claim_artifact_item(a.id,(run->>'claim_id')::uuid,'lesson');
 PERFORM pg_temp.assert_raises(format('SELECT ops_publish_lesson_artifact(%L::uuid,%L::uuid,%L::jsonb)',a.id,run->>'claim_id',manifest),'empty dedicated');
 IF (SELECT is_published FROM training_modules WHERE id=module_c) THEN RAISE EXCEPTION 'Other draft exposed'; END IF;
 UPDATE training_modules SET is_published=true WHERE id=module_c;
 PERFORM pg_temp.assert_raises(format('SELECT ops_publish_lesson_artifact(%L::uuid,%L::uuid,%L::jsonb)',a.id,run->>'claim_id',manifest),'unpublished lesson destination');
 UPDATE training_modules SET is_published=false WHERE id=module_c;
 IF has_table_privilege('authenticated','ops_lesson_media_verifications','INSERT') OR has_table_privilege('anon','ops_lesson_publications','SELECT')
  OR has_function_privilege('authenticated','ops_publish_lesson_artifact(uuid,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Client privilege leak'; END IF;
 RAISE NOTICE 'PASS: private draft, publication, exact approval/claim, receipt replay, changed media, unrelated drafts and client privilege rejection';
END $$;
ROLLBACK;
