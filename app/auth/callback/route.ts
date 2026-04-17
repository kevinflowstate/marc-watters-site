import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'recovery' | 'magiclink' | 'signup' | 'invite' | 'email';
  const rawRedirect = searchParams.get('redirect') || '/portal';
  // Validate redirect to prevent open redirect attacks:
  // must start with "/" and must not start with "//" (protocol-relative URL)
  const redirect = (rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')) ? rawRedirect : '/portal';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL')!,
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  let authError: string | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) authError = error.message;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) authError = error.message;
  }

  if (authError) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'setup_link_invalid');
    return NextResponse.redirect(loginUrl);
  }

  // If this is a recovery/password reset, redirect to settings so they can set password
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/portal/settings?setup=true`);
  }

  return NextResponse.redirect(`${origin}${redirect}`);
}
