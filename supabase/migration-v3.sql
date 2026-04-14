-- Migration V3: Customisable Form Config
-- Run this in the Supabase Dashboard SQL Editor

-- ============================================
-- NEW TABLE: form_config
-- ============================================

CREATE TABLE public.form_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type TEXT UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_form_config_form_type ON public.form_config(form_type);

-- ============================================
-- ALTER: checkins - add responses JSONB
-- ============================================

ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS responses JSONB;

-- Remove the CHECK constraint on mood so Marc can customise mood options
-- The constraint name may vary - drop by finding it
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'checkins'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%mood%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.checkins DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- ============================================
-- ALTER: business_plans - add discovery_answers JSONB
-- ============================================

ALTER TABLE public.business_plans ADD COLUMN IF NOT EXISTS discovery_answers JSONB;

-- ============================================
-- ROW LEVEL SECURITY for form_config
-- ============================================

ALTER TABLE public.form_config ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage form config" ON public.form_config
  FOR ALL USING (public.is_admin());

-- Clients can read config (needed to render check-in form)
CREATE POLICY "Clients can read form config" ON public.form_config
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- ============================================
-- SEED: Default check-in config
-- ============================================

INSERT INTO public.form_config (form_type, config) VALUES
(
  'checkin',
  '{
    "checkin_day": "monday",
    "mood_enabled": true,
    "mood_options": [
      { "value": "great", "label": "Great", "color": "emerald" },
      { "value": "good", "label": "Good", "color": "blue" },
      { "value": "okay", "label": "Okay", "color": "amber" },
      { "value": "struggling", "label": "Struggling", "color": "red" }
    ],
    "questions": [
      { "id": "wins", "label": "Wins this week", "placeholder": "What went well? Any progress or breakthroughs?", "type": "textarea", "required": false },
      { "id": "challenges", "label": "Challenges", "placeholder": "What are you finding difficult or stuck on?", "type": "textarea", "required": false },
      { "id": "questions", "label": "Questions for Marc", "placeholder": "Anything you need help with or want to discuss?", "type": "textarea", "required": false }
    ]
  }'::jsonb
),
(
  'business_plan',
  '{
    "questions": []
  }'::jsonb
)
ON CONFLICT (form_type) DO NOTHING;
