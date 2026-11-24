-- The portal reads and updates reports through authenticated, role-filtered server routes.
-- The raw report includes bank details, Stripe totals and the full financial narrative.
REVOKE ALL ON TABLE public.ops_reports FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS ops_reports_admin ON public.ops_reports;
GRANT ALL ON TABLE public.ops_reports TO service_role;

-- Shared staff notes use a separate field from historical unrestricted observations.
ALTER TABLE public.ops_reports ADD COLUMN IF NOT EXISTS shared_observations_md text NOT NULL DEFAULT '';
