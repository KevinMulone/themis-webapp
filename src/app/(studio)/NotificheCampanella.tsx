'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';

type Notifica = {
  id: number; tipo: string; testo: string; link: string | null;
  destinatario_id: string | null; letta_at: string | null; created_at: string;
};

const ICONA: Record<string, string> = {
  incarico_assegnato: '📋', incarico_completato: '✅', eliminazione: '🗑️',
  prenotazione: '📅', documento_cliente: '📎', pec: '✉️', scadenza: '⏰',
};

function quando(iso: string): string {
  const minuti = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minuti < 1) return 'adesso';
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? 'ora' : 'ore'} fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

export default function NotificheCampanella() {
  const supabase = createClient();
  const router = useRouter();
  const { userId, ruolo } = useStudio();
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [aperto, setAperto] = useState(false);
  const [scheda, setScheda] = useState<'mie' | 'studio'>('mie');
  const contenitore = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    // Le scadenze non hanno un evento a cui agganciarsi: si avvicinano da
    // sole. Si generano qui, ed è innocuo rifarlo — un vincolo nel database
    // impedisce i doppioni.
    await supabase.rpc('genera_notifiche_scadenze');
    const { data } = await supabase
      .from('notifiche')
      .select('id, tipo, testo, link, destinatario_id, letta_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifiche((data || []) as Notifica[]);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Chiude il pannello cliccando fuori.
  useEffect(() => {
    if (!aperto) return;
    function fuori(e: MouseEvent) {
      if (contenitore.current && !contenitore.current.contains(e.target as Node)) setAperto(false);
    }
    document.addEventListener('mousedown', fuori);
    return () => document.removeEventListener('mousedown', fuori);
  }, [aperto]);

  const mie = notifiche.filter((n) => n.destinatario_id === userId);
  const studio = notifiche.filter((n) => n.destinatario_id === null);
  const visibili = scheda === 'mie' ? mie : studio;
  const nonLette = mie.filter((n) => !n.letta_at).length;

  async function segnaTutteLette() {
    const daSegnare = visibili.filter((n) => !n.letta_at).map((n) => n.id);
    if (daSegnare.length === 0) return;
    await supabase.from('notifiche').update({ letta_at: new Date().toISOString() }).in('id', daSegnare);
    load();
  }

  async function apri(n: Notifica) {
    if (!n.letta_at) {
      await supabase.from('notifiche').update({ letta_at: new Date().toISOString() }).eq('id', n.id);
    }
    setAperto(false);
    if (n.link) router.push(n.link);
    else load();
  }

  return (
    <div ref={contenitore} className="relative">
      <button
        onClick={() => { setAperto(!aperto); if (!aperto) load(); }}
        aria-label="Notifiche"
        className="relative rounded-md p-2 text-neutral-500 hover:bg-gold-100 hover:text-bordeaux-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {nonLette > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bordeaux-700 px-1 text-[10px] font-semibold text-white">
            {nonLette > 9 ? '9+' : nonLette}
          </span>
        )}
      </button>

      {aperto && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setScheda('mie')}
                className={`rounded px-2 py-1 ${scheda === 'mie' ? 'bg-gold-100 font-medium text-bordeaux-800' : 'text-neutral-500'}`}
              >
                Per me{nonLette > 0 ? ` (${nonLette})` : ''}
              </button>
              {ruolo === 'titolare' && (
                <button
                  onClick={() => setScheda('studio')}
                  className={`rounded px-2 py-1 ${scheda === 'studio' ? 'bg-gold-100 font-medium text-bordeaux-800' : 'text-neutral-500'}`}
                >
                  Studio
                </button>
              )}
            </div>
            <button onClick={segnaTutteLette} className="text-[11px] text-neutral-400 hover:text-bordeaux-700">
              Segna lette
            </button>
          </div>

          <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto">
            {visibili.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-neutral-400">Nessuna notifica.</li>
            ) : visibili.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => apri(n)}
                  className={`flex w-full gap-2 px-3 py-2.5 text-left hover:bg-neutral-50 ${n.letta_at ? '' : 'bg-gold-100/40'}`}
                >
                  <span className="text-sm">{ICONA[n.tipo] || '•'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-neutral-700">{n.testo}</span>
                    <span className="block text-[11px] text-neutral-400">{quando(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
