'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';
import { Icon } from '@/components/ui/Icon';

type Etichetta = { epc: string; descrizione: string | null; client_id: string | null };
type Posizione = { epc: string; stanza: string | null; ultimo_visto: string };

// Un'etichetta letta da meno di un minuto è quasi certamente quella appena avvicinata all'antenna.
const APPENA_LETTA_MS = 60 * 1000;
const LETTORE_ATTIVO_MS = 3 * 60 * 1000;

const corta = (epc: string) => `…${epc.slice(-8)}`;

function fa(iso: string): string {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'adesso';
  if (sec < 3600) return `${Math.round(sec / 60)} min fa`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h fa`;
  return new Date(iso).toLocaleDateString('it-IT');
}

/**
 * Associa al cliente l'etichetta RFID attaccata al suo fascicolo di carta.
 *
 * Il lettore manda a Themis ogni etichetta che vede (app "Fascicoli RFID"): qui compaiono quelle non ancora
 * associate a nessuno, la più recente in cima. Basta avvicinare il fascicolo a un'antenna e premere "Associa".
 */
export default function AssociaTagRfid({ clienteId, nomeCliente, onChiudi }: {
  clienteId: string; nomeCliente: string; onChiudi: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { studioId } = useStudio();
  const [etichette, setEtichette] = useState<Etichetta[]>([]);
  const [posizioni, setPosizioni] = useState<Posizione[]>([]);
  const [lettoreAttivo, setLettoreAttivo] = useState<boolean | null>(null);
  const [descrizione, setDescrizione] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [, setOrologio] = useState(0);

  const load = useCallback(async () => {
    const [e, p, l] = await Promise.all([
      supabase.from('rfid_etichette').select('epc, descrizione, client_id'),
      supabase.from('rfid_posizioni').select('epc, stanza, ultimo_visto').order('ultimo_visto', { ascending: false }).limit(300),
      supabase.from('rfid_lettori').select('ultimo_contatto').is('revocato_at', null),
    ]);
    setEtichette((e.data || []) as Etichetta[]);
    setPosizioni((p.data || []) as Posizione[]);
    setLettoreAttivo((l.data || []).some((r: { ultimo_contatto: string | null }) =>
      r.ultimo_contatto && Date.now() - new Date(r.ultimo_contatto).getTime() < LETTORE_ATTIVO_MS));
  }, [supabase]);

  useEffect(() => { load(); }, [load]);
  useAggiornamentoLive(['rfid_posizioni', 'rfid_etichette', 'rfid_lettori'], load);
  // Rete di sicurezza: si rilegge ogni 3 secondi, così l'etichetta avvicinata compare anche senza aggiornamento dal vivo.
  useEffect(() => {
    const t = setInterval(() => { load(); setOrologio((n) => n + 1); }, 3000);
    return () => clearInterval(t);
  }, [load]);

  const usate = new Set(etichette.map((e) => e.epc));
  const stanzaDi = new Map(posizioni.map((p) => [p.epc, p]));
  const delCliente = etichette.filter((e) => e.client_id === clienteId);
  const libere = posizioni.filter((p) => !usate.has(p.epc)).slice(0, 8);

  async function associa(epc: string) {
    setErrore(null);
    setInCorso(epc);
    const { error } = await supabase.from('rfid_etichette')
      .insert({ studio_id: studioId, epc, client_id: clienteId, descrizione: descrizione.trim() || null });
    setInCorso(null);
    if (error) { setErrore('Etichetta non associata: riprova.'); return; }
    setDescrizione('');
    load();
  }

  async function togli(epc: string) {
    if (!confirm("Togliere questa etichetta dal cliente? L'etichetta tornerà tra quelle libere.")) return;
    const { error } = await supabase.from('rfid_etichette').delete().eq('epc', epc);
    if (error) { setErrore('Etichetta non tolta: riprova.'); return; }
    load();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bordeaux-50 text-bordeaux-700">
            <Icon nome="etichetta" className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-bold text-neutral-900">Tag RFID del fascicolo</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">{nomeCliente}</p>

        {lettoreAttivo === false && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Il lettore non risulta acceso: avvia l&apos;app <b>Fascicoli RFID</b> sul computer a cui è collegato, altrimenti
            l&apos;etichetta non arriva a Themis.
          </p>
        )}

        {delCliente.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Già associate a questo cliente</p>
            <ul className="divide-y divide-neutral-100 rounded-xl ring-1 ring-neutral-100">
              {delCliente.map((e) => (
                <li key={e.epc} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-xs text-neutral-700">{corta(e.epc)}</span>
                    {e.descrizione && <span className="ml-2 text-neutral-600">{e.descrizione}</span>}
                    <span className="block text-xs text-neutral-400">
                      {stanzaDi.get(e.epc)?.stanza ?? 'mai letta'}{stanzaDi.get(e.epc) ? ` · ${fa(stanzaDi.get(e.epc)!.ultimo_visto)}` : ''}
                    </span>
                  </span>
                  <button onClick={() => togli(e.epc)} className="premi rounded-full px-3 py-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-700">
                    Togli
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className="mb-3 list-decimal space-y-0.5 pl-5 text-sm text-neutral-600">
          <li>Attacca l&apos;etichetta sul fascicolo.</li>
          <li>Avvicinala a un&apos;antenna: compare qui sotto, in cima, entro pochi secondi.</li>
          <li>Premi <b>Associa</b>.</li>
        </ol>

        <label className="mb-3 block text-xs text-neutral-500">
          Descrizione del fascicolo (facoltativa)
          <input
            value={descrizione} onChange={(ev) => setDescrizione(ev.target.value)} maxLength={120}
            placeholder="es. Sinistro 2025, ATP invalidità…"
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-bordeaux-400"
          />
        </label>

        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Etichette lette e non ancora associate</p>
        {libere.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-4 text-sm text-neutral-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-bordeaux-400" />
            In attesa: avvicina l&apos;etichetta a un&apos;antenna.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl ring-1 ring-neutral-100">
            {libere.map((p) => {
              const appena = Date.now() - new Date(p.ultimo_visto).getTime() < APPENA_LETTA_MS;
              return (
                <li key={p.epc} className={`flex items-center gap-3 px-3 py-2 text-sm ${appena ? 'bg-emerald-50/60' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-xs text-neutral-700">{corta(p.epc)}</span>
                    {appena && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">appena letta</span>}
                    <span className="block text-xs text-neutral-400">{p.stanza ?? '—'} · {fa(p.ultimo_visto)}</span>
                  </span>
                  <button
                    onClick={() => associa(p.epc)} disabled={inCorso !== null}
                    className="premi rounded-full bg-bordeaux-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
                  >
                    {inCorso === p.epc ? 'Associo…' : 'Associa'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {errore && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errore}</p>}

        <div className="mt-5 flex justify-end border-t border-neutral-200 pt-4">
          <button onClick={onChiudi} className="premi rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium hover:bg-neutral-200">
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
}
