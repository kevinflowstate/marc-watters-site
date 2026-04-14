-- Migration V2: Business Plans, Internal Notes
-- Run this in the Supabase Dashboard SQL Editor

-- ============================================
-- NEW TABLES
-- ============================================

-- Business plans (one active per client)
CREATE TABLE public.business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Business plan phases
CREATE TABLE public.business_plan_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.business_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0
);

-- Business plan items (checklist within phases)
CREATE TABLE public.business_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.business_plan_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- Phase-to-training content links (many-to-many)
CREATE TABLE public.phase_training_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.business_plan_phases(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.module_content(id) ON DELETE CASCADE,
  UNIQUE(phase_id, content_id)
);

-- Internal notes (admin-only, one per client)
CREATE TABLE public.internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_business_plans_client_id ON public.business_plans(client_id);
CREATE INDEX idx_business_plans_status ON public.business_plans(status);
CREATE INDEX idx_business_plan_phases_plan_id ON public.business_plan_phases(plan_id);
CREATE INDEX idx_business_plan_items_phase_id ON public.business_plan_items(phase_id);
CREATE INDEX idx_phase_training_links_phase_id ON public.phase_training_links(phase_id);
CREATE INDEX idx_phase_training_links_content_id ON public.phase_training_links(content_id);
CREATE INDEX idx_internal_notes_client_id ON public.internal_notes(client_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_plan_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_training_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

-- Business plans: admins full access, clients can view their own
CREATE POLICY "Admins can manage all business plans" ON public.business_plans
  FOR ALL USING (public.is_admin());

CREATE POLICY "Clients can view own business plans" ON public.business_plans
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

-- Phases: admins full access, clients can view via plan ownership
CREATE POLICY "Admins can manage all phases" ON public.business_plan_phases
  FOR ALL USING (public.is_admin());

CREATE POLICY "Clients can view own plan phases" ON public.business_plan_phases
  FOR SELECT USING (
    plan_id IN (
      SELECT bp.id FROM public.business_plans bp
      JOIN public.client_profiles cp ON bp.client_id = cp.id
      WHERE cp.user_id = auth.uid()
    )
  );

-- Items: admins full access, clients can view via phase->plan ownership
CREATE POLICY "Admins can manage all plan items" ON public.business_plan_items
  FOR ALL USING (public.is_admin());

CREATE POLICY "Clients can view own plan items" ON public.business_plan_items
  FOR SELECT USING (
    phase_id IN (
      SELECT bpp.id FROM public.business_plan_phases bpp
      JOIN public.business_plans bp ON bpp.plan_id = bp.id
      JOIN public.client_profiles cp ON bp.client_id = cp.id
      WHERE cp.user_id = auth.uid()
    )
  );

-- Training links: admins full access, clients can view own
CREATE POLICY "Admins can manage all training links" ON public.phase_training_links
  FOR ALL USING (public.is_admin());

CREATE POLICY "Clients can view own training links" ON public.phase_training_links
  FOR SELECT USING (
    phase_id IN (
      SELECT bpp.id FROM public.business_plan_phases bpp
      JOIN public.business_plans bp ON bpp.plan_id = bp.id
      JOIN public.client_profiles cp ON bp.client_id = cp.id
      WHERE cp.user_id = auth.uid()
    )
  );

-- Internal notes: admin-only (no client access)
CREATE POLICY "Admins can manage all internal notes" ON public.internal_notes
  FOR ALL USING (public.is_admin());
