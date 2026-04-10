-- Store each client's Five Key Monthly Metrics so the portal can prompt for a
-- single monthly submission, then chart progress for both the client and Marc.

CREATE TABLE IF NOT EXISTS public.client_monthly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  monthly_revenue NUMERIC(14, 2) NOT NULL,
  gross_profit_margin NUMERIC(6, 2) NOT NULL,
  lead_conversion_rate NUMERIC(6, 2) NOT NULL,
  average_job_value NUMERIC(14, 2) NOT NULL,
  pipeline_forward_book NUMERIC(14, 2) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, month_start),
  CHECK (EXTRACT(DAY FROM month_start) = 1),
  CHECK (gross_profit_margin >= -100 AND gross_profit_margin <= 100),
  CHECK (lead_conversion_rate >= 0 AND lead_conversion_rate <= 100),
  CHECK (monthly_revenue >= 0),
  CHECK (average_job_value >= 0),
  CHECK (pipeline_forward_book >= 0)
);

CREATE INDEX IF NOT EXISTS idx_client_monthly_metrics_client_id
  ON public.client_monthly_metrics(client_id);

CREATE INDEX IF NOT EXISTS idx_client_monthly_metrics_month_start
  ON public.client_monthly_metrics(month_start DESC);

ALTER TABLE public.client_monthly_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own monthly metrics" ON public.client_monthly_metrics;
CREATE POLICY "Clients can view own monthly metrics" ON public.client_monthly_metrics
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clients can manage own monthly metrics" ON public.client_monthly_metrics;
CREATE POLICY "Clients can manage own monthly metrics" ON public.client_monthly_metrics
  FOR ALL USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage all monthly metrics" ON public.client_monthly_metrics;
CREATE POLICY "Admins can manage all monthly metrics" ON public.client_monthly_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
