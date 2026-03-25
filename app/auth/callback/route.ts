import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  }

  // If this is a recovery/password reset, redirect to settings so they can set password
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/portal/settings?setup=true`);
  }

  return NextResponse.redirect(`${origin}${redirect}`);
}
