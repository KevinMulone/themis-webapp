import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { tipoAtto } from '@/lib/ai/tipiAtto';

/**
 * Il riscontro su una bozza, non la bozza stessa.
 *
 * Un "sì" non scrive nulla di nuovo da riproporre: un pregio non è
 * un'istruzione, è solo il segno che lo scheletro attuale va bene così.
 * Un "no" con una nota, invece, entra nel prompt della prossima bozza
 * dello stesso tipo per questo studio — vedi la lettura in
 * lib/ai/tipiAtto.ts o direttamente in api/themis/bozza/route.ts.
 */
export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { matterId, tipo, buono, nota } = await request.json();
  if (typeof tipo !== 'string' || typeof buono !== 'boolean') {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
  }
  if (!tipoAtto(tipo)) return NextResponse.json({ error: 'Tipo di atto non riconosciuto' }, { status: 400 });
  if (!buono && (typeof nota !== 'string' || !nota.trim())) {
    return NextResponse.json({ error: 'Indica cosa cambieresti' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('atto_feedback').insert({
    studio_id: contesto.studioId,
    matter_id: typeof matterId === 'string' ? matterId : null,
    tipo_atto: tipo,
    buono,
    nota: buono ? null : nota.trim().slice(0, 2000),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
