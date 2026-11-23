-- Growth Engine sales pipeline (Kevin, 23 Nov 2026).
-- Marc's clients book a consultation with Kevin on the CBB Growth Engine calendar (Flowstate CRM).
-- A CRM workflow posts each booking to /api/webhooks/ghl/growth-engine-pipeline, which lands a card
-- in "Call booked". Kevin and Marc then move cards through Proposal, Follow up, Won and Lost from
-- Admin > Growth Engine. Service role only: the admin API checks the signed-in admin.

CREATE TABLE IF NOT EXISTS public.cbb_growth_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL DEFAULT 'call_booked'
    CHECK (stage IN ('call_booked', 'proposal', 'follow_up', 'won', 'lost')),
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  contact_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  business_name TEXT,
  -- Marc's portal client this lead matches (by email), if any.
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  -- CRM ids from the Flowstate location (text, not UUIDs).
  ghl_contact_id TEXT,
  ghl_appointment_id TEXT UNIQUE,
  appointment_at TIMESTAMPTZ,
  appointment_status TEXT,
  proposal_url TEXT,
  proposal_value NUMERIC(12, 2),
  proposal_sent_at DATE,
  proposal_file_path TEXT,
  proposal_file_name TEXT,
  follow_up_at DATE,
  notes TEXT,
  lost_reason TEXT,
  source TEXT NOT NULL DEFAULT 'calendar' CHECK (source IN ('calendar', 'manual')),
  payload JSONB,
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS cbb_growth_pipeline_stage ON public.cbb_growth_pipeline(stage, position);
CREATE INDEX IF NOT EXISTS cbb_growth_pipeline_contact ON public.cbb_growth_pipeline(ghl_contact_id);

ALTER TABLE public.cbb_growth_pipeline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cbb_growth_pipeline FROM anon, authenticated;
