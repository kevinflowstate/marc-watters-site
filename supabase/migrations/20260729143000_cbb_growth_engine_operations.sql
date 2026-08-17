-- Complete the Growth Engine operating workflow without enabling any client.

ALTER TABLE public.cbb_growth_reports
  DROP CONSTRAINT IF EXISTS cbb_growth_reports_status_check;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.cbb_growth_reports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%published_at%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.cbb_growth_reports DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.cbb_growth_reports
  ADD COLUMN IF NOT EXISTS generation_key text,
  ADD COLUMN IF NOT EXISTS generation_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawal_reason text,
  ADD CONSTRAINT cbb_growth_reports_status_check
    CHECK (status IN ('draft', 'published', 'withdrawn')),
  ADD CONSTRAINT cbb_growth_reports_lifecycle_check
    CHECK (
      (status = 'draft' AND published_at IS NULL)
      OR (status IN ('published', 'withdrawn') AND published_at IS NOT NULL)
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_cbb_growth_reports_generation_key
  ON public.cbb_growth_reports(generation_key);

CREATE TABLE IF NOT EXISTS public.cbb_growth_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.cbb_growth_reports(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated', 'published', 'withdrawn', 'deleted')),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cbb_growth_report_events_report_created
  ON public.cbb_growth_report_events(report_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cbb_growth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  ghl_location_id text,
  ghl_calendar_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  timezone text NOT NULL DEFAULT 'Europe/London',
  automation_enabled boolean NOT NULL DEFAULT true,
  report_day smallint NOT NULL DEFAULT 1 CHECK (report_day BETWEEN 0 AND 6),
  last_event_at timestamptz,
  last_draft_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(ghl_calendar_ids) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cbb_growth_connections_ghl_location
  ON public.cbb_growth_connections(ghl_location_id)
  WHERE ghl_location_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cbb_growth_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  ghl_event_id text NOT NULL,
  ghl_contact_id text,
  contact_name text,
  appointment_status text NOT NULL DEFAULT 'booked',
  starts_at timestamptz,
  ends_at timestamptz,
  source text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, ghl_event_id)
);

CREATE INDEX IF NOT EXISTS idx_cbb_growth_appointments_client_start
  ON public.cbb_growth_appointments(client_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS public.cbb_growth_sales_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.cbb_growth_appointments(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('won', 'lost', 'follow_up', 'no_show')),
  sale_value numeric(14,2) NOT NULL DEFAULT 0 CHECK (sale_value >= 0),
  notes text,
  submitted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(COALESCE(notes, '')) <= 2000)
);

ALTER TABLE public.cbb_growth_assets
  ADD COLUMN IF NOT EXISTS original_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.cbb_growth_report_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbb_growth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbb_growth_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbb_growth_sales_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Growth managers manage report events" ON public.cbb_growth_report_events
  FOR ALL USING (public.current_user_is_growth_manager())
  WITH CHECK (public.current_user_is_growth_manager());

CREATE POLICY "Growth managers manage connections" ON public.cbb_growth_connections
  FOR ALL USING (public.current_user_is_growth_manager())
  WITH CHECK (public.current_user_is_growth_manager());

CREATE POLICY "Growth managers manage appointments" ON public.cbb_growth_appointments
  FOR ALL USING (public.current_user_is_growth_manager())
  WITH CHECK (public.current_user_is_growth_manager());

CREATE POLICY "Entitled clients view own Growth Engine appointments" ON public.cbb_growth_appointments
  FOR SELECT USING (public.client_has_active_entitlement(client_id, 'cbb_growth_engine'));

CREATE POLICY "Growth managers manage sales outcomes" ON public.cbb_growth_sales_outcomes
  FOR ALL USING (public.current_user_is_growth_manager())
  WITH CHECK (public.current_user_is_growth_manager());

CREATE POLICY "Entitled clients manage own Growth Engine sales outcomes" ON public.cbb_growth_sales_outcomes
  FOR ALL USING (
    public.client_has_active_entitlement(client_id, 'cbb_growth_engine')
    AND EXISTS (
      SELECT 1 FROM public.cbb_growth_appointments appointment
      WHERE appointment.id = appointment_id
        AND appointment.client_id = client_id
    )
  )
  WITH CHECK (
    public.client_has_active_entitlement(client_id, 'cbb_growth_engine')
    AND EXISTS (
      SELECT 1 FROM public.cbb_growth_appointments appointment
      WHERE appointment.id = appointment_id
        AND appointment.client_id = client_id
    )
  );
