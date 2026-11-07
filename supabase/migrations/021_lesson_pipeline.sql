CREATE TABLE public.lesson_recordings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source text NOT NULL DEFAULT 'fathom' CHECK(source IN ('fathom','upload','url')),
 fathom_meeting_id text UNIQUE,fathom_recording_id text,title text,recorded_at timestamptz,duration_s integer,
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','transcribing','transcribed','proposing','cuts_proposed','cuts_approved','rendering','rendered','lesson_drafted','published','failed')),
 transcript jsonb,transcript_text text,summary text,cut_list jsonb NOT NULL DEFAULT '[]',approved_cut_list jsonb,
 source_storage_path text,edited_storage_path text,module_content_id uuid REFERENCES public.module_content(id) ON DELETE SET NULL,
 publish_due_at timestamptz,error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.render_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recording_id uuid NOT NULL REFERENCES public.lesson_recordings(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed')),cut_list jsonb NOT NULL DEFAULT '[]',
 job_type text NOT NULL DEFAULT 'render' CHECK(job_type IN ('render','copy_source')),payload jsonb NOT NULL DEFAULT '{}',
 output_storage_path text,progress smallint NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),error text,started_at timestamptz,finished_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX render_jobs_active_recording ON public.render_jobs(recording_id,job_type) WHERE status IN ('queued','running');
CREATE TRIGGER lesson_recordings_updated_at BEFORE UPDATE ON public.lesson_recordings FOR EACH ROW EXECUTE FUNCTION public.ops_set_updated_at();
ALTER TABLE public.lesson_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY lesson_recordings_admin ON public.lesson_recordings FOR ALL USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')) WITH CHECK(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
CREATE POLICY render_jobs_admin ON public.render_jobs FOR ALL USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')) WITH CHECK(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
INSERT INTO storage.buckets(id,name,public) VALUES('lesson-media','lesson-media',false) ON CONFLICT(id) DO NOTHING;
-- No public/client Storage policy: all playback goes through the authorised signed-URL route.
CREATE POLICY lesson_media_admin ON storage.objects FOR ALL USING(bucket_id='lesson-media' AND EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')) WITH CHECK(bucket_id='lesson-media' AND EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
-- Draft creation is atomic/idempotent and requires an unpublished module, so drafts cannot leak into published training.
CREATE OR REPLACE FUNCTION public.ops_draft_lesson(p_recording uuid,p_module uuid) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r lesson_recordings; content_id uuid;
BEGIN
 SELECT * INTO r FROM lesson_recordings WHERE id=p_recording FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recording not found'; END IF;
 IF r.module_content_id IS NOT NULL THEN RETURN r.module_content_id; END IF;
 IF r.source_storage_path IS NULL THEN RAISE EXCEPTION 'Source copy is not ready'; END IF;
 IF r.status NOT IN ('transcribed','cuts_proposed','rendered') THEN RAISE EXCEPTION 'Recording is not ready for a draft'; END IF;
 PERFORM 1 FROM training_modules WHERE id=p_module AND is_published=false FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an unpublished module for the lesson draft'; END IF;
 INSERT INTO module_content(module_id,title,content_type,content_url,content_text,attachments,order_index) VALUES(p_module,r.title,'video','/admin/media/lesson/'||r.id,r.summary,'[]',coalesce((SELECT max(order_index)+1 FROM module_content WHERE module_id=p_module),0)) RETURNING id INTO content_id;
 UPDATE lesson_recordings SET module_content_id=content_id,status='lesson_drafted',error=null WHERE id=r.id;
 RETURN content_id;
END $$;
REVOKE ALL ON FUNCTION public.ops_draft_lesson(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_draft_lesson(uuid,uuid) TO service_role;

-- Atomic pipeline transitions keep callbacks and lesson state consistent on retries.
CREATE OR REPLACE FUNCTION public.ops_approve_lesson_cuts(p_recording uuid,p_cuts jsonb) RETURNS public.render_jobs LANGUAGE plpgsql SET search_path=public AS $$
DECLARE l lesson_recordings; j render_jobs;
BEGIN
 SELECT * INTO l FROM lesson_recordings WHERE id=p_recording FOR UPDATE;
 IF l.status<>'cuts_proposed' OR l.source_storage_path IS NULL THEN RAISE EXCEPTION 'Cuts/source are not ready for approval'; END IF;
 IF l.duration_s IS NULL OR l.duration_s-coalesce((SELECT sum((cut->>'end_s')::numeric-(cut->>'start_s')::numeric) FROM jsonb_array_elements(p_cuts) cut WHERE NOT coalesce((cut->>'keep')::boolean,false)),0)<0.1 THEN RAISE EXCEPTION 'Cuts must leave playable video'; END IF;
 INSERT INTO render_jobs(recording_id,cut_list,job_type) VALUES(l.id,p_cuts,'render') RETURNING * INTO j;
 UPDATE lesson_recordings SET approved_cut_list=p_cuts,status='cuts_approved',error=null WHERE id=l.id;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.ops_approve_lesson_cuts(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_approve_lesson_cuts(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ops_render_callback(p_job uuid,p_status text,p_progress smallint,p_path text DEFAULT NULL,p_error text DEFAULT NULL) RETURNS public.render_jobs LANGUAGE plpgsql SET search_path=public AS $$
DECLARE j render_jobs; expected text;
BEGIN
 SELECT * INTO j FROM render_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
 IF j.status IN ('done','failed') THEN RETURN j; END IF;
 IF p_status NOT IN ('running','done','failed') OR p_progress<0 OR p_progress>100 THEN RAISE EXCEPTION 'Invalid callback'; END IF;
 expected=CASE WHEN j.job_type='copy_source' THEN 'source/'||j.recording_id||'.mp4' ELSE 'edited/'||j.recording_id||'-'||j.id||'.mp4' END;
 IF p_status='done' AND p_path IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Unexpected output path'; END IF;
 UPDATE render_jobs SET status=p_status,progress=CASE WHEN p_status='done' THEN 100 ELSE greatest(progress,p_progress) END,error=p_error,started_at=coalesce(started_at,now()),finished_at=CASE WHEN p_status IN ('done','failed') THEN now() ELSE NULL END,output_storage_path=CASE WHEN p_status='done' THEN expected ELSE output_storage_path END WHERE id=p_job RETURNING * INTO j;
 IF p_status='done' AND j.job_type='copy_source' THEN
  UPDATE lesson_recordings SET source_storage_path=expected,error=null WHERE id=j.recording_id;
 ELSIF p_status='done' THEN
  UPDATE lesson_recordings SET status='rendered',edited_storage_path=expected,error=null WHERE id=j.recording_id;
 ELSIF p_status='running' AND j.job_type='render' THEN
  UPDATE lesson_recordings SET status='rendering' WHERE id=j.recording_id;
 ELSIF p_status='failed' THEN
  UPDATE lesson_recordings SET error=p_error WHERE id=j.recording_id;
 END IF;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.ops_render_callback(uuid,text,smallint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_render_callback(uuid,text,smallint,text,text) TO service_role;

-- Existing training publication is the authority; keep Ops status and publish work in sync.
CREATE OR REPLACE FUNCTION public.ops_sync_module_lessons() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE l lesson_recordings; t ops_tasks;
BEGIN
 FOR l IN SELECT r.* FROM lesson_recordings r JOIN module_content c ON c.id=r.module_content_id WHERE c.module_id=NEW.id AND r.status IN ('lesson_drafted','published') LOOP
  UPDATE lesson_recordings SET status=CASE WHEN NEW.is_published THEN 'published' ELSE 'lesson_drafted' END WHERE id=l.id;
  FOR t IN SELECT * FROM ops_tasks WHERE external_ref='lesson-publish:'||l.id LOOP
   IF NEW.is_published AND t.status<>'done' THEN PERFORM ops_mutate_task('complete','{"status":"done","decision_note":"Destination module published in training admin."}','training-admin',t.id);
   ELSIF NOT NEW.is_published AND t.status='done' THEN PERFORM ops_mutate_task('update','{"status":"open","decision_note":"Destination module unpublished; review before republishing."}','training-admin',t.id); END IF;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER ops_module_publication AFTER UPDATE OF is_published ON public.training_modules FOR EACH ROW WHEN(OLD.is_published IS DISTINCT FROM NEW.is_published) EXECUTE FUNCTION public.ops_sync_module_lessons();

CREATE OR REPLACE FUNCTION public.ops_retry_render_job(p_job uuid) RETURNS public.render_jobs LANGUAGE plpgsql SET search_path=public AS $$
DECLARE j render_jobs;
BEGIN
 SELECT * INTO j FROM render_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
 IF j.status='failed' AND NOT EXISTS(SELECT 1 FROM render_jobs newer WHERE newer.recording_id=j.recording_id AND newer.job_type=j.job_type AND (newer.created_at,newer.id)>(j.created_at,j.id)) THEN
  UPDATE render_jobs SET status='queued',progress=0,error=null,started_at=null,finished_at=null WHERE id=j.id RETURNING * INTO j;
  IF j.job_type='render' THEN UPDATE lesson_recordings SET status='cuts_approved',error=null WHERE id=j.recording_id; END IF;
 END IF;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.ops_retry_render_job(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_retry_render_job(uuid) TO service_role;

-- Moving content changes publication even when neither module's own flag changes.
CREATE OR REPLACE FUNCTION public.ops_sync_moved_lesson() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE l lesson_recordings; t ops_tasks; published boolean;
BEGIN
 SELECT is_published INTO published FROM training_modules WHERE id=NEW.module_id;
 FOR l IN SELECT * FROM lesson_recordings WHERE module_content_id=NEW.id AND status IN ('lesson_drafted','published') LOOP
  UPDATE lesson_recordings SET status=CASE WHEN published THEN 'published' ELSE 'lesson_drafted' END WHERE id=l.id;
  FOR t IN SELECT * FROM ops_tasks WHERE external_ref='lesson-publish:'||l.id LOOP
   PERFORM ops_mutate_task('update',jsonb_build_object('links',jsonb_build_array(jsonb_build_object('label','Review draft module','url','/admin/training/'||NEW.module_id))), 'training-admin',t.id);
   IF published AND t.status<>'done' THEN PERFORM ops_mutate_task('complete','{"status":"done","decision_note":"Lesson moved to a published module."}','training-admin',t.id);
   ELSIF NOT published AND t.status='done' THEN PERFORM ops_mutate_task('update','{"status":"open","decision_note":"Lesson moved to an unpublished module."}','training-admin',t.id); END IF;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER ops_lesson_move AFTER UPDATE OF module_id ON public.module_content FOR EACH ROW WHEN(OLD.module_id IS DISTINCT FROM NEW.module_id) EXECUTE FUNCTION public.ops_sync_moved_lesson();

-- Explicit operator recovery only after confirming the old process is stopped.
CREATE OR REPLACE FUNCTION public.ops_recover_render_job(p_job uuid,p_confirmed_stopped boolean) RETURNS public.render_jobs LANGUAGE plpgsql SET search_path=public AS $$
DECLARE j render_jobs;
BEGIN
 IF p_confirmed_stopped IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm previous worker is stopped'; END IF;
 SELECT * INTO j FROM render_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND OR j.status<>'running' THEN RAISE EXCEPTION 'Job is not an interrupted running job'; END IF;
 IF EXISTS(SELECT 1 FROM render_jobs newer WHERE newer.recording_id=j.recording_id AND newer.job_type=j.job_type AND (newer.created_at,newer.id)>(j.created_at,j.id)) THEN RAISE EXCEPTION 'Job was superseded'; END IF;
 UPDATE render_jobs SET status='queued',progress=0,error=null,started_at=null,finished_at=null WHERE id=j.id RETURNING * INTO j;
 IF j.job_type='render' THEN UPDATE lesson_recordings SET status='cuts_approved',error=null WHERE id=j.recording_id; END IF;
 INSERT INTO ops_events(actor,action,data) VALUES('training-admin','worker_job_recovered',jsonb_build_object('job_id',j.id,'previous_worker_confirmed_stopped',true));
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.ops_recover_render_job(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_recover_render_job(uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.ops_remove_lesson_content() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE l lesson_recordings; t ops_tasks;
BEGIN
 FOR l IN SELECT * FROM lesson_recordings WHERE module_content_id=OLD.id FOR UPDATE LOOP
  UPDATE lesson_recordings SET module_content_id=null,status=CASE WHEN edited_storage_path IS NOT NULL THEN 'rendered' WHEN source_storage_path IS NOT NULL THEN 'transcribed' ELSE 'received' END WHERE id=l.id;
  FOR t IN SELECT * FROM ops_tasks WHERE external_ref='lesson-publish:'||l.id AND status<>'cancelled' LOOP
   PERFORM ops_mutate_task('update','{"status":"cancelled","decision_note":"Lesson removed from training; create a new draft before publishing."}','training-admin',t.id);
  END LOOP;
 END LOOP;
 RETURN OLD;
END $$;
CREATE TRIGGER ops_lesson_remove BEFORE DELETE ON public.module_content FOR EACH ROW EXECUTE FUNCTION public.ops_remove_lesson_content();
