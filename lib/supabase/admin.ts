import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';

export function createAdminClient() {
  return createClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL')!,
    getEnv('SUPABASE_SERVICE_ROLE_KEY')!
  );
}
