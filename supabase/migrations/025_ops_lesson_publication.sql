-- Trusted verification of privately stored media and atomic approved lesson handoff.
-- Apply after 023_ops_actions.sql. No credentials, bucket visibility or client assignments change.
CREATE TABLE public.ops_lesson_media_verifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid NOT NULL,
 storage_path text NOT NULL CHECK(storage_path ~ '^approved/[a-zA-Z0-9/_-]+\.mp4$' AND storage_path NOT LIKE '%..%' AND storage_path NOT LIKE '%//%'),
 updated_at timestamptz NOT NULL, etag text NOT NULL DEFAULT '', bytes bigint NOT NULL CHECK(bytes>0 AND bytes<=268435456),
 mime_type text NOT NULL CHECK(mime_type='video/mp4'), sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 duration_s double precision NOT NULL CHECK(duration_s>0 AND duration_s<=28800),
 verified_by uuid NOT NULL REFERENCES public.users(id), verified_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(object_id,updated_at,sha256)
);
CREATE TABLE public.ops_lesson_publications (
 artifact_id uuid PRIMARY KEY REFERENCES public.ops_artifacts(id),
 lesson_ref text NOT NULL UNIQUE, lesson_version integer NOT NULL CHECK(lesson_version>0),
 recording_id uuid REFERENCES public.lesson_recordings(id) ON DELETE SET NULL,
 content_id uuid REFERENCES public.module_content(id) ON DELETE SET NULL,
 module_id uuid REFERENCES public.training_modules(id) ON DELETE SET NULL,
 receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt)='object'), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ops_lesson_media_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_lesson_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_lesson_media_verifications,public.ops_lesson_publications FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ops_lesson_media_verifications,public.ops_lesson_publications TO service_role;

CREATE FUNCTION public.ops_inspect_lesson_object(p_path text) RETURNS jsonb
 LANGUAGE plpgsql SET search_path=public AS $$
DECLARE object storage.objects;
BEGIN
 IF p_path !~ '^approved/[a-zA-Z0-9/_-]+\.mp4$' OR p_path LIKE '%..%' OR p_path LIKE '%//%'
 THEN RAISE EXCEPTION 'Use an approved private MP4 path'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='lesson-media' AND public=false)
 THEN RAISE EXCEPTION 'Lesson media bucket must remain private'; END IF;
 SELECT * INTO object FROM storage.objects WHERE bucket_id='lesson-media' AND name=p_path;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private lesson media not found' USING ERRCODE='P0002'; END IF;
 IF coalesce(object.metadata->>'size','') !~ '^[0-9]+$' OR object.metadata->>'mimetype' IS DISTINCT FROM 'video/mp4'
 THEN RAISE EXCEPTION 'Stored video metadata is unavailable'; END IF;
 RETURN jsonb_build_object('object_id',object.id,'storage_path',object.name,'updated_at',object.updated_at,
  'etag',coalesce(object.metadata->>'eTag',object.metadata->>'etag',''),'bytes',(object.metadata->>'size')::bigint,'mime_type',object.metadata->>'mimetype');
END $$;

-- Called only after the server streams/hashes/probes the actual private object.
-- This RPC is service-only: a client cannot self-assert a verified hash or duration.
CREATE FUNCTION public.ops_register_lesson_media(p_object jsonb,p_actor uuid) RETURNS jsonb
 LANGUAGE plpgsql SET search_path=public AS $$
DECLARE current_object jsonb; result ops_lesson_media_verifications;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Authenticated admin required'; END IF;
 IF p_object->>'sha256' !~ '^[a-f0-9]{64}$' OR (p_object->>'duration_s')::double precision<=0 OR (p_object->>'duration_s')::double precision>28800
 THEN RAISE EXCEPTION 'Verified media hash and duration required'; END IF;
 -- Lock the metadata identity while the verification receipt is stored.
 PERFORM 1 FROM storage.objects WHERE bucket_id='lesson-media' AND name=p_object->>'storage_path' FOR SHARE;
 current_object=ops_inspect_lesson_object(p_object->>'storage_path');
 IF current_object->>'object_id' IS DISTINCT FROM p_object->>'object_id'
  OR (current_object->>'updated_at')::timestamptz IS DISTINCT FROM (p_object->>'updated_at')::timestamptz
  OR current_object->>'etag' IS DISTINCT FROM p_object->>'etag'
  OR current_object->>'bytes' IS DISTINCT FROM p_object->>'bytes'
  OR current_object->>'mime_type' IS DISTINCT FROM p_object->>'mime_type'
 THEN RAISE EXCEPTION 'Stored media changed during verification'; END IF;
 INSERT INTO ops_lesson_media_verifications(object_id,storage_path,updated_at,etag,bytes,mime_type,sha256,duration_s,verified_by)
 VALUES((current_object->>'object_id')::uuid,current_object->>'storage_path',(current_object->>'updated_at')::timestamptz,current_object->>'etag',
  (current_object->>'bytes')::bigint,current_object->>'mime_type',p_object->>'sha256',(p_object->>'duration_s')::double precision,p_actor)
 ON CONFLICT(object_id,updated_at,sha256) DO NOTHING RETURNING * INTO result;
 IF result.id IS NULL THEN SELECT * INTO result FROM ops_lesson_media_verifications WHERE object_id=(current_object->>'object_id')::uuid
  AND updated_at=(current_object->>'updated_at')::timestamptz AND sha256=p_object->>'sha256'; END IF;
 RETURN to_jsonb(result);
END $$;

CREATE FUNCTION public.ops_publish_lesson_artifact(p_artifact uuid,p_claim uuid,p_manifest jsonb) RETURNS jsonb
 LANGUAGE plpgsql SET search_path=public AS $$
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
 IF p_manifest->>'schema_version' IS DISTINCT FROM '1' OR p_manifest->>'mode' IS NULL OR p_manifest->>'mode' NOT IN ('draft','publish')
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
 IF NOT FOUND OR target.is_published IS DISTINCT FROM false THEN RAISE EXCEPTION 'Choose an unpublished lesson destination'; END IF;
 IF mode='publish' AND EXISTS(SELECT 1 FROM module_content c WHERE c.module_id=target.id)
 THEN RAISE EXCEPTION 'Publishing requires an empty dedicated module; other drafts must stay private'; END IF;
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
  UPDATE lesson_recordings SET status='published' WHERE id=recording_id;
 END IF;
 publication_receipt=jsonb_build_object('artifact_id',a.id,'manifest_hash',a.manifest_hash,'version',a.version,'mode',mode,
  'recording_id',recording_id,'content_id',content_id,'module_id',target.id,'title',p_manifest->>'title',
  'media_verification_id',verification.id,'media_sha256',verification.sha256,'duration_s',verification.duration_s,
  'module_published',mode='publish','admin_url','/admin/training/'||target.id,'training_url','/portal/training/'||target.id,'completed_at',now());
 INSERT INTO ops_lesson_publications(artifact_id,lesson_ref,lesson_version,recording_id,content_id,module_id,receipt)
 VALUES(a.id,p_manifest->>'lesson_ref',a.version,recording_id,content_id,target.id,publication_receipt);
 UPDATE ops_artifact_items SET status='succeeded',receipt=publication_receipt,error=NULL,finished_at=now(),updated_at=clock_timestamp() WHERE id=item.id;
 RETURN publication_receipt;
END $$;

REVOKE ALL ON FUNCTION public.ops_inspect_lesson_object(text),public.ops_register_lesson_media(jsonb,uuid),public.ops_publish_lesson_artifact(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_inspect_lesson_object(text),public.ops_register_lesson_media(jsonb,uuid),public.ops_publish_lesson_artifact(uuid,uuid,jsonb) TO service_role;
