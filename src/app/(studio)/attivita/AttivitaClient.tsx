'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { LABEL_AZIONE_STORICO } from '@/lib/incarichi';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';

type Categoria = 'incarichi' | 'eliminazioni' | 'portale' | 'pec' | 'scadenze' | 'altro';

type Voce = {
  chiave: string;
  quando: string;
  chi: string | null;
  testo: string;
  link: string | null;
  categoria: Categoria;
};

const LABEL_CATEGORIA: Record<Categoria, string> = {
  incarichi: 'Incarichi',
  eliminazioni: 'Eliminazioni',
  portale: 'Portale clienti',
  pec: 'PEC',
  scadenze: 'Scadenze',
  altro: 'Altro',
};

const STILE_CATEGORIA: Record<Categoria, string> = {
  incarichi: 'bg-bordeaux-50 text-bordeaux-700',
  eliminazioni: 'bg-red-100 text-red-700',
  portale: 'bg-green-100 text-green-700',
  pec: 'bg-gold-100 text-gold-700',
  scadenze: 'bg-neutral-100 text-neutral-600',
  altro: 'bg-neutral-100 text-neutral-500',
};

function categoriaDaTipo(tipo: string): Categoria {
  if (tipo === 'eliminazione') return 'eliminazioni';
  if (tipo === 'prenotazione' || tipo === 'documento_cliente') return 'portale';
  if (tipo === 'pec') return 'pec';
  if (tipo === 'scadenza') return 'scadenze';
  if (tipo.startsWith('incarico')) return 'incarichi';
  return 'altro';
}

function giornoLabel(iso: string): string {
  const d = new Date(iso);
  const oggi = new Date();
  const ieri = new Date(Date.now() - 86400000);
  const stessoGiorno = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (stessoGiorno(d, oggi)) return 'Oggi';
  if (stessoGiorno(d, ieri)) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function AttivitaClient() {
  const supabase = createClient();
  const [voci, setVoci] = useState<Voce[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | ''>('');
  const [filtroPersona, setFiltroPersona] = useState('');

  const load = useCallback(async () => {
    const [{ data: storico }, { data: notifiche }] = await Promise.all([
      supabase.from('incarichi_storico')
        .select('id, azione, attore_nome, a_utente_nome, created_at, incarichi(titolo, matter_id)')
        .order('created_at', { ascending: false }).limit(200),
      // Solo le notifiche "di studio": quelle personali sono di chi le riceve.
      supabase.from('notifiche')
        .select('id, tipo, testo, link, attore_nome, created_at')
        .is('destinatario_id', null)
        .order('created_at', { ascending: false }).limit(200),
    ]);

    type RigaStorico = {
      id: number; azione: string; attore_nome: string | null; a_utente_nome: string | null;
      created_at: string; incarichi: { titolo: string; matter_id: string | null } | { titolo: string; matter_id: string | null }[] | null;
    };

    const daStorico: Voce[] = ((storico || []) as unknown as RigaStorico[]).map((r) => {
      const inc = Array.isArray(r.incarichi) ? r.incarichi[0] : r.incarichi;
      const verbo = LABEL_AZIONE_STORICO[r.azione] || r.azione;
      const a = (r.azione === 'assegnato' || r.azione === 'passato') && r.a_utente_nome
        ? ` a ${r.a_utente_nome}` : '';
      return {
        chiave: `s${r.id}`,
        quando: r.created_at,
        chi: r.attore_nome,
        testo: `${verbo.replace('l’incarico', `«${inc?.titolo ?? 'incarico'}»`)}${a}`,
        link: inc?.matter_id ? `/pratiche/${inc.matter_id}` : '/incarichi',
        categoria: 'incarichi',
      };
    });

    type RigaNotifica = {
      id: number; tipo: string; testo: string; link: string | null;
      attore_nome: string | null; created_at: string;
    };

    const daNotifiche: Voce[] = ((notifiche || []) as RigaNotifica[]).map((n) => ({
      chiave: `n${n.id}`,
      quando: n.created_at,
      // Il testo delle notifiche di studio contiene già chi ha agito, quindi
      // qui non lo si ripete come colonna a parte.
      chi: null,
      testo: n.testo,
      link: n.link,
      categoria: categoriaDaTipo(n.tipo),
    }));

    setVoci([...daStorico, ...daNotifiche].sort((a, b) => b.quando.localeCompare(a.quando)));
    setCaricando(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);
  useAggiornamentoLive(['notifiche', 'incarichi_storico'], load);

  const persone = Array.from(new Set(voci.map((v) => v.chi).filter(Boolean) as string[])).sort();

  const visibili = voci
    .filter((v) => (filtroCategoria ? v.categoria === filtroCategoria : true))
    .filter((v) => (filtroPersona ? v.chi === filtroPersona : true));

  // Raggruppa per giorno mantenendo l'ordine.
  const gruppi: { giorno: string; voci: Voce[] }[] = [];
  for (const v of visibili) {
    const g = giornoLabel(v.quando);
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.giorno === g) ultimo.voci.push(v);
    else gruppi.push({ giorno: g, voci: [v] });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-display font-semibold text-neutral-900">Registro attività</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Tutto ciò che accade nello studio, in ordine di tempo. Lo scrive il database, non
        l&apos;applicazione: nessuno può modificarlo.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value as Categoria | '')}
          className="rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
        >
          <option value="">Tutte le attività</option>
          {(Object.keys(LABEL_CATEGORIA) as Categoria[]).map((c) => (
            <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>
          ))}
        </select>
        {persone.length > 0 && (
          <select
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
            className="rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
          >
            <option value="">Chiunque</option>
            {persone.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      <div className="rounded-xl bg-neutral-50 p-6">
        {caricando ? (
          <p className="text-sm text-neutral-500">Caricamento...</p>
        ) : gruppi.length === 0 ? (
          <p className="text-sm text-neutral-500">Nessuna attività registrata.</p>
        ) : (
          gruppi.map((g) => (
            <div key={g.giorno} className="mb-5 last:mb-0">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {g.giorno}
              </h2>
              <ul className="space-y-2 text-sm">
                {g.voci.map((v) => {
                  const riga = (
                    <>
                      <span className="w-11 flex-shrink-0 text-xs text-neutral-400">
                        {new Date(v.quando).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] ${STILE_CATEGORIA[v.categoria]}`}>
                        {LABEL_CATEGORIA[v.categoria]}
                      </span>
                      <span className="min-w-0 text-neutral-700">
                        {v.chi && <strong className="font-medium">{v.chi} </strong>}
                        {v.testo}
                      </span>
                    </>
                  );
                  return (
                    <li key={v.chiave}>
                      {v.link ? (
                        <Link href={v.link} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-neutral-50">
                          {riga}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-2 px-1 py-1">{riga}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
