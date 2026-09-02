'use client';

import CampoComune from './CampoComune';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { TIPI_SOGGETTO, TIPI_PRATICA, labelFromOptions, clientLabel } from '@/lib/constants';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

type Client = {
  id: string;
  tipo_soggetto: string;
  nome: string | null;
  cognome: string | null;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
  data_nascita: string | null;
  luogo_nascita: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  pec: string | null;
  note: string | null;
  archiviato: boolean;
};

const EMPTY: Partial<Client> = { tipo_soggetto: 'persona_fisica' };

type ColonnaOrdinabile = 'nome' | 'codice' | 'telefono' | 'email' | 'citta';

function valoreColonna(c: Client, campo: ColonnaOrdinabile): string {
  if (campo === 'nome') return clientLabel(c);
  if (campo === 'codice') return c.codice_fiscale || c.partita_iva || '';
  if (campo === 'telefono') return c.telefono || '';
  if (campo === 'email') return c.email || '';
  return c.citta || '';
}

/** Le iniziali nel tondo accanto al nome. */
function inizialiCliente(c: Client): string {
  const base = clientLabel(c).trim();
  const parti = base.split(/\s+/).filter(Boolean);
  if (parti.length >= 2) return (parti[0][0] + parti[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/** Una tessera del riepilogo in cima all'elenco. */
function TesseraConteggio({ icona, tinta, valore, etichetta }: {
  icona: NomeIcona; tinta: string; valore: number | string; etichetta: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tinta}`}>
        <Icon nome={icona} className="h-5 w-5" />
      </span>
      <div>
        <div className="text-xl font-bold text-neutral-900">{valore}</div>
        <div className="text-xs text-neutral-500">{etichetta}</div>
      </div>
    </div>
  );
}

/** L'intestazione di una colonna ordinabile. */
function Colonna({ campo, etichetta, ordine, onClick, className = '' }: {
  campo: ColonnaOrdinabile; etichetta: string;
  ordine: { campo: ColonnaOrdinabile; verso: 'asc' | 'desc' };
  onClick: (c: ColonnaOrdinabile) => void; className?: string;
}) {
  const attiva = ordine.campo === campo;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onClick(campo)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          attiva ? 'text-bordeaux-700' : 'text-neutral-500 hover:text-neutral-700'
        }`}
      >
        {etichetta}
        <span className="text-[9px] leading-none">
          {attiva ? (ordine.verso === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}

export default function ClientiPage() {
  const supabase = createClient();
  const { studioId } = useStudio();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [mostraArchiviati, setMostraArchiviati] = useState(false);
  const [editing, setEditing] = useState<Partial<Client> | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteModal, setInviteModal] = useState<{
    client: Partial<Client>; email: string; link: string | null; error: string | null; copied: boolean;
  } | null>(null);
  const [clientDocs, setClientDocs] = useState<{ id: string; nome_file: string; data_generazione: string; tipo_pratica: string }[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [mostraFiltri, setMostraFiltri] = useState(false);
  const [ordine, setOrdine] = useState<{ campo: ColonnaOrdinabile; verso: 'asc' | 'desc' }>({
    campo: 'nome', verso: 'asc',
  });
  const [pagina, setPagina] = useState(1);
  const [perPagina, setPerPagina] = useState(10);
  const [conteggi, setConteggi] = useState<{ attivi: number; archiviati: number; questoMese: number | null }>({
    attivi: 0, archiviati: 0, questoMese: null,
  });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('archiviato', mostraArchiviati)
      .order('cognome', { ascending: true });
    setClients(data || []);
    setLoading(false);
  }

  /**
   * I numeri in cima all'elenco.
   *
   * Le tre conte sono query separate e non una sola: se "creati questo
   * mese" fallisse — la colonna created_at potrebbe non esistere su
   * installazioni più vecchie — una query unica porterebbe via anche le
   * altre due. Così quella tessera semplicemente non compare, e il resto
   * della pagina non se ne accorge.
   */
  async function loadConteggi() {
    const inizioMese = new Date();
    inizioMese.setDate(1);
    const daIso = `${inizioMese.getFullYear()}-${String(inizioMese.getMonth() + 1).padStart(2, '0')}-01`;

    const [attivi, archiviati, mese] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('archiviato', false),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('archiviato', true),
      supabase.from('clients').select('id', { count: 'exact', head: true }).gte('created_at', daIso),
    ]);

    setConteggi({
      attivi: attivi.count ?? 0,
      archiviati: archiviati.count ?? 0,
      questoMese: mese.error ? null : (mese.count ?? 0),
    });
  }

  useEffect(() => { load(); }, [mostraArchiviati]);
  useEffect(() => { loadConteggi(); }, []);
  // Cambiando ricerca, filtro o elenco si torna alla prima pagina: restare
  // su pagina 4 quando i risultati sono diventati tre significa guardare
  // una tabella vuota e credere che non ci sia nulla.
  useEffect(() => { setPagina(1); }, [search, filtroTipo, mostraArchiviati, perPagina]);

  async function loadClientDocs(clientId: string) {
    setLoadingDocs(true);
    const { data } = await supabase
      .from('documenti')
      .select('id, nome_file, data_generazione, matters!inner(client_id, tipo_pratica)')
      .eq('matters.client_id', clientId)
      .order('data_generazione', { ascending: false });
    type Row = { id: string; nome_file: string; data_generazione: string; matters: { tipo_pratica: string } | { tipo_pratica: string }[] };
    setClientDocs(
      ((data as Row[]) || []).map((d) => ({
        id: d.id,
        nome_file: d.nome_file,
        data_generazione: d.data_generazione,
        tipo_pratica: Array.isArray(d.matters) ? d.matters[0]?.tipo_pratica : d.matters.tipo_pratica,
      })),
    );
    setLoadingDocs(false);
  }

  function openEdit(c: Partial<Client>) {
    setEditing(c);
    setClientDocs([]);
    if (c.id) loadClientDocs(c.id);
  }

  const filtered = clients
    .filter((c) => {
      if (filtroTipo && c.tipo_soggetto !== filtroTipo) return false;
      if (!search) return true;
      const haystack = [c.nome, c.cognome, c.ragione_sociale, c.codice_fiscale, c.partita_iva, c.email, c.telefono]
        .join(' ').toLowerCase();
      return haystack.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const va = (valoreColonna(a, ordine.campo) || '').toLowerCase();
      const vb = (valoreColonna(b, ordine.campo) || '').toLowerCase();
      // I vuoti in fondo in entrambi i versi: un cliente senza email non
      // deve occupare le prime righe solo perché la stringa vuota viene
      // prima di tutto in ordine alfabetico.
      if (!va && vb) return 1;
      if (va && !vb) return -1;
      const cmp = va.localeCompare(vb, 'it');
      return ordine.verso === 'asc' ? cmp : -cmp;
    });

  const pagine = Math.max(1, Math.ceil(filtered.length / perPagina));
  const paginaCorrente = Math.min(pagina, pagine);
  const visibili = filtered.slice((paginaCorrente - 1) * perPagina, paginaCorrente * perPagina);

  function cambiaOrdine(campo: ColonnaOrdinabile) {
    setOrdine((o) => o.campo === campo
      ? { campo, verso: o.verso === 'asc' ? 'desc' : 'asc' }
      : { campo, verso: 'asc' });
  }

  /**
   * Esporta in CSV quello che è visibile, non tutto il database.
   *
   * Se hai cercato "Mannarino" e premi Esporta, ti aspetti Mannarino:
   * esportare l'intero elenco sarebbe una sorpresa, e su dati di clienti
   * le sorprese non vanno bene.
   */
  function esportaCsv() {
    const intestazioni = ['Nome', 'Tipo', 'Codice fiscale', 'Partita IVA', 'Telefono', 'Email', 'PEC', 'Indirizzo', 'CAP', 'Città', 'Provincia'];
    const righe = filtered.map((c) => [
      clientLabel(c), labelFromOptions(TIPI_SOGGETTO, c.tipo_soggetto),
      c.codice_fiscale, c.partita_iva, c.telefono, c.email, c.pec,
      c.indirizzo, c.cap, c.citta, c.provincia,
    ]);
    const csv = [intestazioni, ...righe]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    // Il segno di ordine dei byte serve a Excel per riconoscere l'UTF-8:
    // senza, gli accenti dei nomi italiani escono illeggibili.
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clienti-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    form.forEach((value, key) => { payload[key] = value === '' ? null : value; });

    if (editing?.id) {
      await supabase.from('clients').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('clients').insert({ ...payload, studio_id: studioId });
    }
    setEditing(null);
    load();
  }

  async function handleArchive(id: string) {
    if (!confirm('Archiviare questo cliente?')) return;
    await supabase.from('clients').update({ archiviato: true }).eq('id', id);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm(
      'Eliminare definitivamente questo cliente?\n\n' +
      'ATTENZIONE: verranno cancellate per sempre anche tutte le sue pratiche e i documenti ' +
      'generati collegati. Non è reversibile.\n\n' +
      'Se vuoi solo nasconderlo dall\'elenco mantenendo lo storico, usa "Archivia" invece.',
    )) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') {
        alert('Impossibile eliminare: questo cliente ha pratiche o documenti collegati. Elimina prima quelli, oppure usa "Archivia".');
      } else {
        alert(error.message);
      }
      return;
    }
    setEditing(null);
    load();
  }

  function handleInvitePortal(client: Partial<Client>) {
    if (!client.id) return;
    setInviteModal({ client, email: client.email || '', link: null, error: null, copied: false });
  }

  async function handleGenerateInviteLink() {
    if (!inviteModal || !inviteModal.client.id) return;
    const email = inviteModal.email.trim();
    if (!email) { setInviteModal({ ...inviteModal, error: 'Inserisci un indirizzo email.' }); return; }
    const code = crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase.from('portal_invites').insert({
      studio_id: studioId, code, client_id: inviteModal.client.id, nome_cliente: clientLabel(inviteModal.client), email,
    });
    if (error) { setInviteModal({ ...inviteModal, error: error.message }); return; }
    const link = `${window.location.origin}/portale?invite=${code}`;
    setInviteModal({ ...inviteModal, email, link, error: null, copied: false });
  }

  async function handleCopyInviteLink() {
    if (!inviteModal?.link) return;
    try {
      await navigator.clipboard.writeText(inviteModal.link);
      setInviteModal({ ...inviteModal, copied: true });
    } catch {
      setInviteModal({ ...inviteModal, error: 'Copia non riuscita: seleziona e copia il link manualmente.' });
    }
  }

  const isPF = (editing?.tipo_soggetto ?? 'persona_fisica') === 'persona_fisica';

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-neutral-900">Clienti</h1>
          <p className="mt-1 text-sm text-neutral-500">Gestisci e consulta tutti i tuoi clienti.</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="flex items-center gap-2 rounded-lg bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bordeaux-800"
        >
          <Icon nome="piu" className="h-4 w-4" />
          Nuovo cliente
        </button>
      </div>

      <div className="mb-4 rounded-2xl bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Icon nome="clienti" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400" />
            <input
              className="w-full rounded-lg border border-transparent bg-neutral-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              placeholder="Cerca per nome, cognome, ragione sociale, CF, P.IVA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={() => setMostraFiltri(!mostraFiltri)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
              filtroTipo
                ? 'border-bordeaux-700 text-bordeaux-700'
                : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Icon nome="attivita" className="h-4 w-4" />
            Filtri
            {filtroTipo && <span className="rounded-full bg-bordeaux-700 px-1.5 text-[10px] text-white">1</span>}
          </button>

          {/* Due elenchi distinti, non un filtro che li mescola: un cliente
              archiviato non deve comparire per sbaglio in una ricerca
              ordinaria. */}
          <button
            type="button"
            onClick={() => setMostraArchiviati(!mostraArchiviati)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
              mostraArchiviati
                ? 'border-bordeaux-700 bg-bordeaux-700 text-white'
                : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Icon nome="documento" className="h-4 w-4" />
            {mostraArchiviati ? 'Torna agli attivi' : 'Archiviati'}
          </button>

          <button
            type="button"
            onClick={esportaCsv}
            disabled={filtered.length === 0}
            title="Esporta in CSV i clienti attualmente elencati"
            className="ml-auto flex shrink-0 items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            <Icon nome="genera" className="h-4 w-4" />
            Esporta
          </button>
        </div>

        {mostraFiltri && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
            <span className="text-xs font-medium text-neutral-500">Tipo di soggetto:</span>
            <button
              type="button" onClick={() => setFiltroTipo('')}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filtroTipo === '' ? 'bg-bordeaux-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Tutti
            </button>
            {TIPI_SOGGETTO.map(([valore, etichetta]) => (
              <button
                key={valore} type="button" onClick={() => setFiltroTipo(valore)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filtroTipo === valore ? 'bg-bordeaux-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {etichetta}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4 lg:grid-cols-4 lg:divide-x lg:divide-neutral-100">
          <TesseraConteggio
            icona="clienti" tinta="bg-violet-50 text-violet-500"
            valore={conteggi.attivi + conteggi.archiviati} etichetta="Totale clienti"
          />
          <div className="lg:pl-4">
            <TesseraConteggio
              icona="collaboratori" tinta="bg-emerald-50 text-emerald-500"
              valore={conteggi.attivi} etichetta="Clienti attivi"
            />
          </div>
          <div className="lg:pl-4">
            <TesseraConteggio
              icona="documento" tinta="bg-amber-50 text-amber-500"
              valore={conteggi.archiviati} etichetta="Clienti archiviati"
            />
          </div>
          {/* La tessera compare solo se la conta è riuscita: su installazioni
              senza la colonna created_at mostrare "0" sarebbe una bugia. */}
          {conteggi.questoMese !== null && (
            <div className="lg:pl-4">
              <TesseraConteggio
                icona="calendario" tinta="bg-sky-50 text-sky-500"
                valore={conteggi.questoMese} etichetta="Clienti creati questo mese"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-neutral-50 p-6 text-sm text-neutral-500">
          Caricamento...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-neutral-50 py-16 text-center">
          <Icon nome="clienti" className="mx-auto h-10 w-10 text-neutral-200" />
          <p className="mt-3 text-sm text-neutral-500">
            {search || filtroTipo ? 'Nessun cliente corrisponde alla ricerca.' : 'Nessun cliente ancora.'}
          </p>
          {!search && !filtroTipo && !mostraArchiviati && (
            <button
              onClick={() => setEditing({ ...EMPTY })}
              className="mt-3 text-sm font-medium text-bordeaux-700 hover:underline"
            >
              Aggiungi il primo cliente
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-neutral-50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b border-neutral-100 text-left">
                <tr>
                  <Colonna campo="nome" etichetta="Nome" ordine={ordine} onClick={cambiaOrdine} />
                  <Colonna campo="codice" etichetta="CF / P.IVA" ordine={ordine} onClick={cambiaOrdine} />
                  <Colonna campo="telefono" etichetta="Telefono" ordine={ordine} onClick={cambiaOrdine} />
                  <Colonna campo="email" etichetta="Email" ordine={ordine} onClick={cambiaOrdine} />
                  <Colonna campo="citta" etichetta="Città" ordine={ordine} onClick={cambiaOrdine} />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Stato</th>
                </tr>
              </thead>
              <tbody>
                {visibili.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-neutral-50 last:border-0 hover:bg-neutral-50"
                    onClick={() => openEdit(c)}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bordeaux-50 text-xs font-semibold text-bordeaux-700">
                          {inizialiCliente(c)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-neutral-900">{clientLabel(c)}</span>
                          <span className="mt-0.5 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                            {labelFromOptions(TIPI_SOGGETTO, c.tipo_soggetto)}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{c.codice_fiscale || c.partita_iva || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {c.telefono ? (
                        <span className="flex items-center gap-1.5">
                          <Icon nome="utente" className="h-3.5 w-3.5 text-neutral-300" />
                          {c.telefono}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {c.email ? (
                        <span className="flex items-center gap-1.5">
                          <Icon nome="pec" className="h-3.5 w-3.5 text-neutral-300" />
                          <span className="truncate">{c.email}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{c.citta || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        c.archiviato ? 'bg-neutral-100 text-neutral-500' : 'bg-green-100 text-green-700'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${c.archiviato ? 'bg-neutral-400' : 'bg-green-500'}`} />
                        {c.archiviato ? 'Archiviato' : 'Attivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-sm text-neutral-500">
            <span className="flex items-center gap-2">
              Mostra
              <select
                value={perPagina}
                onChange={(e) => setPerPagina(Number(e.target.value))}
                className="rounded-lg border border-transparent bg-neutral-50 px-2 py-1 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              elementi
            </span>

            <span>
              {filtered.length === 0
                ? 'Nessun risultato'
                : `${(paginaCorrente - 1) * perPagina + 1}–${Math.min(paginaCorrente * perPagina, filtered.length)} di ${filtered.length} risultati`}
            </span>

            <span className="flex items-center gap-1">
              <button
                type="button" onClick={() => setPagina(paginaCorrente - 1)} disabled={paginaCorrente <= 1}
                aria-label="Pagina precedente"
                className="premi rounded-full bg-neutral-100 px-2 py-1 text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-neutral-100"
              >
                ‹
              </button>
              <span className="premi rounded-full bg-bordeaux-700 px-3 py-1 text-white">{paginaCorrente}</span>
              <span className="text-neutral-400">di {pagine}</span>
              <button
                type="button" onClick={() => setPagina(paginaCorrente + 1)} disabled={paginaCorrente >= pagine}
                aria-label="Pagina successiva"
                className="premi rounded-full bg-neutral-100 px-2 py-1 text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-neutral-100"
              >
                ›
              </button>
            </span>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">
              {editing.id ? 'Modifica cliente' : 'Nuovo cliente'}
            </h2>
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-neutral-500">Tipo soggetto</label>
                <select
                  name="tipo_soggetto"
                  defaultValue={editing.tipo_soggetto ?? 'persona_fisica'}
                  onChange={(e) => setEditing({ ...editing, tipo_soggetto: e.target.value })}
                  className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                >
                  {TIPI_SOGGETTO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {isPF ? (
                <>
                  <Field label="Nome" name="nome" defaultValue={editing.nome} />
                  <Field label="Cognome" name="cognome" defaultValue={editing.cognome} />
                  <Field label="Codice fiscale" name="codice_fiscale" defaultValue={editing.codice_fiscale} />
                  <Field label="Data di nascita" name="data_nascita" type="date" defaultValue={editing.data_nascita} />
                  <Field label="Luogo di nascita" name="luogo_nascita" defaultValue={editing.luogo_nascita} />
                </>
              ) : (
                <>
                  <Field label="Ragione sociale" name="ragione_sociale" defaultValue={editing.ragione_sociale} full />
                  <Field label="Partita IVA" name="partita_iva" defaultValue={editing.partita_iva} />
                </>
              )}
              <Field label="Indirizzo" name="indirizzo" defaultValue={editing.indirizzo} full />
              <CampoComune
                key={editing.id ?? 'nuovo'}
                citta={editing.citta} provincia={editing.provincia} cap={editing.cap}
              />
              <Field label="Telefono" name="telefono" defaultValue={editing.telefono} />
              <Field label="Email" name="email" defaultValue={editing.email} />
              <Field label="PEC" name="pec" defaultValue={editing.pec} />
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-neutral-500">Note</label>
                <textarea
                  name="note"
                  defaultValue={editing.note ?? ''}
                  className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                />
              </div>
              {editing.id && (
                <div className="col-span-2 border-t border-neutral-200 pt-4">
                  <p className="mb-2 text-xs font-semibold text-neutral-500">
                    Documenti generati per questo cliente
                  </p>
                  {loadingDocs ? (
                    <p className="text-sm text-neutral-400">Caricamento...</p>
                  ) : clientDocs.length === 0 ? (
                    <p className="text-sm text-neutral-400">Nessun documento generato finora.</p>
                  ) : (
                    <ul className="max-h-40 divide-y divide-neutral-100 overflow-y-auto text-sm">
                      {clientDocs.map((d) => (
                        <li key={d.id} className="flex items-center justify-between py-1.5">
                          <div>
                            <div>{d.nome_file}</div>
                            <div className="text-xs text-neutral-400">
                              {labelFromOptions(TIPI_PRATICA, d.tipo_pratica)} · {new Date(d.data_generazione).toLocaleDateString('it-IT')}
                            </div>
                          </div>
                          <a
                            href={`/api/documenti/${d.id}/download`}
                            className="premi rounded-full bg-neutral-100 px-2 py-1 text-xs hover:bg-neutral-200"
                          >
                            Scarica
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="col-span-2 mt-2 flex justify-end gap-2 border-t border-neutral-200 pt-4">
                {editing.id && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleInvitePortal(editing)}
                      className="mr-auto premi rounded-full bg-neutral-100 px-4 py-2 text-sm hover:bg-neutral-200"
                    >
                      Invita al portale
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive(editing.id!)}
                      className="premi rounded-full bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100"
                    >
                      Archivia
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(editing.id!)}
                      className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                    >
                      Elimina
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="premi rounded-full bg-neutral-100 px-4 py-2 text-sm hover:bg-neutral-200"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {inviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">
              Invita {clientLabel(inviteModal.client)} al portale
            </h2>

            {!inviteModal.link ? (
              <>
                <label className="mb-1 block text-xs text-neutral-500">Email del cliente</label>
                <input
                  type="email"
                  autoFocus
                  value={inviteModal.email}
                  onChange={(e) => setInviteModal({ ...inviteModal, email: e.target.value, error: null })}
                  className="mb-3 w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                  placeholder="cliente@esempio.it"
                />
                {inviteModal.error && <p className="mb-3 text-sm text-red-600">{inviteModal.error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteModal(null)}
                    className="premi rounded-full bg-neutral-100 px-4 py-2 text-sm hover:bg-neutral-200"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateInviteLink}
                    className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800"
                  >
                    Genera link
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-2 text-sm text-neutral-600">Copia questo link e mandalo al cliente:</p>
                <input
                  readOnly
                  value={inviteModal.link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mb-3 w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                />
                {inviteModal.error && <p className="mb-3 text-sm text-red-600">{inviteModal.error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteModal(null)}
                    className="premi rounded-full bg-neutral-100 px-4 py-2 text-sm hover:bg-neutral-200"
                  >
                    Chiudi
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800"
                  >
                    {inviteModal.copied ? 'Copiato!' : 'Copia link'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, name, defaultValue, type = 'text', full = false }: {
  label: string; name: string; defaultValue?: string | null; type?: string; full?: boolean;
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
      />
    </div>
  );
}
