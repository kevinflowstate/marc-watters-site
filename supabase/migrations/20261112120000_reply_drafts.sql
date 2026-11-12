-- AI reply drafts (approved by Kevin 12 Nov 2026).
-- The portal writes a draft reply in Marc's voice; an admin must press Send. Nothing here sends anything.
-- Costs are logged to reply_draft_ai_calls only: never to ai_usage, so Blueprint AI credits are untouched.

-- 1. Drafts -------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('inbox', 'checkin', 'checkin_followup')),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  -- 'inbox:<client_id>' or 'checkin:<checkin_id>'. One open draft per conversation.
  conversation_key TEXT NOT NULL,
  -- Latest client inbox message id, or the check-in id.
  ref_id UUID NOT NULL,
  checkin_id UUID REFERENCES public.checkins(id) ON DELETE CASCADE,
  source_message_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'ready', 'needs_marc', 'skipped', 'sent', 'edited_sent', 'discarded', 'superseded', 'failed'
  )),
  draft_text TEXT,
  final_text TEXT,
  needs_reason TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_pence NUMERIC(12, 4),
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  send_claimed_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS reply_drafts_one_open_per_conversation
  ON public.reply_drafts(conversation_key)
  WHERE status IN ('pending', 'ready', 'needs_marc', 'skipped');

CREATE INDEX IF NOT EXISTS reply_drafts_due
  ON public.reply_drafts(due_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS reply_drafts_client_created
  ON public.reply_drafts(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reply_drafts_decided
  ON public.reply_drafts(status, created_at DESC);

ALTER TABLE public.reply_drafts ENABLE ROW LEVEL SECURITY;

-- Admins only. Clients have no policy, so they can never read a draft.
CREATE POLICY "Admins can manage reply drafts" ON public.reply_drafts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Money and token figures stay out of reach of signed-in users, admins included. Kevin reads them via SQL.
REVOKE ALL ON public.reply_drafts FROM anon;
REVOKE SELECT, INSERT, UPDATE ON public.reply_drafts FROM authenticated;
GRANT SELECT (
  id, kind, client_id, conversation_key, ref_id, checkin_id, source_message_ids, status, draft_text,
  final_text, needs_reason, due_at, generated_at, created_at, decided_at, decided_by
) ON public.reply_drafts TO authenticated;
GRANT UPDATE (status, final_text, decided_at, decided_by) ON public.reply_drafts TO authenticated;

-- 2. Marc's style guide ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reply_style_guides (
  id TEXT PRIMARY KEY DEFAULT 'marc' CHECK (id = 'marc'),
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ,
  generated_from JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.reply_style_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage the reply style guide" ON public.reply_style_guides
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

REVOKE ALL ON public.reply_style_guides FROM anon;

-- 3. Per-admin push opt-in (no row = on) --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reply_draft_push_prefs (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reply_draft_push_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage their own reply draft push preference" ON public.reply_draft_push_prefs
  FOR ALL USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

REVOKE ALL ON public.reply_draft_push_prefs FROM anon;

-- 4. Cost log (service role only) ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reply_draft_ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL CHECK (purpose IN ('draft', 'style_guide')),
  draft_id UUID REFERENCES public.reply_drafts(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_pence NUMERIC(12, 4) NOT NULL DEFAULT 0,
  ok BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reply_draft_ai_calls_created ON public.reply_draft_ai_calls(created_at DESC);

ALTER TABLE public.reply_draft_ai_calls ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role can read or write it.
REVOKE ALL ON public.reply_draft_ai_calls FROM anon, authenticated;

CREATE OR REPLACE VIEW public.reply_draft_costs_monthly
WITH (security_invoker = true) AS
SELECT
  date_trunc('month', created_at AT TIME ZONE 'Europe/London')::date AS month,
  count(*) FILTER (WHERE purpose = 'draft') AS drafts,
  count(*) FILTER (WHERE purpose = 'style_guide') AS style_guide_builds,
  coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
  coalesce(sum(output_tokens), 0)::bigint AS output_tokens,
  round(coalesce(sum(cost_pence), 0), 2) AS cost_pence
FROM public.reply_draft_ai_calls
GROUP BY 1
ORDER BY 1 DESC;

REVOKE ALL ON public.reply_draft_costs_monthly FROM anon, authenticated;
GRANT SELECT ON public.reply_draft_costs_monthly TO service_role;

-- 5. Claiming due drafts for generation ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_due_reply_drafts(p_limit INTEGER DEFAULT 5)
RETURNS SETOF public.reply_drafts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.reply_drafts d
  SET claimed_at = NOW()
  WHERE d.id IN (
    SELECT id FROM public.reply_drafts
    WHERE status = 'pending'
      AND due_at <= NOW()
      AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '3 minutes')
    ORDER BY due_at
    LIMIT greatest(1, least(p_limit, 20))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING d.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_reply_drafts(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reply_drafts(INTEGER) TO service_role;

-- 6. Few-shot examples: Marc's real past replies to similar client messages ----------------------------
-- Postgres full-text search (english), OR-matched over the lexemes of the new client message.
-- Approved drafts (sent unchanged or edited) rank above raw history.

CREATE OR REPLACE FUNCTION public.reply_draft_examples(
  p_query TEXT,
  p_marc_user_id UUID,
  p_exclude_client_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (source TEXT, client_text TEXT, reply_text TEXT, rank REAL, replied_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT CASE WHEN count(*) = 0 THEN NULL
      ELSE to_tsquery('english', string_agg(quote_literal(lexeme) || ':*', ' | ')) END AS query
    FROM unnest(to_tsvector('english', left(coalesce(p_query, ''), 4000))) AS t(lexeme, positions, weights)
  ),
  marc_replies AS (
    SELECT r.id, r.client_id, r.message, r.created_at,
      (SELECT max(p.created_at) FROM inbox_messages p
        WHERE p.client_id = r.client_id AND p.sender_role = 'admin' AND p.created_at < r.created_at) AS prev_admin_at
    FROM inbox_messages r
    WHERE r.sender_role = 'admin'
      AND r.sender_user_id = p_marc_user_id
      AND length(trim(r.message)) > 0
  ),
  inbox_pairs AS (
    SELECT 'inbox'::text AS source, c.client_text, r.message AS reply_text, r.created_at AS replied_at
    FROM marc_replies r
    CROSS JOIN LATERAL (
      SELECT string_agg(m.message, E'\n' ORDER BY m.created_at) AS client_text
      FROM inbox_messages m
      WHERE m.client_id = r.client_id
        AND m.sender_role = 'client'
        AND m.created_at < r.created_at
        AND (r.prev_admin_at IS NULL OR m.created_at > r.prev_admin_at)
        AND length(trim(m.message)) > 0
    ) c
    WHERE c.client_text IS NOT NULL
      AND (p_exclude_client_id IS NULL OR r.client_id <> p_exclude_client_id)
  ),
  checkin_pairs AS (
    SELECT 'checkin'::text AS source,
      concat_ws(E'\n', ck.wins, ck.challenges, ck.questions,
        (SELECT string_agg(value, E'\n') FROM jsonb_each_text(coalesce(ck.responses, '{}'::jsonb)))) AS client_text,
      ck.admin_reply AS reply_text,
      coalesce(ck.replied_at, ck.created_at) AS replied_at
    FROM checkins ck
    WHERE ck.admin_reply IS NOT NULL AND length(trim(ck.admin_reply)) > 0
      AND (p_exclude_client_id IS NULL OR ck.client_id <> p_exclude_client_id)
  ),
  approved_pairs AS (
    SELECT 'approved'::text AS source,
      coalesce(
        (SELECT string_agg(m.message, E'\n' ORDER BY m.created_at) FROM inbox_messages m WHERE m.id = ANY(d.source_message_ids)),
        (SELECT concat_ws(E'\n', ck.wins, ck.challenges, ck.questions,
          (SELECT string_agg(value, E'\n') FROM jsonb_each_text(coalesce(ck.responses, '{}'::jsonb))))
          FROM checkins ck WHERE ck.id = d.checkin_id)
      ) AS client_text,
      d.final_text AS reply_text,
      d.decided_at AS replied_at
    FROM reply_drafts d
    WHERE d.status IN ('sent', 'edited_sent') AND d.final_text IS NOT NULL
      AND (p_exclude_client_id IS NULL OR d.client_id <> p_exclude_client_id)
  ),
  all_pairs AS (
    SELECT * FROM approved_pairs
    UNION ALL
    SELECT * FROM inbox_pairs
    UNION ALL
    SELECT * FROM checkin_pairs
  ),
  ranked AS (
    SELECT DISTINCT ON (a.reply_text) a.source, a.client_text, a.reply_text,
      (CASE WHEN q.query IS NULL THEN 0 ELSE ts_rank(to_tsvector('english', a.client_text), q.query) END
        * CASE WHEN a.source = 'approved' THEN 1.5 ELSE 1 END)::real AS rank,
      a.replied_at
    FROM all_pairs a CROSS JOIN q
    WHERE a.client_text IS NOT NULL AND a.reply_text IS NOT NULL
    ORDER BY a.reply_text, CASE WHEN a.source = 'approved' THEN 0 ELSE 1 END
  )
  SELECT source, left(client_text, 1500), left(reply_text, 1500), rank, replied_at
  FROM ranked
  ORDER BY rank DESC, replied_at DESC NULLS LAST
  LIMIT greatest(1, least(p_limit, 12));
$$;

REVOKE ALL ON FUNCTION public.reply_draft_examples(TEXT, UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reply_draft_examples(TEXT, UUID, UUID, INTEGER) TO service_role;
