import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Esclude anche /api/*: le route API (incluse le funzioni Python come
    // /api/generate) verificano l'identità da sole — via cookie quelle
    // Next.js, via un access_token nel corpo della richiesta quelle Python,
    // che non vedono i cookie del browser. Il proxy le lascia passare sempre.
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
