import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// TODO: Remove PREVIEW_MODE before go-live
const PREVIEW_MODE = true;

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const path = request.nextUrl.pathname;

  // Subdomain routing
  if (hostname.startsWith('calendar.')) {
    if (path === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/book-marc';
      return NextResponse.rewrite(url);
    }
  }

  if (hostname.startsWith('join.')) {
    if (path === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/join';
      return NextResponse.rewrite(url);
    }
    // Allow /pay/* routes on the join subdomain
    if (path.startsWith('/pay/')) {
      return NextResponse.next();
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Always refresh the session so API routes can read auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // In preview mode, skip auth enforcement but session is still refreshed
  if (PREVIEW_MODE) {
    return supabaseResponse;
  }

  // Protect portal and admin routes
  if ((path.startsWith('/portal') || path.startsWith('/admin')) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  // Admin routes - check role
  if (path.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/portal';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
