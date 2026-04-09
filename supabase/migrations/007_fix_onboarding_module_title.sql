-- Correct the onboarding auto-assignment trigger to match the real module title
-- used in Marc Watters's portal: 'Welcome & Onboarding'.

CREATE OR REPLACE FUNCTION public.assign_onboarding_module_to_client()
RETURNS TRIGGER AS $$
DECLARE
  onboarding_module_id UUID;
BEGIN
  SELECT tm.id
  INTO onboarding_module_id
  FROM public.training_modules tm
  WHERE tm.title = 'Welcome & Onboarding'
    AND tm.is_published = true
  ORDER BY tm.created_at ASC, tm.id ASC
  LIMIT 1;

  IF onboarding_module_id IS NULL THEN
    RAISE WARNING 'No published training module titled "Welcome & Onboarding" found for client_profile id %; skipping auto-assignment.',
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
