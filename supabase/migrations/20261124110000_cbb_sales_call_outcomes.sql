CREATE TABLE public.cbb_sales_call_outcomes (
  appointment_id text PRIMARY KEY CHECK(length(appointment_id) BETWEEN 1 AND 128),
  starts_at timestamptz NOT NULL,
  outcome text NOT NULL CHECK(outcome IN ('won','lost','follow_up','unqualified','no_show')),
  recorded_by uuid NOT NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cbb_sales_call_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cbb_sales_call_outcomes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cbb_sales_call_outcomes TO service_role;
CREATE TRIGGER cbb_sales_outcomes_updated BEFORE UPDATE ON public.cbb_sales_call_outcomes
FOR EACH ROW EXECUTE FUNCTION public.ops_set_updated_at();
