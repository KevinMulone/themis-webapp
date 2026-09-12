import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { clientLabel } from '@/lib/constants';

type ClienteRef = {
  tipo_soggetto: string;
  nome: string | null;
  cognome: string | null;
  ragione_sociale: string | null;
};

export type RisultatoRicerca = {
  tipo: 'cliente' | 'pratica' | 'documento' | 'pec';
  id: string;
  titolo: string;
  sottotitolo: string;
  href: string;
};

function primo<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function termineSicuro(value: string): string {
  // La sintassi `.or()` di PostgREST usa questi caratteri come operatori.
  // Togliendoli, il testo resta una ricerca e non diventa parte del filtro.
  return value.replace(/[,().%_*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export async function GET(request: Request) {
  const ctx = await contestoStudio();
  if (!ctx) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const q = termineSicuro(new URL(request.url).searchParams.get('q') ?? '');
  if (q.length < 2) return NextResponse.json({ risultati: [] });
  const like = `%${q}%`;
  const supabase = await createClient();

  // Prima si cercano i clienti: i loro id permettono di trovare anche le
  // pratiche collegate quando l'utente digita il nome dell'assistito.
  // PostgREST non consente un OR affidabile fra colonne della tabella e
  // colonne della relazione annidata nella stessa query.
  const clienti = await supabase.from('clients')
    .select('id, tipo_soggetto, nome, cognome, ragione_sociale, codice_fiscale, partita_iva')
    .eq('studio_id', ctx.studioId).eq('archiviato', false)
    .or(`nome.ilike.${like},cognome.ilike.${like},ragione_sociale.ilike.${like},codice_fiscale.ilike.${like},partita_iva.ilike.${like}`)
    .limit(8);
  const clientIds = (clienti.data ?? []).map((c) => c.id);
  const filtroPratiche = [
    `rg_numero.ilike.${like}`,
    `numero_riferimento.ilike.${like}`,
    `controparte_nome.ilike.${like}`,
    ...(clientIds.length ? [`client_id.in.(${clientIds.join(',')})`] : []),
  ].join(',');

  const [pratiche, documenti, pec] = await Promise.all([
    supabase.from('matters')
      .select('id, tipo_pratica, rg_numero, rg_anno, numero_riferimento, controparte_nome, clients(tipo_soggetto, nome, cognome, ragione_sociale)')
      .eq('studio_id', ctx.studioId).neq('stato', 'archiviata')
      .or(filtroPratiche).limit(8),
    supabase.from('documenti')
      .select('id, nome_file, matter_id')
      .eq('studio_id', ctx.studioId).ilike('nome_file', like).limit(8),
    supabase.from('pec_messaggi')
      .select('id, oggetto, mittente, matter_id')
      .eq('studio_id', ctx.studioId).or(`oggetto.ilike.${like},mittente.ilike.${like}`)
      .limit(8),
  ]);

  const risultati: RisultatoRicerca[] = [];
  for (const c of clienti.data ?? []) {
    risultati.push({
      tipo: 'cliente', id: c.id, titolo: clientLabel(c),
      sottotitolo: c.codice_fiscale || c.partita_iva || 'Cliente',
      href: `/clienti?apri=${encodeURIComponent(c.id)}`,
    });
  }
  for (const m of pratiche.data ?? []) {
    const cliente = primo(m.clients as ClienteRef | ClienteRef[] | null);
    const riferimento = m.rg_numero
      ? `R.G. ${m.rg_numero}${m.rg_anno ? `/${m.rg_anno}` : ''}`
      : m.numero_riferimento ? `N. ${m.numero_riferimento}` : m.tipo_pratica;
    risultati.push({ tipo: 'pratica', id: m.id, titolo: clientLabel(cliente ?? undefined), sottotitolo: riferimento, href: `/pratiche/${m.id}` });
  }
  for (const d of documenti.data ?? []) {
    risultati.push({ tipo: 'documento', id: d.id, titolo: d.nome_file, sottotitolo: 'Documento', href: d.matter_id ? `/pratiche/${d.matter_id}` : '/pratiche' });
  }
  for (const m of pec.data ?? []) {
    risultati.push({ tipo: 'pec', id: m.id, titolo: m.oggetto || 'PEC senza oggetto', sottotitolo: m.mittente || 'Posta certificata', href: m.matter_id ? `/pratiche/${m.matter_id}` : '/pec' });
  }

  const errore = clienti.error || pratiche.error || documenti.error || pec.error;
  if (errore) {
    console.error('Ricerca globale incompleta:', errore.message);
  }
  return NextResponse.json({ risultati: risultati.slice(0, 18), incompleta: Boolean(errore) });
}
