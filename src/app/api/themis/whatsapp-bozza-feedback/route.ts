import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';

/**
 * Il riscontro su una bozza di risposta WhatsApp — stesso meccanismo di
 * /api/themis/atto-feedback, applicato qui: un "sì" non scrive nulla, un
 * "no" con una nota entra nel prompt delle bozze WhatsApp successive per
 * questo studio (vedi la lettura in api/themis/whatsapp/route.ts).
 */
export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { buono, nota } = await request.json();
  if (typeof buono !== 'boolean') return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
  if (!buono && (typeof nota !== 'string' || !nota.trim())) {
    return NextResponse.json({ error: 'Indica cosa cambieresti' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('whatsapp_bozza_feedback').insert({
    studio_id: contesto.studioId,
    buono,
    nota: buono ? null : nota.trim().slice(0, 2000),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
