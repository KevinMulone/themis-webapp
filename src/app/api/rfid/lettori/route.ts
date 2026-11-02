import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';
import { nuovoTokenLettore } from '@/lib/rfid';

/**
 * Collega un nuovo lettore RFID allo studio e ne restituisce il token.
 * È l'unica volta in cui il token esiste in chiaro: va incollato nell'app
 * del Mac, poi qui resta solo la sua impronta.
 */
export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può collegare un lettore' }, { status: 403 });
  }

  const corpo = await request.json().catch(() => ({}));
  const nome = typeof corpo?.nome === 'string' && corpo.nome.trim() ? corpo.nome.trim().slice(0, 80) : 'Lettore dello studio';
  const { token, hash, inizio } = nuovoTokenLettore();

  const admin = createAdminClient();
  const { data, error } = await admin.from('rfid_lettori')
    .insert({ studio_id: contesto.studioId, nome, token_hash: hash, token_inizio: inizio })
    .select('id').single();
  if (error || !data) return NextResponse.json({ error: 'Lettore non creato' }, { status: 500 });

  return NextResponse.json({ id: data.id, nome, token });
}
