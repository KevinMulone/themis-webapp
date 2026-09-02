'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TIPI_PRATICA, labelFromOptions, clientLabel } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';
import PreparaDeposito from './PreparaDeposito';

type Client = { id: string; tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null };
type Matter = {
  id: string; client_id: string; tipo_pratica: string;
  tribunale: string | null; sezione: string | null;
  rg_numero: string | null; rg_anno: string | null; giudice: string | null;
  controparte_nome: string | null; data_apertura: string | null;
  numero_riferimento: string | null;
  clients?: Client;
};
type Documento = { id: string; nome_file: string; data_generazione: string };

function riferimento(m: Matter): string | null {
  if (m.rg_numero) return `R.G. ${m.rg_numero}${m.rg_anno ? `/${m.rg_anno}` : ''}`;
  if (m.numero_riferimento) return `N. ${m.numero_riferimento}`;
  return null;
}

function inizialiCliente(c: Client | undefined): string {
  const base = clientLabel(c).trim();
  const parti = base.split(/\s+/).filter(Boolean);
  if (parti.length >= 2) return (parti[0][0] + parti[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase() || '—';
}

export default function DepositoPage() {
  const supabase = createClient();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [cerca, setCerca] = useState('');
  const [selezionata, setSelezionata] = useState<Matter | null>(null);
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [caricandoDocumenti, setCaricandoDocumenti] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('matters')
        .select('id, client_id, tipo_pratica, tribunale, sezione, rg_numero, rg_anno, giudice, controparte_nome, data_apertura, numero_riferimento, clients(id, tipo_soggetto, nome, cognome, ragione_sociale)')
        .neq('stato', 'archiviata')
        .order('updated_at', { ascending: false });
      setMatters((data as unknown as Matter[]) || []);
      setLoading(false);
    })();
  }, [supabase]);

  const filtrate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return matters;
    return matters.filter((m) => {
      const testo = [
        clientLabel(m.clients), m.tribunale, m.controparte_nome, riferimento(m),
        labelFromOptions(TIPI_PRATICA, m.tipo_pratica),
      ].filter(Boolean).join(' ').toLowerCase();
      return testo.includes(q);
    });
  }, [matters, cerca]);

  async function caricaDocumenti(matterId: string) {
    setCaricandoDocumenti(true);
    const { data } = await supabase
      .from('documenti').select('id, nome_file, data_generazione')
      .eq('matter_id', matterId).order('data_generazione', { ascending: false });
    setDocumenti(data || []);
    setCaricandoDocumenti(false);
  }

  async function selezionaPratica(m: Matter) {
    setSelezionata(m);
    await caricaDocumenti(m.id);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-neutral-900">Deposito</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Scegli la pratica: preparo il prontuario da copiare in SLpct e il pacchetto con atto e allegati già ordinati.
        </p>
      </div>

      {selezionata ? (
        <>
          <button
            type="button" onClick={() => setSelezionata(null)}
            className="premi mb-4 flex items-center gap-2 rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
          >
            <Icon nome="freccia" className="h-3.5 w-3.5 rotate-180" />
            Cambia pratica
          </button>

          <div className="mb-4 flex items-center gap-3 rounded-xl bg-neutral-50 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bordeaux-700/[0.08] text-sm font-semibold text-bordeaux-700">
              {inizialiCliente(selezionata.clients)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-neutral-900">{clientLabel(selezionata.clients)}</div>
              <div className="truncate text-xs text-neutral-500">
                {labelFromOptions(TIPI_PRATICA, selezionata.tipo_pratica)}
                {riferimento(selezionata) ? ` — ${riferimento(selezionata)}` : ''}
              </div>
            </div>
          </div>

          {caricandoDocumenti ? (
            <p className="text-sm text-neutral-500">Caricamento...</p>
          ) : (
            <PreparaDeposito
              matterId={selezionata.id}
              clientId={selezionata.client_id}
              matter={{
                tipo_pratica: selezionata.tipo_pratica, tribunale: selezionata.tribunale, sezione: selezionata.sezione,
                rg_numero: selezionata.rg_numero, rg_anno: selezionata.rg_anno, giudice: selezionata.giudice,
                controparte_nome: selezionata.controparte_nome, data_apertura: selezionata.data_apertura,
              }}
              documenti={documenti}
              onDocumentiCambiati={() => caricaDocumenti(selezionata.id)}
            />
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2.5">
            <Icon nome="pratiche" className="h-4 w-4 text-neutral-400" />
            <input
              value={cerca} onChange={(e) => setCerca(e.target.value)}
              placeholder="Cerca cliente, tribunale, R.G., controparte..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500">Caricamento...</p>
          ) : filtrate.length === 0 ? (
            <p className="text-sm text-neutral-500">Nessuna pratica trovata.</p>
          ) : (
            <div className="divide-y divide-neutral-100 rounded-xl bg-neutral-50">
              {filtrate.map((m) => (
                <button
                  key={m.id} type="button" onClick={() => selezionaPratica(m)}
                  className="premi flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-100"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-neutral-600">
                    {inizialiCliente(m.clients)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-900">{clientLabel(m.clients)}</div>
                    <div className="truncate text-xs text-neutral-500">
                      {labelFromOptions(TIPI_PRATICA, m.tipo_pratica)}
                      {m.tribunale ? ` — ${m.tribunale}` : ''}
                      {riferimento(m) ? ` — ${riferimento(m)}` : ''}
                    </div>
                  </div>
                  <Icon nome="freccia" className="h-4 w-4 shrink-0 text-neutral-300" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
