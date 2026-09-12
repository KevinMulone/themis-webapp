'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';

type Parte = { id: string; ruolo: string; nome: string | null; contatti: string | null };
type Verifica = { id: string; tipo: string; esito: string; verificato_at: string; note: string | null };
type Calcolo = { id: string; tipo: string; titolo: string; created_at: string; risultato: Record<string, unknown> };

const LABEL_RUOLO: Record<string, string> = {
  assistito: 'Assistito', controparte: 'Controparte', avvocato_controparte: 'Avvocato di controparte',
  consulente: 'Consulente', testimone: 'Testimone', altro: 'Altro',
};
const CONTROLLI = [
  ['conflitto_interessi', 'Conflitto d’interessi'], ['adeguata_verifica', 'Adeguata verifica'],
  ['privacy', 'Privacy e consenso'], ['mandato', 'Mandato professionale'],
] as const;

export default function ControlliPratica({ studioId, matterId, clientId }: { studioId: string; matterId: string; clientId: string }) {
  const supabase = createClient();
  const { userId } = useStudio();
  const [parti, setParti] = useState<Parte[]>([]);
  const [verifiche, setVerifiche] = useState<Verifica[]>([]);
  const [calcoli, setCalcoli] = useState<Calcolo[]>([]);
  const [nuovaParte, setNuovaParte] = useState(false);
  const [disponibile, setDisponibile] = useState(true);

  async function load() {
    const [p, v, c] = await Promise.all([
      supabase.from('matter_parti').select('id, ruolo, nome, contatti').eq('matter_id', matterId).order('created_at'),
      supabase.from('verifiche_cliente').select('id, tipo, esito, verificato_at, note').eq('client_id', clientId).order('verificato_at', { ascending: false }),
      supabase.from('calcoli_pratica').select('id, tipo, titolo, created_at, risultato').eq('matter_id', matterId).order('created_at', { ascending: false }),
    ]);
    setDisponibile(!p.error && !v.error && !c.error);
    setParti((p.data || []) as Parte[]); setVerifiche((v.data || []) as Verifica[]); setCalcoli((c.data || []) as Calcolo[]);
  }
  useEffect(() => { load(); }, [matterId, clientId]);

  async function registraVerifica(tipo: string, esito: 'positivo' | 'negativo') {
    const note = prompt(esito === 'positivo' ? 'Nota della verifica (opzionale)' : 'Descrivi il rischio o il conflitto rilevato');
    if (note === null) return;
    const { error } = await supabase.from('verifiche_cliente').insert({
      studio_id: studioId, client_id: clientId, tipo, esito, note: note.trim() || null, verificato_da: userId,
    });
    if (error) { alert('Applica la migrazione 037 prima di registrare i controlli.'); return; }
    load();
  }

  async function aggiungiParte(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.from('matter_parti').insert({
      studio_id: studioId, matter_id: matterId, ruolo: String(form.get('ruolo')),
      nome: String(form.get('nome') || '').trim(), contatti: String(form.get('contatti') || '').trim() || null,
    });
    if (error) { alert('Applica la migrazione 037 prima di aggiungere le parti.'); return; }
    setNuovaParte(false); load();
  }

  const ultima = (tipo: string) => verifiche.find((v) => v.tipo === tipo);

  return (
    <div id="controlli-pratica" className="scroll-mt-24 mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {!disponibile && <p className="lg:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">I nuovi registri professionali saranno disponibili dopo l’applicazione della migrazione 037.</p>}
      <section className="rounded-2xl bg-white p-6 ring-1 ring-black/[0.04]">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-neutral-900">Parti e professionisti</h2><button onClick={() => setNuovaParte(!nuovaParte)} className="text-xs font-semibold text-bordeaux-700">+ Aggiungi</button></div>
        {parti.length === 0 ? <p className="text-sm text-neutral-500">Aggiungi controparti, difensori e consulenti.</p> : (
          <ul className="divide-y divide-neutral-100 text-sm">{parti.map((p) => <li key={p.id} className="py-2"><span className="font-medium text-neutral-800">{p.nome}</span><span className="ml-2 text-xs text-neutral-500">{LABEL_RUOLO[p.ruolo] || p.ruolo}</span>{p.contatti && <p className="text-xs text-neutral-400">{p.contatti}</p>}</li>)}</ul>
        )}
        {nuovaParte && <form onSubmit={aggiungiParte} className="mt-3 grid gap-2 border-t border-neutral-100 pt-3"><select name="ruolo" className="rounded-xl border border-neutral-200 px-3 py-2 text-sm">{Object.entries(LABEL_RUOLO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><input name="nome" required placeholder="Nome o denominazione" className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"/><input name="contatti" placeholder="PEC, email o telefono" className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"/><button className="rounded-full bg-bordeaux-700 px-4 py-2 text-xs font-semibold text-white">Salva parte</button></form>}
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-black/[0.04]">
        <h2 className="mb-3 font-semibold text-neutral-900">Controlli professionali</h2>
        <ul className="space-y-2">{CONTROLLI.map(([tipo, label]) => { const v = ultima(tipo); return <li key={tipo} className="rounded-xl bg-neutral-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-neutral-800">{label}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${v?.esito === 'positivo' ? 'bg-emerald-100 text-emerald-700' : v?.esito === 'negativo' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{v?.esito === 'positivo' ? 'Verificato' : v?.esito === 'negativo' ? 'Criticità' : 'Da verificare'}</span></div><div className="mt-2 flex gap-2"><button onClick={() => registraVerifica(tipo, 'positivo')} className="text-[11px] font-semibold text-emerald-700">Esito positivo</button><button onClick={() => registraVerifica(tipo, 'negativo')} className="text-[11px] font-semibold text-red-700">Segnala criticità</button></div>{v?.note && <p className="mt-1 text-[11px] text-neutral-500">{v.note}</p>}</li>; })}</ul>
      </section>

      {calcoli.length > 0 && <section className="rounded-2xl bg-white p-6 ring-1 ring-black/[0.04] lg:col-span-2"><h2 className="mb-3 font-semibold text-neutral-900">Calcoli salvati</h2><ul className="grid gap-2 sm:grid-cols-2">{calcoli.map((c) => <li key={c.id} className="rounded-xl bg-neutral-50 p-3"><p className="text-sm font-medium text-neutral-800">{c.titolo}</p><p className="text-[11px] text-neutral-400">{new Date(c.created_at).toLocaleString('it-IT')}</p></li>)}</ul></section>}
    </div>
  );
}
