import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { impronta } from '@/lib/rfid';

export const runtime = 'nodejs';
export const maxDuration = 15;

type Stanza = { antenna: number; nome: string; attiva?: boolean; uscita?: boolean };
type Posizione = { epc: string; antenna: number; rssi?: number | null; dal: number; ultimo_visto: number };
type Movimento = { id: number; epc: string; da_antenna?: number | null; a_antenna: number; ts: number };

const EPC = /^[0-9A-F]{4,64}$/;

function istante(secondi: unknown): string | null {
  if (typeof secondi !== 'number' || !Number.isFinite(secondi) || secondi <= 0) return null;
  return new Date(secondi * 1000).toISOString();
}

/**
 * Qui l'app "Fascicoli RFID" del Mac manda quello che le antenne hanno
 * visto: le stanze (antenna → nome), l'ultima posizione di ogni etichetta e
 * gli spostamenti nuovi. La stanza la calcola il Mac; Themis registra.
 *
 * Non c'è una sessione utente: il Mac si presenta con il token del lettore
 * (Authorization: Bearer ...), creato dal titolare nella pagina Fascicoli
 * RFID. Dal token si risale allo studio, quindi un lettore può scrivere
 * solo nel proprio studio, qualunque cosa ci sia nel corpo della richiesta.
 */
export async function POST(request: Request) {
  const intestazione = request.headers.get('authorization') ?? '';
  const token = intestazione.startsWith('Bearer ') ? intestazione.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  const admin = createAdminClient();
  const { data: lettore } = await admin
    .from('rfid_lettori').select('id, studio_id, revocato_at')
    .eq('token_hash', impronta(token)).maybeSingle();
  if (!lettore || lettore.revocato_at) {
    return NextResponse.json({ error: 'Token del lettore non valido o revocato' }, { status: 401 });
  }

  const corpo = await request.json().catch(() => null);
  if (!corpo || typeof corpo !== 'object') {
    return NextResponse.json({ error: 'Richiesta malformata' }, { status: 400 });
  }
  const stanze: Stanza[] = Array.isArray(corpo.stanze) ? corpo.stanze.slice(0, 32) : [];
  const posizioni: Posizione[] = Array.isArray(corpo.posizioni) ? corpo.posizioni.slice(0, 2000) : [];
  const movimenti: Movimento[] = Array.isArray(corpo.movimenti) ? corpo.movimenti.slice(0, 500) : [];
  const studioId = lettore.studio_id as string;

  const righeStanze = stanze
    .filter((s) => Number.isInteger(s?.antenna) && typeof s.nome === 'string' && s.nome.trim())
    .map((s) => ({
      lettore_id: lettore.id, studio_id: studioId, antenna: s.antenna,
      nome: s.nome.trim().slice(0, 80), attiva: s.attiva !== false, uscita: s.uscita === true,
    }));
  if (righeStanze.length) {
    const { error } = await admin.from('rfid_stanze').upsert(righeStanze, { onConflict: 'lettore_id,antenna' });
    if (error) return NextResponse.json({ error: 'Stanze non salvate' }, { status: 500 });
    await admin.from('rfid_stanze').delete()
      .eq('lettore_id', lettore.id)
      .not('antenna', 'in', `(${righeStanze.map((s) => s.antenna).join(',')})`);
  }

  // Il nome della stanza si salva insieme alla posizione e allo spostamento:
  // se domani l'antenna viene spostata in un'altra stanza, lo storico deve
  // continuare a dire dove stava il fascicolo allora.
  let nomi = new Map(righeStanze.map((s) => [s.antenna, s.nome]));
  if (!nomi.size) {
    const { data } = await admin.from('rfid_stanze').select('antenna, nome').eq('lettore_id', lettore.id);
    nomi = new Map((data ?? []).map((s) => [s.antenna as number, s.nome as string]));
  }
  const stanzaDi = (antenna: unknown) =>
    Number.isInteger(antenna) ? nomi.get(antenna as number) ?? `Antenna ${(antenna as number) + 1}` : null;

  const righePosizioni = posizioni
    .map((p) => ({ p, epc: typeof p?.epc === 'string' ? p.epc.toUpperCase() : '' }))
    .filter(({ p, epc }) => EPC.test(epc) && Number.isInteger(p.antenna) && istante(p.dal) && istante(p.ultimo_visto))
    .map(({ p, epc }) => ({
      studio_id: studioId, epc, lettore_id: lettore.id, antenna: p.antenna, stanza: stanzaDi(p.antenna),
      rssi: Number.isInteger(p.rssi) ? p.rssi : null, dal: istante(p.dal)!, ultimo_visto: istante(p.ultimo_visto)!,
    }));
  if (righePosizioni.length) {
    const { error } = await admin.from('rfid_posizioni').upsert(righePosizioni, { onConflict: 'studio_id,epc' });
    if (error) return NextResponse.json({ error: 'Posizioni non salvate' }, { status: 500 });
  }

  const righeMovimenti = movimenti
    .map((m) => ({ m, epc: typeof m?.epc === 'string' ? m.epc.toUpperCase() : '' }))
    .filter(({ m, epc }) => EPC.test(epc) && Number.isInteger(m.id) && Number.isInteger(m.a_antenna) && istante(m.ts))
    .map(({ m, epc }) => ({
      studio_id: studioId, lettore_id: lettore.id, id_locale: m.id, epc,
      da_stanza: stanzaDi(m.da_antenna), a_stanza: stanzaDi(m.a_antenna), ts: istante(m.ts)!,
    }));
  if (righeMovimenti.length) {
    const { error } = await admin.from('rfid_movimenti')
      .upsert(righeMovimenti, { onConflict: 'lettore_id,id_locale', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'Spostamenti non salvati' }, { status: 500 });
  }

  await admin.from('rfid_lettori').update({ ultimo_contatto: new Date().toISOString() }).eq('id', lettore.id);

  return NextResponse.json({
    ok: true,
    stanze: righeStanze.length, posizioni: righePosizioni.length, movimenti: righeMovimenti.length,
  });
}
