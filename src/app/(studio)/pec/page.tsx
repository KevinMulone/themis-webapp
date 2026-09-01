'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import LetturaMessaggio from './LetturaMessaggio';

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
  const [scheda, setScheda] = useState<'messaggi' | 'ricevute'>('messaggi');
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

  const [direzioneFiltro, setDirezioneFiltro] = useState('');
  const [messaggioAperto, setMessaggioAperto] = useState('');

  const filtrati = useMemo(() => {
    return messaggi.filter((m) => {
      const eRicevuta = RICEVUTE.has(m.tipo_pec);
      if (scheda === 'messaggi' && eRicevuta) return false;
      if (scheda === 'ricevute' && !eRicevuta) return false;
      if (accountFiltro && m.pec_account_id !== accountFiltro) return false;
      if (direzioneFiltro && (m.direzione || 'ricevuta') !== direzioneFiltro) return false;
      return true;
    });
  }, [messaggi, scheda, accountFiltro, direzioneFiltro]);

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
            {/* "Messaggi" sono le PEC vere; "Ricevute di consegna" sono le
                attestazioni del gestore. Il nome lungo è voluto: prima
                diceva solo "Ricevute" e si confondeva con le PEC ricevute,
                che sono un'altra cosa e stanno nell'altra scheda. */}
            <div className="flex rounded-md border border-neutral-300 text-sm">
              <button
                onClick={() => setScheda('messaggi')}
                className={`rounded-l-md px-3 py-1.5 ${scheda === 'messaggi' ? 'bg-bordeaux-700 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'}`}
              >
                Messaggi
              </button>
              <button
                onClick={() => setScheda('ricevute')}
                className={`rounded-r-md border-l border-neutral-300 px-3 py-1.5 ${scheda === 'ricevute' ? 'bg-bordeaux-700 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'}`}
              >
                Ricevute di consegna
              </button>
            </div>
            <select
              value={direzioneFiltro} onChange={(e) => setDirezioneFiltro(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            >
              <option value="">In arrivo e in uscita</option>
              <option value="ricevuta">Solo in arrivo</option>
              <option value="inviata">Solo in uscita</option>
            </select>
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
              <p className="p-6 text-sm text-neutral-500">Nessun messaggio in questa scheda.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Verso</th>
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
                      <td className="px-4 py-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 ${
                          (m.direzione || 'ricevuta') === 'inviata'
                            ? 'bg-bordeaux-50 text-bordeaux-700'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {(m.direzione || 'ricevuta') === 'inviata' ? 'In uscita' : 'In arrivo'}
                        </span>
                      </td>
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
    </div>
  );
}
