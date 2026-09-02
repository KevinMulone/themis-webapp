'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import CreditoBarra, { type Credito } from '../pratiche/[id]/CreditoBarra';

type Account = { id: string; etichetta: string; indirizzo_pec: string };
type Documento = { id: string; nome_file: string };
type Pratica = { id: string; etichetta: string };

/**
 * Scrittura e invio di una PEC.
 *
 * Due schermate e non una: si compone, poi si rilegge quello che sta per
 * partire e si conferma. Una PEC è un atto giuridico e non si può
 * richiamare — la seconda schermata è l'unico momento in cui accorgersi
 * di un destinatario sbagliato ha ancora un costo pari a zero.
 */
export default function NuovaPec({ onChiudi, onInviata }: {
  onChiudi: () => void; onInviata: () => void;
}) {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pratiche, setPratiche] = useState<Pratica[]>([]);
  const [documenti, setDocumenti] = useState<Documento[]>([]);

  const [accountId, setAccountId] = useState('');
  const [matterId, setMatterId] = useState('');
  const [destinatari, setDestinatari] = useState('');
  const [cc, setCc] = useState('');
  const [oggetto, setOggetto] = useState('');
  const [testo, setTesto] = useState('');
  const [scelti, setScelti] = useState<string[]>([]);

  const [argomento, setArgomento] = useState('');
  const [scrivendoThemis, setScrivendoThemis] = useState(false);
  const [creditoThemis, setCreditoThemis] = useState<Credito | null>(null);
  const [erroreThemis, setErroreThemis] = useState('');
  const [notaThemis, setNotaThemis] = useState('');

  const [fase, setFase] = useState<'scrittura' | 'conferma'>('scrittura');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState('');
  const [esito, setEsito] = useState<{ avviso?: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: acc }, { data: prat }] = await Promise.all([
        supabase.from('pec_account').select('id, etichetta, indirizzo_pec').eq('attivo', true),
        supabase.from('matters')
          .select('id, tipo_pratica, controparte_nome, clients(nome, cognome, ragione_sociale)')
          .neq('stato', 'archiviata').order('updated_at', { ascending: false }),
      ]);
      setAccounts(acc || []);
      if (acc?.length === 1) setAccountId(acc[0].id);
      type Riga = {
        id: string; tipo_pratica: string; controparte_nome: string | null;
        clients?: { nome: string | null; cognome: string | null; ragione_sociale: string | null };
      };
      setPratiche(((prat as unknown as Riga[]) || []).map((p) => ({
        id: p.id,
        etichetta: [
          [p.clients?.cognome, p.clients?.nome].filter(Boolean).join(' ') || p.clients?.ragione_sociale,
          p.controparte_nome ? `c. ${p.controparte_nome}` : null,
        ].filter(Boolean).join(' ') || p.tipo_pratica,
      })));
    })();
  }, [supabase]);

  useEffect(() => {
    if (!matterId) { setDocumenti([]); setScelti([]); return; }
    (async () => {
      const { data } = await supabase.from('documenti')
        .select('id, nome_file').eq('matter_id', matterId)
        .order('data_generazione', { ascending: false });
      setDocumenti(data || []);
      setScelti([]);
    })();
  }, [matterId, supabase]);

  const elencoA = destinatari.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const elencoCc = cc.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const mittente = accounts.find((a) => a.id === accountId)?.indirizzo_pec ?? '';
  const pronto = accountId && elencoA.length > 0 && oggetto.trim() && testo.trim();

  async function scriviConThemis() {
    if (!argomento.trim()) return;
    // Non si sovrascrive in silenzio quello che l'avvocato ha già scritto.
    if ((oggetto.trim() || testo.trim())
        && !confirm('Themis sostituirà oggetto e testo già scritti. Procedo?')) return;

    setScrivendoThemis(true);
    setErroreThemis('');
    const res = await fetch('/api/themis/pec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        argomento, matterId: matterId || null,
        destinatari: elencoA, documentiIds: scelti,
      }),
    });
    const body = await res.json();
    setScrivendoThemis(false);
    if (!res.ok) { setErroreThemis(body.error || 'Non riuscito'); return; }
    if (body.oggetto) setOggetto(body.oggetto);
    setTesto(body.testo || '');
    setCreditoThemis(body.credito || null);

    // Se ha riconosciuto da solo la pratica, va detto: l'avvocato deve
    // sapere su quale fascicolo ha lavorato, non fidarsi e basta.
    const note: string[] = [];
    if (body.praticaUsata && !matterId) {
      setMatterId(body.praticaUsata.id);
      note.push(`Ho riconosciuto la pratica: ${body.praticaUsata.etichetta}.`);
    }
    if (!destinatari.trim() && body.destinatariSuggeriti?.length) {
      setDestinatari(body.destinatariSuggeriti[0]);
      note.push(`Destinatario preso dalla corrispondenza precedente: ${body.destinatariSuggeriti[0]}. Verificalo.`);
    }
    setNotaThemis(note.join(' '));
  }

  async function invia() {
    setInCorso(true);
    setErrore('');
    const res = await fetch('/api/pec/invia', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId, destinatari: elencoA, cc: elencoCc,
        oggetto, testo, documentiIds: scelti, matterId: matterId || null,
      }),
    });
    const body = await res.json();
    setInCorso(false);
    if (!res.ok) { setErrore(body.error || 'Invio non riuscito'); setFase('scrittura'); return; }
    setEsito({ avviso: body.avviso });
    onInviata();
  }

  if (esito) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
          <h2 className="mb-2 font-semibold text-neutral-900">PEC inviata</h2>
          <p className="mb-3 text-sm text-neutral-600">
            Il messaggio è stato consegnato al gestore. Le attestazioni di accettazione e
            consegna arriveranno separatamente: le troverai nella scheda <strong>Attestazioni</strong>
            {' '}dopo la prossima sincronizzazione.
          </p>
          {esito.avviso && (
            <p className="mb-3 rounded-md bg-gold-100 px-3 py-2 text-xs text-gold-700">{esito.avviso}</p>
          )}
          <div className="flex justify-end">
            <button onClick={onChiudi} className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white">
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-semibold text-neutral-900">
            {fase === 'scrittura' ? 'Nuova PEC' : 'Controlla prima di inviare'}
          </h2>
          <button onClick={onChiudi} className="text-sm text-neutral-500 hover:text-neutral-800">Annulla</button>
        </div>

        {fase === 'scrittura' ? (
          <div className="flex flex-col gap-3">
            {accounts.length > 1 && (
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Casella mittente</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
                  <option value="">— scegli —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.indirizzo_pec}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-neutral-500">Destinatari</label>
              <textarea value={destinatari} onChange={(e) => setDestinatari(e.target.value)}
                placeholder="indirizzo@pec.it — più indirizzi separati da virgola o a capo"
                className="min-h-16 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
              <p className="mt-1 text-[11px] text-neutral-400">
                Solo indirizzi PEC: una PEC inviata a una casella ordinaria non ha valore legale.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs text-neutral-500">Conoscenza (facoltativo)</label>
              <input value={cc} onChange={(e) => setCc(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
            </div>

            <div className="rounded-xl bg-neutral-50 p-3">
              <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
                <label className="text-xs font-medium text-neutral-600">
                  Fai scrivere la PEC a Themis
                </label>
                <CreditoBarra credito={creditoThemis} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={argomento} onChange={(e) => setArgomento(e.target.value)}
                  placeholder="Es. sollecito riscontro alla richiesta danni, termine 15 giorni"
                  className="min-w-60 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                />
                <button
                  type="button" onClick={scriviConThemis}
                  disabled={scrivendoThemis || !argomento.trim()}
                  className="premi rounded-full bg-bordeaux-700 px-3 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
                >
                  {scrivendoThemis ? 'Sto scrivendo...' : 'Scrivi'}
                </button>
              </div>
              {erroreThemis && <p className="mt-1 text-xs text-red-600">{erroreThemis}</p>}
              {notaThemis && (
                <p className="mt-1 rounded-md bg-gold-100 px-2 py-1 text-xs text-gold-800">{notaThemis}</p>
              )}
              <p className="mt-1 text-[11px] text-neutral-400">
                Themis prende i fatti dalla pratica collegata e dagli allegati che scegli.
                Dove non sa, lascia un segnaposto invece di inventare. Rileggi sempre prima di inviare.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs text-neutral-500">Oggetto</label>
              <input value={oggetto} onChange={(e) => setOggetto(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
            </div>

            <div>
              <label className="mb-1 block text-xs text-neutral-500">Testo</label>
              <textarea value={testo} onChange={(e) => setTesto(e.target.value)}
                className="min-h-40 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
            </div>

            <div>
              <label className="mb-1 block text-xs text-neutral-500">Pratica (per allegare e archiviare)</label>
              <select value={matterId} onChange={(e) => setMatterId(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
                <option value="">Nessuna pratica</option>
                {pratiche.map((p) => <option key={p.id} value={p.id}>{p.etichetta}</option>)}
              </select>
            </div>

            {documenti.length > 0 && (
              <div>
                <label className="mb-1 block text-xs text-neutral-500">
                  Allegati dal fascicolo {scelti.length > 0 && `(${scelti.length})`}
                </label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-neutral-50 p-2">
                  {documenti.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm text-neutral-700">
                      <input type="checkbox" checked={scelti.includes(d.id)}
                        onChange={(e) => setScelti(e.target.checked
                          ? [...scelti, d.id] : scelti.filter((x) => x !== d.id))} />
                      <span className="truncate">{d.nome_file}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {errore && <p className="text-sm text-red-600">{errore}</p>}

            <div className="flex justify-end">
              <button disabled={!pronto} onClick={() => setFase('conferma')}
                className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Continua
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-neutral-50 p-4 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-neutral-400">Da</dt><dd className="text-neutral-800">{mittente}</dd>
                <dt className="text-neutral-400">A</dt>
                <dd className="font-semibold text-neutral-900">{elencoA.join(', ')}</dd>
                {elencoCc.length > 0 && (<><dt className="text-neutral-400">Cc</dt><dd>{elencoCc.join(', ')}</dd></>)}
                <dt className="text-neutral-400">Oggetto</dt><dd className="text-neutral-800">{oggetto}</dd>
                <dt className="text-neutral-400">Allegati</dt>
                <dd className="text-neutral-800">
                  {scelti.length === 0 ? 'nessuno'
                    : documenti.filter((d) => scelti.includes(d.id)).map((d) => d.nome_file).join(', ')}
                </dd>
              </dl>
              <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-neutral-200 pt-3 text-neutral-700">
                {testo}
              </p>
            </div>

            <p className="rounded-md bg-gold-100 px-3 py-2 text-xs text-gold-800">
              Controlla i destinatari. Una PEC inviata non si può richiamare, e fa data
              dal momento in cui il gestore la accetta.
            </p>

            {errore && <p className="text-sm text-red-600">{errore}</p>}

            <div className="flex justify-between">
              <button onClick={() => setFase('scrittura')} className="text-sm text-neutral-600 hover:underline">
                Torna a modificare
              </button>
              <button disabled={inCorso} onClick={invia}
                className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {inCorso ? 'Invio in corso...' : 'Invia la PEC'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
