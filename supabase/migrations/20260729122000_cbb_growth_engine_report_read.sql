-- Add the concise strategic interpretation used in the Growth Engine report.
-- Existing reports remain valid and render without this optional section.

ALTER TABLE public.cbb_growth_reports
  ADD COLUMN IF NOT EXISTS strategic_takeaway text NOT NULL DEFAULT '';

ALTER TABLE public.cbb_growth_reports
  DROP CONSTRAINT IF EXISTS cbb_growth_reports_strategic_takeaway_length;

ALTER TABLE public.cbb_growth_reports
  ADD CONSTRAINT cbb_growth_reports_strategic_takeaway_length
  CHECK (char_length(strategic_takeaway) <= 3000);
