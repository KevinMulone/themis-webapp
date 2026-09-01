'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';
import LetturaMessaggio from './LetturaMessaggio';
import NuovaPec from './NuovaPec';

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
};

type Account = { id: string; etichetta: string };

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

function formattaData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PecPage() {
  const supabase = createClient();
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  // Tre schede su un asse solo, invece di due schede più una tendina: le
  // PEC ricevute, quelle inviate, e le attestazioni del gestore. Sono le
  // tre pile in cui un avvocato divide la corrispondenza, e non si
  // mescolano mai fra loro.
  const [scheda, setScheda] = useState<'ricevute' | 'inviate' | 'attestazioni'>('ricevute');
  const [accountFiltro, setAccountFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: acc }, { data: msg }] = await Promise.all([
      supabase.from('pec_account').select('id, etichetta').order('created_at'),
      supabase.from('pec_messaggi')
        .select('id, pec_account_id, matter_id, tipo_pec, mittente, destinatari, oggetto, data_invio, data_ricezione, stato, direzione, archiviato')
        .order('data_ricezione', { ascending: false })
        .limit(200),
    ]);
    setAccounts(acc || []);
    setMessaggi(msg || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  // La pagina si riempie da sola quando arriva posta.
  useAggiornamentoLive(['pec_messaggi'], load);

  const [messaggioAperto, setMessaggioAperto] = useState('');
  const [scrivendo, setScrivendo] = useState(false);

  const conteggi = useMemo(() => {
    let ricevute = 0, inviate = 0, attestazioni = 0;
    for (const m of messaggi) {
      if (accountFiltro && m.pec_account_id !== accountFiltro) continue;
      if (RICEVUTE.has(m.tipo_pec)) attestazioni += 1;
      else if ((m.direzione || 'ricevuta') === 'inviata') inviate += 1;
      else ricevute += 1;
    }
    return { ricevute, inviate, attestazioni };
  }, [messaggi, accountFiltro]);

  const filtrati = useMemo(() => {
    return messaggi.filter((m) => {
      const eAttestazione = RICEVUTE.has(m.tipo_pec);
      const inUscita = (m.direzione || 'ricevuta') === 'inviata';

      // Le attestazioni escono dalle prime due schede anche se tecnicamente
      // arrivano: non sono corrispondenza, sono la prova che è partita.
      if (scheda === 'attestazioni') { if (!eAttestazione) return false; }
      else if (eAttestazione) return false;
      else if (scheda === 'ricevute' && inUscita) return false;
      else if (scheda === 'inviate' && !inUscita) return false;

      if (accountFiltro && m.pec_account_id !== accountFiltro) return false;
      return true;
    });
  }, [messaggi, scheda, accountFiltro]);

  const nomeAccount = (id: string) => accounts.find((a) => a.id === id)?.etichetta || '—';

  return (
    <div>
      <h1 className="mb-1 text-2xl font-display font-semibold text-neutral-900">PEC</h1>
      <p className="mb-6 text-xs text-neutral-500">
        Messaggi scaricati automaticamente dalle caselle configurate in Impostazioni. Le ricevute (accettazione,
        consegna) sono separate perché non richiedono azione.
      </p>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          Nessuna casella PEC configurata. Aggiungine una da Impostazioni.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button" onClick={() => setScrivendo(true)}
              className="rounded-md bg-bordeaux-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-bordeaux-800"
            >
              Nuova PEC
            </button>
            <div className="flex overflow-hidden rounded-md border border-neutral-300 text-sm">
              {([
                ['ricevute', 'Ricevute', conteggi.ricevute],
                ['inviate', 'Inviate', conteggi.inviate],
                ['attestazioni', 'Attestazioni', conteggi.attestazioni],
              ] as const).map(([chiave, etichetta, quante], i) => (
                <button
                  key={chiave}
                  onClick={() => setScheda(chiave)}
                  className={`px-3 py-1.5 ${i > 0 ? 'border-l border-neutral-300' : ''} ${
                    scheda === chiave
                      ? 'bg-bordeaux-700 text-white'
                      : 'bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {etichetta}
                  <span className={scheda === chiave ? 'ml-1.5 text-white/70' : 'ml-1.5 text-neutral-400'}>
                    {quante}
                  </span>
                </button>
              ))}
            </div>
            {accounts.length > 1 && (
              <select
                value={accountFiltro} onChange={(e) => setAccountFiltro(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Tutte le caselle</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.etichetta}</option>)}
              </select>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            {loading ? (
              <p className="p-6 text-sm text-neutral-500">Caricamento...</p>
            ) : filtrati.length === 0 ? (
              <p className="p-6 text-sm text-neutral-500">
                {scheda === 'inviate'
                  ? 'Nessuna PEC inviata. Se ne hai mandate, vanno prima scaricate dalle Impostazioni.'
                  : scheda === 'attestazioni'
                    ? 'Nessuna attestazione di accettazione o consegna.'
                    : 'Nessuna PEC ricevuta.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Mittente</th>
                    <th className="px-4 py-2">Oggetto</th>
                    <th className="px-4 py-2">Data</th>
                    {accounts.length > 1 && <th className="px-4 py-2">Casella</th>}
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtrati.map((m) => (
                    <tr key={m.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-4 py-2 text-xs text-neutral-500">{LABEL_TIPO[m.tipo_pec] || m.tipo_pec}</td>
                                            <td className="px-4 py-2">{m.mittente || '—'}</td>
                      <td className="px-4 py-2">
                        {m.archiviato === false ? (
                          <span className="text-neutral-700">
                            {m.oggetto || '(senza oggetto)'}
                            <span
                              className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] text-gold-700"
                              title="Il messaggio è troppo grande per l'archivio: resta leggibile nella webmail del gestore."
                            >
                              originale non archiviato
                            </span>
                          </span>
                        ) : (
                          <button
                            type="button" onClick={() => setMessaggioAperto(m.id)}
                            className="text-left text-bordeaux-700 hover:underline"
                          >
                            {m.oggetto || '(senza oggetto)'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-500">
                        {/* La data del messaggio, non quella in cui Themis
                            l'ha scaricato: la seconda dice solo quando ci
                            siamo collegati noi. */}
                        {formattaData(m.data_invio || m.data_ricezione)}
                      </td>
                      {accounts.length > 1 && <td className="px-4 py-2 text-xs text-neutral-500">{nomeAccount(m.pec_account_id)}</td>}
                      <td className="px-4 py-2 text-right">
{m.archiviato === false ? (
                          <span className="text-xs text-neutral-300">—</span>
                        ) : (
                                                  <a href={`/api/pec/messaggio/${m.id}/download`} className="text-xs font-semibold text-neutral-500 hover:underline">
                          Scarica
                        </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}

      {messaggioAperto && (
        <LetturaMessaggio messaggioId={messaggioAperto} onChiudi={() => setMessaggioAperto('')} />
      )}

      {scrivendo && (
        <NuovaPec onChiudi={() => setScrivendo(false)} onInviata={load} />
      )}
    </div>
  );
}
