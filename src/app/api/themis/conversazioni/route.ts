import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';

const MessaggioSchema = z.object({
  matterId: z.string().uuid(),
  conversazioneId: z.string().uuid().nullable().optional(),
  ruolo: z.enum(['utente', 'themis']),
  testo: z.string().trim().min(1).max(50_000),
  citazioni: z.array(z.object({
    documento: z.string().nullable(), testo: z.string().nullable(), pagina: z.number().nullable(),
  })).max(100).optional(),
});

export async function GET(request: Request) {
  const ctx = await contestoStudio();
  if (!ctx) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const matterId = new URL(request.url).searchParams.get('matterId');
  if (!matterId || !z.string().uuid().safeParse(matterId).success) {
    return NextResponse.json({ error: 'Pratica non valida' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: conversazione, error } = await supabase.from('themis_conversazioni')
    .select('id, titolo, updated_at').eq('matter_id', matterId)
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ conversazione: null, messaggi: [], disponibile: false });
  if (!conversazione) return NextResponse.json({ conversazione: null, messaggi: [], disponibile: true });
  const { data: messaggi } = await supabase.from('themis_messaggi')
    .select('ruolo, testo, citazioni').eq('conversazione_id', conversazione.id).order('created_at');
  return NextResponse.json({ conversazione, messaggi: messaggi ?? [], disponibile: true });
}

export async function POST(request: Request) {
  const ctx = await contestoStudio();
  if (!ctx) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const parsed = MessaggioSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Messaggio non valido' }, { status: 400 });
  const supabase = await createClient();
  const { data: matter } = await supabase.from('matters').select('id').eq('id', parsed.data.matterId).single();
  if (!matter) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 });

  let conversazioneId = parsed.data.conversazioneId ?? null;
  if (!conversazioneId) {
    const titolo = parsed.data.testo.slice(0, 70);
    const { data, error } = await supabase.from('themis_conversazioni').insert({
      studio_id: ctx.studioId, matter_id: parsed.data.matterId, creato_da: ctx.userId, titolo,
    }).select('id').single();
    if (error || !data) return NextResponse.json({ error: 'Storico non disponibile' }, { status: 503 });
    conversazioneId = data.id;
  }
  const { error } = await supabase.from('themis_messaggi').insert({
    conversazione_id: conversazioneId, studio_id: ctx.studioId, ruolo: parsed.data.ruolo,
    testo: parsed.data.testo, citazioni: parsed.data.citazioni ?? [],
  });
  if (error) return NextResponse.json({ error: 'Storico non disponibile' }, { status: 503 });
  await supabase.from('themis_conversazioni').update({ updated_at: new Date().toISOString() }).eq('id', conversazioneId);
  return NextResponse.json({ ok: true, conversazioneId });
}
