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
