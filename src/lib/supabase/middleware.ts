import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/accedi')
    || request.nextUrl.pathname.startsWith('/registrati')
    || request.nextUrl.pathname.startsWith('/attiva')
    || request.nextUrl.pathname.startsWith('/reimposta-password')
    || request.nextUrl.pathname.startsWith('/unisciti')
    || request.nextUrl.pathname.startsWith('/account-sospeso');
  const isPublicRoute = request.nextUrl.pathname === '/'
    || request.nextUrl.pathname.startsWith('/portale')
    || request.nextUrl.pathname.startsWith('/politica-rimborsi');
  // Le route API (comprese le funzioni Python come /api/generate) gestiscono
  // da sole l'autenticazione — via cookie per quelle Next.js, via un
  // access_token nel corpo della richiesta per quelle Python, che non hanno
  // accesso ai cookie della sessione browser. Un redirect qui le romperebbe
  // sempre, dato che questa richiesta non porta con sé i cookie del browser.
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  if (!user && !isAuthRoute && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/accedi';
    return NextResponse.redirect(url);
  }

  return response;
}
