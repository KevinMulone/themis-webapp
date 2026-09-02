import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { googleConfigurato } from '@/lib/google/calendar';

/**
 * Dice all'interfaccia se questo sito ha le credenziali Google, prima che
 * qualcuno prema il bottone.
 *
 * Serve perché senza questa risposta il bottone "Collega Google Calendar"
 * sembra funzionante anche quando non può esserlo: si clicca, si viene
 * rimbalzati indietro, e l'unico modo di capire il perché è leggere un
 * messaggio comparso dopo. Meglio dirlo prima.
 *
 * Non restituisce mai le credenziali, solo se ci sono.
 */
export async function GET() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  return NextResponse.json({ configurato: googleConfigurato() });
}
