-- Captions from Killen Studios' PDF caption docs (Kevin approved 17 Nov 2026).
-- Each PDF ("MW Short Captions - YT Video 61.pdf") is read once by Claude into its clips
-- ("Clip 1 – Title" + caption) and cached here by Drive file and checksum.

CREATE TABLE IF NOT EXISTS public.content_caption_docs (
  drive_file_id TEXT PRIMARY KEY,
  drive_md5 TEXT,
  name TEXT NOT NULL,
  month_id TEXT NOT NULL,
  -- Episode number from the doc name ("YT Video 61" -> 61); null when the name has none.
  episode INTEGER,
  -- [{ "number": 1, "title": "...", "caption": "..." }]
  clips JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'parsed' CHECK (status IN ('parsed', 'failed')),
  error TEXT,
  cost_pence NUMERIC(12, 4),
  parsed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.content_caption_docs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_caption_docs FROM anon, authenticated;
GRANT ALL ON public.content_caption_docs TO service_role;

-- Where each video sits in Drive, so captions can be offered from the same episode, and a title
-- taken from its caption ("Being Successful Shouldn't Consume Your Life" instead of "Video 01").
ALTER TABLE public.content_videos ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.content_videos ADD COLUMN IF NOT EXISTS drive_path TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.content_videos ADD COLUMN IF NOT EXISTS month_id TEXT;

ALTER TABLE public.reply_draft_ai_calls DROP CONSTRAINT IF EXISTS reply_draft_ai_calls_purpose_check;
ALTER TABLE public.reply_draft_ai_calls
  ADD CONSTRAINT reply_draft_ai_calls_purpose_check CHECK (purpose IN ('draft', 'style_guide', 'lead_dm', 'content_caption'));
