import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';


export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const path = request.nextUrl.pathname;
  const isPortalRoot = hostname.startsWith('portal.') && path === '/';

  // Subdomain routing
  if (hostname.startsWith('calendar.')) {
    if (path === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/book-marc';
      return NextResponse.rewrite(url);
    }
  }

  if (hostname.startsWith('join.')) {
    // Root -> webinar opt-in page
    if (path === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/webinar';
      return NextResponse.rewrite(url);
    }
    // Allow webinar, pay, and book routes on join subdomain
    if (path.startsWith('/webinar') || path.startsWith('/pay/') || path.startsWith('/book')) {
      return NextResponse.next();
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL')!,
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!,
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

  let role: string | undefined;
  const requiresPasswordSetup = user?.user_metadata?.requires_password_setup === true;

  const needsRoleLookup =
    !!user &&
    (
      path === '/login' ||
      isPortalRoot ||
      path.startsWith('/portal') ||
      path.startsWith('/admin')
    );

  if (needsRoleLookup) {
    // Use service role key to bypass RLS for role lookup
    const adminSupabase = createServerClient(
      getEnv('NEXT_PUBLIC_SUPABASE_URL')!,
      getEnv('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        cookies: {
          getAll() { return []; },
          setAll() {},
        },
      }
    );

    const { data: profile } = await adminSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    role = profile?.role;
  }

  if (isPortalRoot) {
    const url = request.nextUrl.clone();
    url.pathname = !user ? '/login' : role === 'admin' ? '/admin' : '/portal';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (path === '/login' && user) {
    const requestedRedirect = request.nextUrl.searchParams.get('redirect');
    const safeRedirect =
      requestedRedirect &&
      requestedRedirect.startsWith('/') &&
      !requestedRedirect.startsWith('//')
        ? requestedRedirect
        : null;

    const url = request.nextUrl.clone();
    url.pathname = role === 'admin' ? '/admin' : safeRedirect || '/portal';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Protect portal and admin routes
  if ((path.startsWith('/portal') || path.startsWith('/admin')) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  // Role-based routing: admin sees admin, client sees portal, never cross
  if ((path.startsWith('/admin') || path.startsWith('/portal')) && user) {
    // First-login enforcement for clients created without a password
    if (path.startsWith('/portal') && role !== 'admin' && requiresPasswordSetup) {
      const isSettingsPage = path.startsWith('/portal/settings');
      const setupMode = request.nextUrl.searchParams.get('setup') === 'true';
      if (!isSettingsPage || !setupMode) {
        const url = request.nextUrl.clone();
        url.pathname = '/portal/settings';
        url.searchParams.set('setup', 'true');
        return NextResponse.redirect(url);
      }
    }

    // Admin trying to access portal -> redirect to admin
    if (path.startsWith('/portal') && role === 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }

    // Client (or unknown role) trying to access admin -> redirect to portal
    if (path.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/portal';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|start\\.html|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
