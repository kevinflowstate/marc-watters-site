CREATE TABLE public.ops_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),week_start date NOT NULL UNIQUE,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','sent')),data jsonb NOT NULL DEFAULT '{}',narrative_md text NOT NULL DEFAULT '',observations_md text NOT NULL DEFAULT '',reviewed_by uuid REFERENCES public.users(id),reviewed_at timestamptz,sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.ops_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY ops_reports_admin ON public.ops_reports FOR ALL USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')) WITH CHECK(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
CREATE TRIGGER ops_reports_updated_at BEFORE UPDATE ON public.ops_reports FOR EACH ROW EXECUTE FUNCTION public.ops_set_updated_at();

-- Sending freezes the exact reviewed revision until its outcome is reconciled.
ALTER TABLE public.ops_reports ADD COLUMN IF NOT EXISTS generated_narrative_md text NOT NULL DEFAULT '',ADD COLUMN IF NOT EXISTS send_claim_id uuid,ADD COLUMN IF NOT EXISTS send_claimed_at timestamptz;
CREATE OR REPLACE FUNCTION public.ops_claim_report_send(p_id uuid,p_expected timestamptz,p_claim uuid) RETURNS public.ops_reports LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r ops_reports;
BEGIN
 SELECT * INTO r FROM ops_reports WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'reviewed' OR r.updated_at IS DISTINCT FROM p_expected OR r.send_claim_id IS NOT NULL THEN RAISE EXCEPTION 'Report changed or send is already claimed'; END IF;
 UPDATE ops_reports SET send_claim_id=p_claim,send_claimed_at=now() WHERE id=p_id RETURNING * INTO r;
 RETURN r;
END $$;
CREATE OR REPLACE FUNCTION public.ops_finish_report_send(p_id uuid,p_claim uuid,p_expected timestamptz,p_sent boolean) RETURNS public.ops_reports LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r ops_reports;
BEGIN
 SELECT * INTO r FROM ops_reports WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.send_claim_id IS DISTINCT FROM p_claim OR r.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Report send revision needs reconciliation'; END IF;
 UPDATE ops_reports SET status=CASE WHEN p_sent THEN 'sent' ELSE status END,sent_at=CASE WHEN p_sent THEN now() ELSE sent_at END,send_claim_id=NULL,send_claimed_at=NULL WHERE id=p_id RETURNING * INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.ops_claim_report_send(uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_finish_report_send(uuid,uuid,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_claim_report_send(uuid,timestamptz,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ops_finish_report_send(uuid,uuid,timestamptz,boolean) TO service_role;
