'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { TIPI_PRATICA, labelFromOptions, clientLabel } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';

type Client = { id: string; tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null };
type Matter = {
  id: string; tipo_pratica: string; tribunale: string | null;
  rg_numero: string | null; rg_anno: string | null;
  clients?: Client;
};

const URL_PORTALE = 'https://servizipst.giustizia.it/PST/it/pst_2_6.wp';

export default function RegistriGiustiziaPage() {
  const supabase = createClient();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiatoId, setCopiatoId] = useState('');

  useEffect(() => {
    supabase
      .from('matters')
      .select('id, tipo_pratica, tribunale, rg_numero, rg_anno, clients(id, tipo_soggetto, nome, cognome, ragione_sociale)')
      .not('rg_numero', 'is', null)
      .neq('stato', 'archiviata')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setMatters((data as unknown as Matter[]) || []);
        setLoading(false);
      });
  }, []);

  async function copiaRg(m: Matter) {
    const testo = `R.G. ${m.rg_numero}${m.rg_anno ? `/${m.rg_anno}` : ''}`;
    try {
      await navigator.clipboard.writeText(testo);
      setCopiatoId(m.id);
      setTimeout(() => setCopiatoId(''), 2000);
    } catch { /* clipboard non disponibile: l'avvocato lo legge e lo trascrive a mano */ }
  }

  const filtrate = matters.filter((m) => {
    if (!search) return true;
    const pagliaio = [
      clientLabel(m.clients), m.tribunale, m.rg_numero, m.rg_anno,
      labelFromOptions(TIPI_PRATICA, m.tipo_pratica),
    ].filter(Boolean).join(' ').toLowerCase();
    return search.trim().toLowerCase().split(/\s+/).every((t) => pagliaio.includes(t));
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-neutral-900">Giustizia Civile</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Trova rapidamente il R.G. di una pratica per verificarne lo stato sul portale del Ministero.
        </p>
      </div>

      <div className="mb-4 rounded-2xl bg-neutral-50 p-4">
        <div className="relative">
          <Icon nome="cerca" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400" />
          <input
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            placeholder="Cerca per cliente, R.G., tribunale..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-neutral-50 p-6 text-sm text-neutral-500">Caricamento...</div>
      ) : filtrate.length === 0 ? (
        <div className="rounded-2xl bg-neutral-50 py-16 text-center">
          <Icon nome="cerca" className="mx-auto h-10 w-10 text-neutral-200" />
          <p className="mt-3 text-sm text-neutral-500">
            {search ? 'Nessuna pratica corrisponde alla ricerca.' : 'Nessuna pratica con R.G. compilato.'}
          </p>
          {!search && (
            <p className="mt-1 text-xs text-neutral-400">
              Compila il R.G. nella pagina di una pratica perché compaia qui.
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtrate.map((m) => (
            <li key={m.id} className="rounded-2xl bg-neutral-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/pratiche/${m.id}`} className="font-medium text-neutral-900 hover:text-bordeaux-700">
                    {clientLabel(m.clients)}
                  </Link>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    R.G. <span className="font-semibold text-neutral-700">{m.rg_numero}{m.rg_anno && `/${m.rg_anno}`}</span>
                    {m.tribunale && <> — {m.tribunale}</>}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">{labelFromOptions(TIPI_PRATICA, m.tipo_pratica)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button" onClick={() => copiaRg(m)}
                    className="premi rounded-full bg-neutral-100 px-3.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                  >
                    {copiatoId === m.id ? 'Copiato' : 'Copia R.G.'}
                  </button>
                  <a
                    href={URL_PORTALE} target="_blank" rel="noopener noreferrer"
                    className="premi rounded-full bg-bordeaux-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-bordeaux-800"
                  >
                    Apri portale
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        Il portale del Ministero richiede una verifica manuale con CAPTCHA per ogni ricerca: nessuna
        automazione può completarla al posto tuo. Apri il portale, scegli Regione, Ufficio giudiziario e
        Registro, poi &quot;Ruolo generale&quot; e incolla il numero R.G. copiato da qui.
      </p>
    </div>
  );
}
