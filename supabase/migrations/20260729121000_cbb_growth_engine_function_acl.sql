-- Supabase may materialize default function grants for the API roles.
-- Keep the RLS helper functions available to signed-in users while removing
-- anonymous RPC execution explicitly.

REVOKE ALL ON FUNCTION public.current_user_is_growth_manager() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_has_active_entitlement(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_user_is_growth_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_has_active_entitlement(uuid, text) TO authenticated;
