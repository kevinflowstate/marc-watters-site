-- Expand each enrolled client's workspace with the strategy and implementation
-- structure shown in the Flowstate operating portal.

ALTER TABLE public.cbb_growth_workspaces
  ADD COLUMN IF NOT EXISTS strategy_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS implementation_milestones jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.cbb_growth_workspaces
  DROP CONSTRAINT IF EXISTS cbb_growth_workspaces_strategy_title_length,
  DROP CONSTRAINT IF EXISTS cbb_growth_workspaces_milestones_array;

ALTER TABLE public.cbb_growth_workspaces
  ADD CONSTRAINT cbb_growth_workspaces_strategy_title_length
    CHECK (char_length(strategy_title) <= 180),
  ADD CONSTRAINT cbb_growth_workspaces_milestones_array
    CHECK (jsonb_typeof(implementation_milestones) = 'array');
