'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';
import { clientLabel } from '@/lib/constants';
import { Icon, type NomeIcona } from '@/components/ui/Icon';
import LetturaMessaggio from './LetturaMessaggio';
import NuovaPec from './NuovaPec';
import ScadenzeProposte from './ScadenzeProposte';

type Messaggio = {
  id: string;
  pec_account_id: string;
  matter_id: string | null;
  tipo_pec: string;
  mittente: string | null;
  destinatari: string | null;
  oggetto: string | null;
  data_invio: string | null;
  data_ricezione: string;
  stato: string;
  direzione: string;
  archiviato: boolean;
  letta: boolean;
};

type Account = { id: string; etichetta: string };
type PraticaRef = { id: string; rg_numero: string | null; rg_anno: string | null; numero_riferimento: string | null; clients?: { nome: string | null; cognome: string | null; ragione_sociale: string | null; tipo_soggetto: string } };

const RICEVUTE = new Set([
  'accettazione', 'non-accettazione', 'presa-in-carico', 'avvenuta-consegna',
  'errore-consegna', 'preavviso-errore-consegna', 'rilevazione-virus',
]);

const LABEL_TIPO: Record<string, string> = {
  'posta-certificata': 'Messaggio',
  accettazione: 'Ricevuta di accettazione',
  'non-accettazione': 'Avviso di non accettazione',
  'presa-in-carico': 'Presa in carico',
  'avvenuta-consegna': 'Ricevuta di consegna',
  'errore-consegna': 'Errore di consegna',
  'preavviso-errore-consegna': 'Preavviso di mancata consegna',
  'rilevazione-virus': 'Virus rilevato',
  sconosciuto: 'Non riconosciuto',
};

/**
 * Il colore dice se serve fare qualcosa.
 *
 * Un errore di consegna e una ricevuta di consegna sono entrambi
 * "attestazioni", ma il primo richiede un'azione entro un termine e la
 * seconda no. Distinguerli a colpo d'occhio conta più di distinguere il
 * mittente.
 */
function tinta(tipo: string): { icona: NomeIcona; classe: string } {
  if (tipo === 'posta-certificata') return { icona: 'pec', classe: 'bg-rose-50 text-rose-500' };
  if (tipo === 'errore-consegna' || tipo === 'non-accettazione' || tipo === 'rilevazione-virus'
    || tipo === 'preavviso-errore-consegna') {
    return { icona: 'scudo', classe: 'bg-red-100 text-red-600' };
  }
  return { icona: 'scudo', classe: 'bg-emerald-50 text-emerald-500' };
}

function formattaData(iso: string | null): { giorno: string; ora: string } {
  if (!iso) return { giorno: '—', ora: '' };
  const d = new Date(iso);
  return {
    giorno: d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    ora: d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * Cerca in mittente, destinatari e oggetto.
 *
 * Tutti i termini devono comparire, non uno qualsiasi: cercando
 * "mannarino generali" si vuole la PEC che riguarda entrambi, non
 * l'unione di due elenchi.
 */
function corrisponde(m: { mittente: string | null; destinatari: string | null; oggetto: string | null },
  query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const pagliaio = [m.mittente, m.destinatari, m.oggetto].filter(Boolean).join(' ').toLowerCase();
  return q.split(/\s+/).every((parola) => pagliaio.includes(parola));
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** Una delle tre note in fondo alla pagina. */
function NotaFondo({ icona, tinta: cl, titolo, testo, href, azione }: {
  icona: NomeIcona; tinta: string; titolo: string; testo: string; href?: string; azione?: string;
}) {
  return (
    <div className="flex gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cl}`}>
        <Icon nome={icona} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-neutral-900">{titolo}</h3>
        <p className="mt-0.5 text-xs text-neutral-500">{testo}</p>
        {href && azione && (
          <Link href={href} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-bordeaux-700 hover:underline">
            {azione}
            <Icon nome="freccia" className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function PecPage() {
  const supabase = createClient();
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pratiche, setPratiche] = useState<Record<string, PraticaRef>>({});
  // Tre schede su un asse solo: le PEC ricevute, quelle inviate, e le
  // attestazioni del gestore. Sono le tre pile in cui un avvocato divide
  // la corrispondenza, e non si mescolano mai fra loro.
  const [scheda, setScheda] = useState<'ricevute' | 'inviate' | 'attestazioni'>('ricevute');
  const [accountFiltro, setAccountFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  const [messaggioAperto, setMessaggioAperto] = useState('');
  const [scrivendo, setScrivendo] = useState(false);
  const [cerca, setCerca] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [mostraFiltri, setMostraFiltri] = useState(false);
  const [soloNonLette, setSoloNonLette] = useState(false);
  const [ordine, setOrdine] = useState<'recenti' | 'vecchie' | 'mittente' | 'oggetto'>('recenti');
  const [pagina, setPagina] = useState(1);
  const [perPagina, setPerPagina] = useState(10);

  async function load() {
    setLoading(true);
    const [{ data: acc }, { data: msg }, { data: prat }] = await Promise.all([
      supabase.from('pec_account').select('id, etichetta').order('created_at'),
      supabase.from('pec_messaggi')
        .select('id, pec_account_id, matter_id, tipo_pec, mittente, destinatari, oggetto, data_invio, data_ricezione, stato, direzione, archiviato, letta')
        .order('data_ricezione', { ascending: false })
        .limit(500),
      // Serve a mostrare a quale fascicolo appartiene una PEC: senza, la
      // riga dice chi ha scritto ma non di quale causa si parla.
      supabase.from('matters')
        .select('id, rg_numero, rg_anno, numero_riferimento, clients(nome, cognome, ragione_sociale, tipo_soggetto)'),
    ]);
    setAccounts(acc || []);
    setMessaggi(msg || []);
    const mappa: Record<string, PraticaRef> = {};
    for (const p of (prat as unknown as PraticaRef[]) || []) mappa[p.id] = p;
    setPratiche(mappa);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  // La pagina si riempie da sola quando arriva posta.
  useAggiornamentoLive(['pec_messaggi'], load);

  /** La data che conta per l'archivio è quella del messaggio. */
  function periodoDi(m: Messaggio): string {
    const d = new Date(m.data_invio || m.data_ricezione);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function nomePeriodo(chiave: string): string {
    const [anno, mese] = chiave.split('-');
    return `${MESI[Number(mese) - 1]} ${anno}`;
  }

  /** Come si chiama la pratica collegata, in una riga. */
  function etichettaPratica(matterId: string | null): string | null {
    if (!matterId) return null;
    const p = pratiche[matterId];
    if (!p) return null;
    const rif = p.rg_numero
      ? `${p.rg_numero}${p.rg_anno ? `/${p.rg_anno}` : ''}`
      : p.numero_riferimento;
    const nome = clientLabel(p.clients);
    return [rif, nome].filter(Boolean).join(' – ') || null;
  }

  const periodi = useMemo(() => {
    const conta = new Map<string, number>();
    for (const m of messaggi) {
      const k = periodoDi(m);
      conta.set(k, (conta.get(k) ?? 0) + 1);
    }
    return [...conta.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [messaggi]);

  // Si parte dal mese in corso — è l'archiviazione automatica del primo
  // del mese, ottenuta raggruppando invece che spostando: nessun file
  // cambia posto, quindi non si può perdere niente. Se il mese in corso è
  // vuoto si mostra tutto, altrimenti si aprirebbe su una pagina bianca.
  useEffect(() => {
    if (periodo || periodi.length === 0) return;
    const oggi = new Date();
    const corrente = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`;
    setPeriodo(periodi.some(([k]) => k === corrente) ? corrente : 'tutti');
  }, [periodi, periodo]);

  useEffect(() => { setPagina(1); }, [scheda, cerca, periodo, accountFiltro, soloNonLette, perPagina, ordine]);

  const conteggi = useMemo(() => {
    let ricevute = 0, inviate = 0, attestazioni = 0;
    for (const m of messaggi) {
      if (accountFiltro && m.pec_account_id !== accountFiltro) continue;
      if (periodo && periodo !== 'tutti' && periodoDi(m) !== periodo) continue;
      if (soloNonLette && m.letta !== false) continue;
      if (!corrisponde(m, cerca)) continue;
      if (RICEVUTE.has(m.tipo_pec)) attestazioni += 1;
      else if ((m.direzione || 'ricevuta') === 'inviata') inviate += 1;
      else ricevute += 1;
    }
    return { ricevute, inviate, attestazioni };
  }, [messaggi, accountFiltro, periodo, cerca, soloNonLette]);

  const filtrati = useMemo(() => {
    const lista = messaggi.filter((m) => {
      const eAttestazione = RICEVUTE.has(m.tipo_pec);
      const inUscita = (m.direzione || 'ricevuta') === 'inviata';

      // Le attestazioni escono dalle prime due schede anche se tecnicamente
      // arrivano: non sono corrispondenza, sono la prova che è partita.
      if (scheda === 'attestazioni') { if (!eAttestazione) return false; }
      else if (eAttestazione) return false;
      else if (scheda === 'ricevute' && inUscita) return false;
      else if (scheda === 'inviate' && !inUscita) return false;

      if (accountFiltro && m.pec_account_id !== accountFiltro) return false;
      if (periodo && periodo !== 'tutti' && periodoDi(m) !== periodo) return false;
      if (soloNonLette && m.letta !== false) return false;
      if (!corrisponde(m, cerca)) return false;
      return true;
    });

    const dataDi = (m: Messaggio) => m.data_invio || m.data_ricezione;
    return lista.sort((a, b) => {
      if (ordine === 'recenti') return dataDi(b).localeCompare(dataDi(a));
      if (ordine === 'vecchie') return dataDi(a).localeCompare(dataDi(b));
      if (ordine === 'mittente') return (a.mittente || '').localeCompare(b.mittente || '', 'it');
      return (a.oggetto || '').localeCompare(b.oggetto || '', 'it');
    });
  }, [messaggi, scheda, accountFiltro, periodo, cerca, soloNonLette, ordine]);

  const pagine = Math.max(1, Math.ceil(filtrati.length / perPagina));
  const paginaCorrente = Math.min(pagina, pagine);
  const visibili = filtrati.slice((paginaCorrente - 1) * perPagina, paginaCorrente * perPagina);

  const nomeAccount = (id: string) => accounts.find((a) => a.id === id)?.etichetta || '—';
  const nonLetteTotali = messaggi.filter((m) => m.letta === false).length;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-neutral-900">PEC</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Messaggi scaricati automaticamente dalle caselle configurate in Impostazioni.
            Le ricevute di accettazione, consegna e mancata consegna sono separate.
          </p>
        </div>
        <Link
          href="/impostazioni"
          className="premi flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 hover:text-bordeaux-700"
        >
          <Icon nome="impostazioni" className="h-4 w-4" />
          Impostazioni PEC
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-2xl bg-neutral-50 py-16 text-center">
          <Icon nome="pec" className="mx-auto h-10 w-10 text-neutral-200" />
          <p className="mt-3 text-sm text-neutral-500">Nessuna casella PEC configurata.</p>
          <Link
            href="/impostazioni"
            className="mt-3 inline-flex items-center gap-2 premi rounded-full bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bordeaux-800"
          >
            <Icon nome="piu" className="h-4 w-4" />
            Aggiungi una casella
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button" onClick={() => setScrivendo(true)}
              className="flex items-center gap-2 premi rounded-full bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bordeaux-800"
            >
              <Icon nome="matita" className="h-4 w-4" />
              Nuova PEC
            </button>

            {([
              ['ricevute', 'Ricevute', conteggi.ricevute, 'scarica'],
              ['inviate', 'Inviate', conteggi.inviate, 'invio'],
              ['attestazioni', 'Attestazioni', conteggi.attestazioni, 'scudo'],
            ] as const).map(([chiave, etichetta, quante, icona]) => (
              <button
                key={chiave}
                onClick={() => setScheda(chiave)}
                className={`premi flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                  scheda === chiave
                    ? 'bg-bordeaux-700 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                <Icon nome={icona} className="h-4 w-4" />
                {etichetta}
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                  scheda === chiave ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  {quante}
                </span>
              </button>
            ))}

            <div className="relative ml-auto">
              <Icon nome="calendario" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <select
                value={periodo} onChange={(e) => setPeriodo(e.target.value)}
                className="rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              >
                <option value="tutti">Tutti i periodi ({messaggi.length})</option>
                {periodi.map(([chiave, quante]) => (
                  <option key={chiave} value={chiave}>{nomePeriodo(chiave)} ({quante})</option>
                ))}
              </select>
            </div>
          </div>

          <ScadenzeProposte />

          <div className="mb-4 rounded-2xl bg-neutral-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-60 flex-1">
                <Icon nome="pec" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400" />
                <input
                  value={cerca} onChange={(e) => setCerca(e.target.value)}
                  placeholder="Cerca per mittente, destinatario o oggetto..."
                  className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                />
              </div>

              <button
                type="button"
                onClick={() => setMostraFiltri(!mostraFiltri)}
                className={`premi flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  soloNonLette || accountFiltro
                    ? 'bg-bordeaux-700/[0.08] text-bordeaux-700'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                <Icon nome="attivita" className="h-4 w-4" />
                Filtri
                {(soloNonLette || accountFiltro) && (
                  <span className="rounded-full bg-bordeaux-700 px-1.5 text-[10px] text-white">
                    {(soloNonLette ? 1 : 0) + (accountFiltro ? 1 : 0)}
                  </span>
                )}
              </button>

              <label className="flex shrink-0 items-center gap-2 text-sm text-neutral-500">
                Ordina per
                <select
                  value={ordine} onChange={(e) => setOrdine(e.target.value as typeof ordine)}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                >
                  <option value="recenti">Data (più recenti)</option>
                  <option value="vecchie">Data (più vecchie)</option>
                  <option value="mittente">Mittente</option>
                  <option value="oggetto">Oggetto</option>
                </select>
              </label>
            </div>

            {mostraFiltri && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSoloNonLette(!soloNonLette)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    soloNonLette ? 'bg-bordeaux-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Solo non lette ({nonLetteTotali})
                </button>
                {accounts.length > 1 && (
                  <select
                    value={accountFiltro} onChange={(e) => setAccountFiltro(e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                  >
                    <option value="">Tutte le caselle</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.etichetta}</option>)}
                  </select>
                )}
                {(soloNonLette || accountFiltro) && (
                  <button
                    type="button"
                    onClick={() => { setSoloNonLette(false); setAccountFiltro(''); }}
                    className="text-xs font-medium text-bordeaux-700 hover:underline"
                  >
                    Azzera i filtri
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-neutral-50">
            {loading ? (
              <p className="p-6 text-sm text-neutral-500">Caricamento...</p>
            ) : filtrati.length === 0 ? (
              <div className="py-16 text-center">
                <Icon nome="pec" className="mx-auto h-10 w-10 text-neutral-200" />
                <p className="mt-3 text-sm text-neutral-500">
                  {cerca.trim()
                    ? `Nessun risultato per «${cerca.trim()}»${periodo !== 'tutti' ? ' in questo periodo.' : '.'}`
                    : scheda === 'inviate'
                      ? 'Nessuna PEC inviata in questo periodo.'
                      : scheda === 'attestazioni'
                        ? 'Nessuna attestazione in questo periodo.'
                        : 'Nessuna PEC ricevuta in questo periodo.'}
                </p>
                {periodo !== 'tutti' && (
                  <button
                    onClick={() => setPeriodo('tutti')}
                    className="mt-2 text-sm font-medium text-bordeaux-700 hover:underline"
                  >
                    Cerca in tutti i periodi
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Mittente / destinatario</th>
                        <th className="px-4 py-3">Oggetto</th>
                        <th className="px-4 py-3">Data</th>
                        {accounts.length > 1 && <th className="px-4 py-3">Casella</th>}
                        <th className="px-4 py-3 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibili.map((m) => {
                        const t = tinta(m.tipo_pec);
                        const d = formattaData(m.data_invio || m.data_ricezione);
                        const pratica = etichettaPratica(m.matter_id);
                        const inUscita = (m.direzione || 'ricevuta') === 'inviata';
                        return (
                          <tr key={m.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-2.5">
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.classe}`}>
                                  <Icon nome={t.icona} className="h-4 w-4" />
                                </span>
                                <span className="text-xs text-neutral-500">{LABEL_TIPO[m.tipo_pec] || m.tipo_pec}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`block truncate ${m.letta === false ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                                {inUscita ? (m.destinatari || '—') : (m.mittente || '—')}
                              </span>
                              {inUscita && m.mittente && (
                                <span className="block truncate text-xs text-neutral-400">da {m.mittente}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {m.archiviato === false ? (
                                <span className="text-neutral-700">
                                  {m.oggetto || '(senza oggetto)'}
                                  <span
                                    className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] text-gold-800"
                                    title="Il messaggio è troppo grande per l'archivio: resta leggibile nella webmail del gestore."
                                  >
                                    originale non archiviato
                                  </span>
                                </span>
                              ) : (
                                <button
                                  type="button" onClick={() => setMessaggioAperto(m.id)}
                                  className={`block max-w-md text-left hover:underline ${
                                    m.letta === false ? 'font-semibold text-bordeaux-800' : 'text-bordeaux-700'
                                  }`}
                                >
                                  {m.oggetto || '(senza oggetto)'}
                                </button>
                              )}
                              {pratica && (
                                <Link
                                  href={`/pratiche/${m.matter_id}`}
                                  className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400 hover:text-bordeaux-700"
                                >
                                  <Icon nome="pratiche" className="h-3.5 w-3.5" />
                                  Pratica: {pratica}
                                </Link>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                              {d.giorno}
                              <span className="block text-xs text-neutral-400">{d.ora}</span>
                            </td>
                            {accounts.length > 1 && (
                              <td className="px-4 py-3 text-xs text-neutral-500">{nomeAccount(m.pec_account_id)}</td>
                            )}
                            <td className="px-4 py-3">
                              <span className="flex items-center justify-end gap-1">
                                {m.archiviato === false ? (
                                  <span className="text-xs text-neutral-300">—</span>
                                ) : (
                                  <>
                                    <button
                                      type="button" onClick={() => setMessaggioAperto(m.id)}
                                      title="Apri il messaggio"
                                      className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-bordeaux-700"
                                    >
                                      <Icon nome="occhio" className="h-4 w-4" />
                                    </button>
                                    <a
                                      href={`/api/pec/messaggio/${m.id}/download`}
                                      title="Scarica il file .eml originale"
                                      className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-bordeaux-700"
                                    >
                                      <Icon nome="scarica" className="h-4 w-4" />
                                    </a>
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-sm text-neutral-500">
                  <span className="flex items-center gap-2">
                    Mostra
                    <select
                      value={perPagina}
                      onChange={(e) => setPerPagina(Number(e.target.value))}
                      className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                    >
                      {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    elementi
                  </span>

                  <span>
                    {`${(paginaCorrente - 1) * perPagina + 1}–${Math.min(paginaCorrente * perPagina, filtrati.length)} di ${filtrati.length} risultati`}
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
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 rounded-2xl bg-neutral-50 p-6 md:grid-cols-3 md:divide-x md:divide-neutral-100">
            <NotaFondo
              icona="pec" tinta="bg-violet-50 text-violet-500" titolo="Caselle configurate"
              testo={`${accounts.length} ${accounts.length === 1 ? 'casella PEC attiva' : 'caselle PEC attive'}`}
              href="/impostazioni" azione="Vai alle impostazioni"
            />
            <div className="md:pl-6">
              <NotaFondo
                icona="orologio" tinta="bg-emerald-50 text-emerald-500" titolo="Controllo automatico"
                // Il numero non è decorativo: è OGNI_MS in SincronizzazionePec.
                // Se un giorno cambia lì, va cambiato anche qui.
                testo="Ogni 3 minuti mentre Themis è aperto, e una volta al giorno anche a Themis chiuso."
                href="/impostazioni" azione="Scarica adesso"
              />
            </div>
            <div className="md:pl-6">
              <NotaFondo
                icona="lucchetto" tinta="bg-gold-50 text-gold-600" titolo="Sicurezza e riservatezza"
                testo="I messaggi sono archiviati cifrati. Il file .eml originale resta l'unico con valore probatorio."
              />
            </div>
          </div>
        </>
      )}

      {messaggioAperto && (
        <LetturaMessaggio messaggioId={messaggioAperto} onChiudi={() => { setMessaggioAperto(''); load(); }} />
      )}

      {scrivendo && (
        <NuovaPec onChiudi={() => setScrivendo(false)} onInviata={load} />
      )}
    </div>
  );
}
