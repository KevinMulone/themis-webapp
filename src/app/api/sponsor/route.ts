import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('sponsors')
      .select('nome, url, logo_url, piano, pagato_fino')
      .eq('attivo', true)
      .gte('pagato_fino', new Date().toISOString().slice(0, 10))
      .order('piano', { ascending: true });

    if (error) return NextResponse.json({ sponsor: [] });
    const ordine = { main: 0, partner: 1, logo: 2 } as const;
    const lista = [...(data || [])].sort(
      (a, b) => (ordine[a.piano as keyof typeof ordine] ?? 9) - (ordine[b.piano as keyof typeof ordine] ?? 9),
    );
    return NextResponse.json({ sponsor: lista });
  } catch {
    return NextResponse.json({ sponsor: [] });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const nome = String(body.nome || '').trim();
  const email = String(body.email || '').trim();
  const piano = String(body.piano || '').trim();
  const messaggio = String(body.messaggio || '').trim();

  if (!nome || !email || !['logo', 'partner', 'main'].includes(piano)) {
    return NextResponse.json({ error: 'Compila nome, email e piano.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('sponsor_richieste').insert({
      nome, email, piano, messaggio: messaggio || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Richiesta non inviata. Riprova.' }, { status: 500 });
  }
}
