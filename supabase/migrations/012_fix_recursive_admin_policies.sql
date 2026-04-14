-- Fix recursive RLS admin checks by routing them through a SECURITY DEFINER helper.
-- This resolves PostgREST 500s such as:
--   {"code":"42P17","message":"infinite recursion detected in policy for relation \"users\""}

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all users" ON public.users';
    EXECUTE 'CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (public.is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update users" ON public.users';
    EXECUTE 'CREATE POLICY "Admins can update users" ON public.users FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.client_profiles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all client profiles" ON public.client_profiles';
    EXECUTE 'CREATE POLICY "Admins can manage all client profiles" ON public.client_profiles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.training_modules') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all modules" ON public.training_modules';
    EXECUTE 'CREATE POLICY "Admins can manage all modules" ON public.training_modules FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.module_content') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all content" ON public.module_content';
    EXECUTE 'CREATE POLICY "Admins can manage all content" ON public.module_content FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.client_modules') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all module assignments" ON public.client_modules';
    EXECUTE 'CREATE POLICY "Admins can manage all module assignments" ON public.client_modules FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.content_progress') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all progress" ON public.content_progress';
    EXECUTE 'CREATE POLICY "Admins can view all progress" ON public.content_progress FOR SELECT USING (public.is_admin())';
  END IF;

  IF to_regclass('public.checkins') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all checkins" ON public.checkins';
    EXECUTE 'CREATE POLICY "Admins can manage all checkins" ON public.checkins FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications';
    EXECUTE 'CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.form_config') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage form config" ON public.form_config';
    EXECUTE 'CREATE POLICY "Admins can manage form config" ON public.form_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.business_plans') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all business plans" ON public.business_plans';
    EXECUTE 'CREATE POLICY "Admins can manage all business plans" ON public.business_plans FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.business_plan_phases') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all phases" ON public.business_plan_phases';
    EXECUTE 'CREATE POLICY "Admins can manage all phases" ON public.business_plan_phases FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.business_plan_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all plan items" ON public.business_plan_items';
    EXECUTE 'CREATE POLICY "Admins can manage all plan items" ON public.business_plan_items FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.phase_training_links') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all training links" ON public.phase_training_links';
    EXECUTE 'CREATE POLICY "Admins can manage all training links" ON public.phase_training_links FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.internal_notes') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all internal notes" ON public.internal_notes';
    EXECUTE 'CREATE POLICY "Admins can manage all internal notes" ON public.internal_notes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.client_questionnaires') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all questionnaires" ON public.client_questionnaires';
    EXECUTE 'CREATE POLICY "Admins can manage all questionnaires" ON public.client_questionnaires FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.client_monthly_metrics') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all monthly metrics" ON public.client_monthly_metrics';
    EXECUTE 'CREATE POLICY "Admins can manage all monthly metrics" ON public.client_monthly_metrics FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  IF to_regclass('public.client_invites') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage client invites" ON public.client_invites';
    EXECUTE 'CREATE POLICY "Admins can manage client invites" ON public.client_invites FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END
$$;
