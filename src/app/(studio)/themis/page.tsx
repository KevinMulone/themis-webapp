'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { TIPI_PRATICA, labelFromOptions, clientLabel } from '@/lib/constants';
import ChiediAlFascicolo from '../pratiche/[id]/ChiediAlFascicolo';
import RedigiAtto from '../pratiche/[id]/RedigiAtto';

type Matter = {
  id: string;
  tipo_pratica: string;
  controparte_nome: string | null;
  clients?: { nome: string | null; cognome: string | null; ragione_sociale: string | null; tipo_soggetto: string };
};
type Documento = { id: string; nome_file: string };

/**
 * La stessa Themis della pagina della pratica, raggiungibile dal menu.
 *
 * I due riquadri non sono riscritti: sono gli stessi componenti, montati
 * qui dopo aver scelto la pratica. Se un domani cambia il riquadro nel
 * fascicolo, cambia anche questo — che è il motivo per cui non l'ho
 * duplicato.
 */
export default function ThemisPage() {
  const supabase = createClient();
  const [pratiche, setPratiche] = useState<Matter[]>([]);
  const [matterId, setMatterId] = useState('');
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('matters')
        .select('id, tipo_pratica, controparte_nome, clients(nome, cognome, ragione_sociale, tipo_soggetto)')
        .neq('stato', 'archiviata')
        .order('data_apertura', { ascending: false });
      setPratiche((data as unknown as Matter[]) || []);
      setCaricando(false);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!matterId) { setDocumenti([]); return; }
    (async () => {
      const { data } = await supabase
        .from('documenti').select('id, nome_file').eq('matter_id', matterId)
        .order('data_generazione', { ascending: false });
      setDocumenti(data || []);
    })();
  }, [matterId, supabase]);

  async function ricaricaDocumenti() {
    if (!matterId) return;
    const { data } = await supabase
      .from('documenti').select('id, nome_file').eq('matter_id', matterId)
      .order('data_generazione', { ascending: false });
    setDocumenti(data || []);
  }

  const scelta = pratiche.find((p) => p.id === matterId);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Themis</h1>
        <p className="mt-1 text-sm text-neutral-500">
          L&apos;assistente dello studio. Scegli una pratica: Themis legge quel fascicolo,
          risponde su ciò che vi trova e prepara la prima stesura degli atti.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <label className="mb-1 block text-xs font-medium text-neutral-600">Pratica</label>
        <select
          value={matterId} onChange={(e) => setMatterId(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          disabled={caricando}
        >
          <option value="">
            {caricando ? 'Caricamento delle pratiche...' : '— scegli la pratica —'}
          </option>
          {pratiche.map((p) => (
            <option key={p.id} value={p.id}>
              {clientLabel(p.clients)} — {labelFromOptions(TIPI_PRATICA, p.tipo_pratica)}
              {p.controparte_nome ? ` c. ${p.controparte_nome}` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-400">
          Themis lavora su una pratica alla volta: non mette insieme fascicoli diversi.
        </p>

        {scelta && (
          <p className="mt-3 text-xs text-neutral-500">
            {documenti.length === 0
              ? 'Questa pratica non ha documenti allegati: Themis potrà basarsi solo sui dati della scheda.'
              : `${documenti.length} document${documenti.length === 1 ? 'o' : 'i'} nel fascicolo.`}
            {' '}
            <Link href={`/pratiche/${scelta.id}`} className="text-bordeaux-700 hover:underline">
              Apri la pratica
            </Link>
          </p>
        )}
      </div>

      {!matterId ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
          <p className="text-sm text-neutral-500">
            Scegli una pratica qui sopra per cominciare.
          </p>
        </div>
      ) : (
        <>
          <ChiediAlFascicolo key={`d-${matterId}`} matterId={matterId} documenti={documenti} />
          <RedigiAtto
            key={`a-${matterId}`} matterId={matterId} documenti={documenti}
            onSalvato={ricaricaDocumenti}
          />
        </>
      )}
    </div>
  );
}
