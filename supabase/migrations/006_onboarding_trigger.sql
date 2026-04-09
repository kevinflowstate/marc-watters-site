-- Marc Watters Client Portal - Auto-assign Onboarding module to new clients
--
-- What this trigger does:
-- 1. Fires AFTER INSERT on public.client_profiles.
-- 2. Looks up the published training module titled exactly 'Onboarding'.
-- 3. Assigns that module to the new client in public.client_modules with:
--    - status = 'in_progress'
--    - started_at = NOW()
-- 4. If no published 'Onboarding' module exists, it raises a warning and exits
--    without blocking signup or manual client creation.
--
-- How to disable it if needed:
-- - Temporarily disable:
--   ALTER TABLE public.client_profiles DISABLE TRIGGER on_client_profile_created_assign_onboarding;
-- - Re-enable later:
--   ALTER TABLE public.client_profiles ENABLE TRIGGER on_client_profile_created_assign_onboarding;
-- - Or remove completely:
--   DROP TRIGGER IF EXISTS on_client_profile_created_assign_onboarding ON public.client_profiles;
--   DROP FUNCTION IF EXISTS public.assign_onboarding_module_to_client();
--
-- Important:
-- - Marc should ensure ONE published module is titled exactly 'Onboarding'.
-- - If multiple published modules share that title, this trigger will assign the
--   earliest matching row and ignore the others.

CREATE OR REPLACE FUNCTION public.assign_onboarding_module_to_client()
RETURNS TRIGGER AS $$
DECLARE
  onboarding_module_id UUID;
BEGIN
  SELECT tm.id
  INTO onboarding_module_id
  FROM public.training_modules tm
  WHERE tm.title = 'Onboarding'
    AND tm.is_published = true
  ORDER BY tm.created_at ASC, tm.id ASC
  LIMIT 1;

  IF onboarding_module_id IS NULL THEN
    RAISE WARNING 'No published training module titled "Onboarding" found for client_profile id %; skipping auto-assignment.',
      NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.client_modules (
    client_id,
    module_id,
    status,
    started_at
  )
  VALUES (
    NEW.id,
    onboarding_module_id,
    'in_progress',
    NOW()
  )
  ON CONFLICT (client_id, module_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_client_profile_created_assign_onboarding ON public.client_profiles;
CREATE TRIGGER on_client_profile_created_assign_onboarding
  AFTER INSERT ON public.client_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_onboarding_module_to_client();
