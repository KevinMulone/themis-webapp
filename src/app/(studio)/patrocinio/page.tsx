'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clientLabel } from '@/lib/constants';

type Riga = {
  matter_id: string;
  cliente: { nome: string | null; cognome: string | null; ragione_sociale: string | null; tipo_soggetto: string } | null;
  tribunale: string | null;
  stato_istanza: string | null;
  data_decreto_liquidazione: string | null;
  importo_liquidato_cent: number | null;
  opposizione_proposta: boolean;
  fattura_emessa: boolean;
  pagamento_incassato: boolean;
};

function euro(cent: number | null): string {
  if (cent == null) return '—';
  return (cent / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export default function PatrocinioPage() {
  const supabase = createClient();
  const [righe, setRighe] = useState<Riga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: matters }, { data: patrocini }] = await Promise.all([
        supabase.from('matters')
          .select('id, tribunale, clients(nome, cognome, ragione_sociale, tipo_soggetto)')
          .eq('metodo_pagamento', 'gratuito_patrocinio')
          .neq('stato', 'archiviata'),
        supabase.from('patrocini_spese_stato').select('*'),
      ]);
      const byMatter = new Map((patrocini || []).map((p) => [p.matter_id, p]));

      const righeCalcolate: Riga[] = (matters || []).map((m) => {
        const p = byMatter.get(m.id);
        return {
          matter_id: m.id,
          cliente: (m as unknown as { clients: Riga['cliente'] }).clients,
          tribunale: m.tribunale,
          stato_istanza: p?.stato_istanza ?? null,
          data_decreto_liquidazione: p?.data_decreto_liquidazione ?? null,
          importo_liquidato_cent: p?.importo_liquidato_cent ?? null,
          opposizione_proposta: p?.opposizione_proposta ?? false,
          fattura_emessa: p?.fattura_emessa ?? false,
          pagamento_incassato: p?.pagamento_incassato ?? false,
        };
      });
      setRighe(righeCalcolate);
      setLoading(false);
    })();
  }, []);

  function daFare(r: Riga): string | null {
    if (!r.stato_istanza) return 'Nessun dato: apri la pratica per compilare il tracciamento';
    if (r.stato_istanza === 'depositata') return 'In attesa di ammissione';
    if (r.stato_istanza === 'ammessa' && !r.data_decreto_liquidazione) return 'In attesa del decreto di liquidazione';
    if (r.data_decreto_liquidazione && !r.fattura_emessa) return 'Decreto arrivato: emettere fattura';
    if (r.fattura_emessa && !r.pagamento_incassato) return 'Fattura emessa: in attesa di incasso';
    return null;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-display font-semibold text-neutral-900">Patrocinio a spese dello Stato</h1>
      <p className="mb-6 text-xs text-neutral-500">
        Tutte le pratiche con pagamento a carico dello Stato, con lo stato di avanzamento di ciascuna.
      </p>

      {loading ? (
        <p className="text-sm text-neutral-500">Caricamento...</p>
      ) : righe.length === 0 ? (
        <div className="rounded-xl bg-neutral-50 p-6 text-sm text-neutral-500">
          Nessuna pratica con metodo di pagamento "Gratuito patrocinio".
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-neutral-50">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Tribunale</th>
                <th className="px-4 py-2">Istanza</th>
                <th className="px-4 py-2">Decreto</th>
                <th className="px-4 py-2">Importo</th>
                <th className="px-4 py-2">Da fare</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => {
                const attenzione = daFare(r);
                return (
                  <tr key={r.matter_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-2">
                      <Link href={`/pratiche/${r.matter_id}`} className="font-medium text-bordeaux-700 hover:underline">
                        {clientLabel(r.cliente)}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{r.tribunale || '—'}</td>
                    <td className="px-4 py-2">{r.stato_istanza || '—'}</td>
                    <td className="px-4 py-2">{r.data_decreto_liquidazione || '—'}</td>
                    <td className="px-4 py-2">{euro(r.importo_liquidato_cent)}</td>
                    <td className="px-4 py-2">
                      {attenzione ? (
                        <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs text-gold-700">{attenzione}</span>
                      ) : (
                        <span className="text-xs text-green-700">Completato</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
