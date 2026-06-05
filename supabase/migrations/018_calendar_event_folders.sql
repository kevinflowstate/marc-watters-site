ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT 'General';

CREATE INDEX IF NOT EXISTS idx_calendar_events_folder
  ON public.calendar_events(folder);
