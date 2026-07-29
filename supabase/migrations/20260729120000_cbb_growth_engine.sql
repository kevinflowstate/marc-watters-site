-- CBB Growth Engine
-- Additive, locked-by-default data model for client entitlements and weekly reports.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('client', 'admin', 'growth_operator'));

CREATE OR REPLACE FUNCTION public.current_user_is_growth_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'growth_operator')
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_growth_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_growth_manager() TO authenticated;

CREATE TABLE public.client_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  enabled_at timestamptz,
  disabled_at timestamptz,
  granted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, entitlement_key)
);

CREATE INDEX idx_client_entitlements_lookup
  ON public.client_entitlements(client_id, entitlement_key, status);

CREATE OR REPLACE FUNCTION public.client_has_active_entitlement(
  p_client_id uuid,
  p_entitlement_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_profiles cp
    JOIN public.client_entitlements ce ON ce.client_id = cp.id
    WHERE cp.id = p_client_id
      AND cp.user_id = auth.uid()
      AND cp.archived_at IS NULL
      AND ce.entitlement_key = p_entitlement_key
      AND ce.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.client_has_active_entitlement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_has_active_entitlement(uuid, text) TO authenticated;

CREATE TABLE public.cbb_growth_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  strategy_summary text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(strategy_summary) <= 12000)
);

CREATE TABLE public.cbb_growth_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cbb_growth_workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  period_start date,
  period_end date,
  executive_summary text NOT NULL DEFAULT '',
  progress_update text NOT NULL DEFAULT '',
  next_priorities text NOT NULL DEFAULT '',
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  published_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notification_sent_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(title) BETWEEN 1 AND 140),
  CHECK (period_start IS NULL OR period_end IS NULL OR period_end >= period_start),
  CHECK (jsonb_typeof(metrics) = 'array'),
  CHECK (
    (status = 'draft' AND published_at IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL)
  )
);

CREATE INDEX idx_cbb_growth_reports_workspace_status
  ON public.cbb_growth_reports(workspace_id, status, published_at DESC, created_at DESC);

CREATE TABLE public.cbb_growth_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cbb_growth_workspaces(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.cbb_growth_reports(id) ON DELETE SET NULL,
  title text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  published_at timestamptz,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbb_growth_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbb_growth_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbb_growth_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Growth managers manage entitlements" ON public.client_entitlements
  FOR ALL USING (public.current_user_is_growth_manager())
  WITH CHECK (public.current_user_is_growth_manager());

CREATE POLICY "Growth managers manage workspaces" ON public.cbb_growth_workspaces
  FOR ALL USING (public.current_user_is_growth_manager())
  WITH CHECK (public.current_user_is_growth_manager());

CREATE POLICY "Entitled clients view own Growth Engine workspace" ON public.cbb_growth_workspaces
  FOR SELECT USING (public.client_has_active_entitlement(client_id, 'cbb_growth_engine'));

CREATE POLICY "Growth managers manage reports" ON public.cbb_growth_reports
  FOR ALL USING (public.current_user_is_growth_manager())
  WITH CHECK (public.current_user_is_growth_manager());

CREATE POLICY "Entitled clients view published Growth Engine reports" ON public.cbb_growth_reports
  FOR SELECT USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.cbb_growth_workspaces workspace
      WHERE workspace.id = cbb_growth_reports.workspace_id
        AND public.client_has_active_entitlement(workspace.client_id, 'cbb_growth_engine')
    )
  );

CREATE POLICY "Growth managers manage assets" ON public.cbb_growth_assets
  FOR ALL USING (public.current_user_is_growth_manager())
  WITH CHECK (public.current_user_is_growth_manager());

CREATE POLICY "Entitled clients view published Growth Engine assets" ON public.cbb_growth_assets
  FOR SELECT USING (
    published_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.cbb_growth_workspaces workspace
      WHERE workspace.id = cbb_growth_assets.workspace_id
        AND public.client_has_active_entitlement(workspace.client_id, 'cbb_growth_engine')
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cbb-growth-engine', 'cbb-growth-engine', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit;

CREATE POLICY "Growth managers manage Growth Engine files" ON storage.objects
  FOR ALL
  USING (bucket_id = 'cbb-growth-engine' AND public.current_user_is_growth_manager())
  WITH CHECK (bucket_id = 'cbb-growth-engine' AND public.current_user_is_growth_manager());

CREATE POLICY "Entitled clients download own Growth Engine files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cbb-growth-engine'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.user_id = auth.uid()
        AND cp.archived_at IS NULL
        AND cp.id::text = (storage.foldername(name))[1]
        AND public.client_has_active_entitlement(cp.id, 'cbb_growth_engine')
    )
  );

ALTER TABLE public.notifications ADD COLUMN dedupe_key text;
CREATE UNIQUE INDEX idx_notifications_user_dedupe
  ON public.notifications(user_id, dedupe_key);

-- No entitlement rows are seeded. Every existing and future client starts locked.
