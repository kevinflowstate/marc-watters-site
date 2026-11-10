-- Weekly lesson replays go into the existing live "Call Replays" module (Kevin, 10 Nov 2026).
-- Adds mode 'append': add the approved lesson to an already published module. The lesson is only
-- inserted at execution time, after an authenticated exact-version approval and with the lesson
-- publication switch on, so clients never see an unapproved lesson. 'draft' and 'publish' keep
-- their dedicated-unpublished-module rules unchanged.
CREATE OR REPLACE FUNCTION public.ops_publish_lesson_artifact(p_artifact uuid, p_claim uuid, p_manifest jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE a ops_artifacts; item ops_artifact_items; verification ops_lesson_media_verifications;
 current_object jsonb; target training_modules; result ops_lesson_publications;
 media jsonb; mode text; module_id uuid; recording_id uuid; content_id uuid; publication_receipt jsonb; summary text;
BEGIN
 SELECT * INTO a FROM ops_artifacts WHERE id=p_artifact FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Artifact not found' USING ERRCODE='P0002'; END IF;
 IF a.claim_id IS DISTINCT FROM p_claim OR a.status NOT IN ('running','completed') OR a.kind<>'lesson' OR a.action<>'publish_lesson'
 THEN RAISE EXCEPTION 'Active approved lesson execution required'; END IF;
 IF a.payload IS DISTINCT FROM p_manifest OR a.version IS DISTINCT FROM (p_manifest->>'version')::integer
  OR a.item_keys IS DISTINCT FROM ARRAY['lesson']::text[]
 THEN RAISE EXCEPTION 'Lesson manifest differs from the claimed version'; END IF;
 IF a.approved_by IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=a.approved_by AND role='admin')
  OR NOT EXISTS(SELECT 1 FROM ops_artifact_decisions d WHERE d.artifact_id=a.id AND d.version=a.version
   AND d.manifest_hash=a.manifest_hash AND d.action=a.action AND d.destination=a.destination AND d.decision='approved' AND d.actor_id=a.approved_by)
 THEN RAISE EXCEPTION 'Authenticated exact-version lesson approval required'; END IF;
 SELECT * INTO item FROM ops_artifact_items WHERE artifact_id=a.id AND item_key='lesson' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Claim the lesson action item first'; END IF;
 SELECT * INTO result FROM ops_lesson_publications WHERE artifact_id=a.id;
 IF FOUND THEN
  IF item.status<>'succeeded' OR item.receipt IS DISTINCT FROM result.receipt THEN RAISE EXCEPTION 'Lesson receipt needs reconciliation'; END IF;
  RETURN result.receipt;
 END IF;
 IF a.status<>'running' OR item.status<>'running' THEN RAISE EXCEPTION 'Claim the pending lesson action item first'; END IF;
 IF p_manifest->>'schema_version' IS DISTINCT FROM '1' OR p_manifest->>'mode' IS NULL OR p_manifest->>'mode' NOT IN ('draft','publish','append')
  OR coalesce(length(p_manifest->>'lesson_ref'),0) NOT BETWEEN 1 AND 200
  OR coalesce(length(trim(p_manifest->>'title')),0) NOT BETWEEN 1 AND 300
  OR jsonb_typeof(p_manifest->'summary_md') IS DISTINCT FROM 'string' OR length(p_manifest->>'summary_md')>50000
  OR jsonb_typeof(p_manifest->'workbook_md') IS DISTINCT FROM 'string' OR length(p_manifest->>'workbook_md')>100000
 THEN RAISE EXCEPTION 'Invalid lesson publication manifest'; END IF;
 mode=p_manifest->>'mode'; module_id=(p_manifest->>'module_id')::uuid; media=p_manifest->'media';
 IF a.destination IS DISTINCT FROM jsonb_build_object('module_id',module_id) THEN RAISE EXCEPTION 'Approved lesson destination changed'; END IF;
 -- Stable lesson reference prevents publishing the same lesson through a second artifact.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_manifest->>'lesson_ref',77109));
 IF EXISTS(SELECT 1 FROM ops_lesson_publications WHERE lesson_ref=p_manifest->>'lesson_ref') THEN RAISE EXCEPTION 'This lesson already has a publication receipt; inspect it before any replacement'; END IF;
 SELECT * INTO verification FROM ops_lesson_media_verifications WHERE id=(media->>'verification_id')::uuid;
 IF NOT FOUND OR verification.storage_path IS DISTINCT FROM media->>'storage_path' OR verification.sha256 IS DISTINCT FROM media->>'sha256'
 THEN RAISE EXCEPTION 'Verified lesson media does not match approval'; END IF;
 PERFORM 1 FROM storage.objects WHERE bucket_id='lesson-media' AND name=verification.storage_path FOR SHARE;
 current_object=ops_inspect_lesson_object(verification.storage_path);
 IF (current_object->>'object_id')::uuid IS DISTINCT FROM verification.object_id
  OR (current_object->>'updated_at')::timestamptz IS DISTINCT FROM verification.updated_at
  OR current_object->>'etag' IS DISTINCT FROM verification.etag OR (current_object->>'bytes')::bigint IS DISTINCT FROM verification.bytes
 THEN RAISE EXCEPTION 'Verified video was changed or replaced; verify and approve again'; END IF;
 SELECT * INTO target FROM training_modules WHERE id=module_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lesson destination module not found'; END IF;
 IF mode='append' THEN
  IF target.is_published IS DISTINCT FROM true THEN RAISE EXCEPTION 'Adding to an existing module needs a live module'; END IF;
 ELSE
  IF target.is_published IS DISTINCT FROM false THEN RAISE EXCEPTION 'Choose an unpublished lesson destination'; END IF;
  IF mode='publish' AND EXISTS(SELECT 1 FROM module_content c WHERE c.module_id=target.id)
  THEN RAISE EXCEPTION 'Publishing requires an empty dedicated module; other drafts must stay private'; END IF;
 END IF;
 summary=p_manifest->>'summary_md';
 IF length(p_manifest->>'workbook_md')>0 THEN summary=summary||E'\n\n## Workbook\n\n'||(p_manifest->>'workbook_md'); END IF;
 INSERT INTO lesson_recordings(source,title,recorded_at,duration_s,status,summary,cut_list,source_storage_path,edited_storage_path)
 VALUES('upload',p_manifest->>'title',now(),ceil(verification.duration_s)::integer,'rendered',summary,'[]',verification.storage_path,verification.storage_path)
 RETURNING id INTO recording_id;
 INSERT INTO module_content(module_id,title,content_type,content_url,content_text,duration_minutes,attachments,order_index)
 VALUES(target.id,p_manifest->>'title','video','/admin/media/lesson/'||recording_id,summary,ceil(verification.duration_s/60)::integer,'[]',
  coalesce((SELECT max(c.order_index)+1 FROM module_content c WHERE c.module_id=target.id),0)) RETURNING id INTO content_id;
 UPDATE lesson_recordings SET module_content_id=content_id,status='lesson_drafted' WHERE id=recording_id;
 IF mode='publish' THEN
  UPDATE training_modules SET is_published=true WHERE id=target.id;
 END IF;
 IF mode IN ('publish','append') THEN
  UPDATE lesson_recordings SET status='published' WHERE id=recording_id;
 END IF;
 publication_receipt=jsonb_build_object('artifact_id',a.id,'manifest_hash',a.manifest_hash,'version',a.version,'mode',mode,
  'recording_id',recording_id,'content_id',content_id,'module_id',target.id,'title',p_manifest->>'title',
  'media_verification_id',verification.id,'media_sha256',verification.sha256,'duration_s',verification.duration_s,
  'module_published',mode IN ('publish','append'),'admin_url','/admin/training/'||target.id,'training_url','/portal/training/'||target.id,'completed_at',now());
 INSERT INTO ops_lesson_publications(artifact_id,lesson_ref,lesson_version,recording_id,content_id,module_id,receipt)
 VALUES(a.id,p_manifest->>'lesson_ref',a.version,recording_id,content_id,target.id,publication_receipt);
 UPDATE ops_artifact_items SET status='succeeded',receipt=publication_receipt,error=NULL,finished_at=now(),updated_at=clock_timestamp() WHERE id=item.id;
 RETURN publication_receipt;
END $function$;
