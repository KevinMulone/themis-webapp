import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { googleConfigurato, urlAutorizzazione } from '@/lib/google/calendar';

/**
 * Il link che porta al consenso di Google. È una GET (non una fetch da
 * JavaScript) perché deve finire in un vero cambio di pagina: l'utente
 * lascia Themis, autorizza su accounts.google.com, e torna sulla
 * callback — un giro che una richiesta fetch non può fare al posto suo.
 */
export async function GET() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.redirect(new URL('/accedi', process.env.NEXT_PUBLIC_SITE_URL));
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.redirect(new URL('/impostazioni?google=solo_titolare', process.env.NEXT_PUBLIC_SITE_URL));
  }
  if (!googleConfigurato()) {
    return NextResponse.redirect(new URL('/impostazioni?google=non_configurato', process.env.NEXT_PUBLIC_SITE_URL));
  }
  return NextResponse.redirect(urlAutorizzazione(contesto.studioId));
}
