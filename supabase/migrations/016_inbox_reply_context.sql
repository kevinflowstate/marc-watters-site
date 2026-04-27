ALTER TABLE public.inbox_messages
ADD COLUMN IF NOT EXISTS reply_context JSONB NOT NULL DEFAULT '{}'::jsonb;
