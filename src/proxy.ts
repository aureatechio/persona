import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://sobfplitrzgggzqsycew.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTY4NTgsImV4cCI6MjA4Mzg5Mjg1OH0.0UOS6R0j7QwO6N7QIgrksA9iXr_82kL2a1QGjdTlsGA';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // CRITICAL: getUser() validates the token with the Supabase server
  // and automatically refreshes expired tokens via the setAll callback.
  // This keeps the session alive across page reloads.
  // DO NOT replace with getSession() — it only reads cookies without validation.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  console.log(`[Proxy] ${request.nextUrl.pathname} → user: ${user?.email ?? 'none'}, error: ${userError?.message ?? 'none'}`);

  const { pathname } = request.nextUrl;

  // Skip auth for API routes and arena pages
  const isApiRoute = pathname.startsWith('/api');
  const isPublicRoute = pathname === '/' || pathname === '/arena-eleitoral' || pathname === '/analise-redes' || pathname === '/mapeamento-instagram' || pathname === '/selfie-video' || pathname.startsWith('/selfie-video/monitor') || pathname.startsWith('/admin/video-modelo');
  if (isApiRoute || isPublicRoute) {
    return response;
  }

  const isLoginPage = pathname === '/login';

  // Not logged in and not on login → redirect to login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Logged in and on login page → redirect to home
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Static assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
