import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { percorsoFunzioneDisabilitata } from '@/lib/featureFlags';

export async function proxy(request: NextRequest) {
  const funzioneDisabilitata = percorsoFunzioneDisabilitata(request.nextUrl.pathname);
  if (funzioneDisabilitata) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: `La funzione ${funzioneDisabilitata} non è disponibile.` },
        { status: 404 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = `?funzione=${funzioneDisabilitata}-non-disponibile`;
    return NextResponse.redirect(url);
  }

  // Le API verificano identità e autorizzazioni nelle rispettive route.
  // Passano comunque dal proxy per applicare i feature flag qui sopra.
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
