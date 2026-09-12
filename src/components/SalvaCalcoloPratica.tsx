'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { clientLabel, labelFromOptions, TIPI_PRATICA } from '@/lib/constants';

type Matter = { id: string; tipo_pratica: string; clients?: { nome: string | null; cognome: string | null; ragione_sociale: string | null; tipo_soggetto: string } };

export default function SalvaCalcoloPratica({ tipo, titolo, input, risultato, disabled = false }: {
  tipo: 'danno' | 'parcella' | 'interessi' | 'altro';
  titolo: string;
  input: Record<string, unknown>;
  risultato: unknown;
  disabled?: boolean;
}) {
  const supabase = createClient();
  const { studioId, userId } = useStudio();
  const [pratiche, setPratiche] = useState<Matter[]>([]);
  const [matterId, setMatterId] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    supabase.from('matters').select('id, tipo_pratica, clients(nome, cognome, ragione_sociale, tipo_soggetto)')
      .neq('stato', 'archiviata').order('created_at', { ascending: false })
      .then(({ data }) => setPratiche((data || []) as unknown as Matter[]));
  }, [supabase]);

  async function salva() {
    if (!matterId || disabled) return;
    setSalvando(true);
    setMessaggio('');
    const { error } = await supabase.from('calcoli_pratica').insert({
      studio_id: studioId, matter_id: matterId, tipo, titolo, input, risultato, creato_da: userId,
    });
    setSalvando(false);
    setMessaggio(error ? 'Applica la migrazione 037 per salvare i calcoli nel fascicolo.' : 'Calcolo salvato nella pratica.');
  }

  return (
    <div className="mt-5 border-t border-neutral-100 pt-4">
      <p className="mb-2 text-xs font-semibold text-neutral-700">Salva questo scenario nel fascicolo</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select value={matterId} onChange={(e) => setMatterId(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs">
          <option value="">Seleziona una pratica…</option>
          {pratiche.map((p) => <option key={p.id} value={p.id}>{clientLabel(p.clients)} · {labelFromOptions(TIPI_PRATICA, p.tipo_pratica)}</option>)}
        </select>
        <button type="button" onClick={salva} disabled={!matterId || disabled || salvando} className="premi rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
          {salvando ? 'Salvataggio…' : 'Salva nella pratica'}
        </button>
      </div>
      {messaggio && <p className={`mt-2 text-xs ${messaggio.startsWith('Calcolo') ? 'text-emerald-700' : 'text-amber-700'}`}>{messaggio}</p>}
    </div>
  );
}
