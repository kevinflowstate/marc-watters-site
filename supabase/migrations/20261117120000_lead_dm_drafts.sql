-- Leads tab: suggested replies to Instagram DMs (Kevin approved 17 Nov 2026).
-- The portal reads Marc's Instagram DMs from the CRM, writes a suggested reply in Marc's voice, and an
-- admin (Eimear or Marc) presses Send. Nothing here sends anything. Service role only: the admin API
-- routes check the signed-in admin and read through the service role, so no signed-in user can read
-- this table directly.

CREATE TABLE IF NOT EXISTS public.lead_dm_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CRM ids (text, not UUIDs).
  conversation_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  contact_name TEXT,
  profile_photo TEXT,
  -- The newest inbound Instagram message this draft answers, and when it arrived.
  inbound_message_id TEXT NOT NULL,
  inbound_at TIMESTAMPTZ NOT NULL,
  inbound_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'ready', 'needs_marc', 'skipped', 'sent', 'edited_sent', 'dismissed', 'superseded', 'expired', 'failed'
  )),
  -- Eimear pressed "Leave for Marc". Carried forward when a newer message replaces the draft.
  for_marc BOOLEAN NOT NULL DEFAULT FALSE,
  draft_text TEXT,
  final_text TEXT,
  needs_reason TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_pence NUMERIC(12, 4),
  attempts INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  send_claimed_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  error_message TEXT,
  crm_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (conversation_id, inbound_message_id)
);

-- One open draft per conversation.
CREATE UNIQUE INDEX IF NOT EXISTS lead_dm_drafts_one_open
  ON public.lead_dm_drafts(conversation_id)
  WHERE status IN ('pending', 'ready', 'needs_marc', 'skipped');

CREATE INDEX IF NOT EXISTS lead_dm_drafts_due
  ON public.lead_dm_drafts(due_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS lead_dm_drafts_open_inbound
  ON public.lead_dm_drafts(inbound_at DESC)
  WHERE status IN ('pending', 'ready', 'needs_marc', 'skipped');

ALTER TABLE public.lead_dm_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_dm_drafts FROM anon, authenticated;

-- Claim pending drafts whose debounce has passed (skips rows another run is writing).
CREATE OR REPLACE FUNCTION public.claim_due_lead_dm_drafts(p_limit INTEGER)
RETURNS SETOF public.lead_dm_drafts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.lead_dm_drafts d
     SET claimed_at = NOW(), attempts = d.attempts + 1
   WHERE d.id IN (
     SELECT id FROM public.lead_dm_drafts
      WHERE status = 'pending'
        AND due_at <= NOW()
        AND attempts < 3
        AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '4 minutes')
      ORDER BY due_at
      LIMIT GREATEST(1, LEAST(p_limit, 10))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING d.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_lead_dm_drafts(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_lead_dm_drafts(INTEGER) TO service_role;

-- One cost log for every reply-draft model call: DM drafts log as 'lead_dm' (draft_id stays null; the
-- lead_dm_drafts row carries its own tokens and cost).
ALTER TABLE public.reply_draft_ai_calls DROP CONSTRAINT IF EXISTS reply_draft_ai_calls_purpose_check;
ALTER TABLE public.reply_draft_ai_calls
  ADD CONSTRAINT reply_draft_ai_calls_purpose_check CHECK (purpose IN ('draft', 'style_guide', 'lead_dm'));
