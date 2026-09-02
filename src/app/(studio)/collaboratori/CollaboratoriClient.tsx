'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { LABEL_AZIONE_STORICO } from '@/lib/incarichi';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

type Membro = {
  id: string; email: string; nome: string | null; ruolo: string; stato: string;
  invite_code: string | null; created_at: string; attivato_at: string | null;
};

type Attivita = {
  chiave: string; chi: string | null; testo: string; quando: string;
};

const STILE_STATO: Record<string, string> = {
  attivo: 'bg-green-100 text-green-700',
  invitato: 'bg-gold-100 text-gold-700',
  disattivato: 'bg-neutral-100 text-neutral-500',
};
const LABEL_STATO: Record<string, string> = {
  attivo: 'Attivo', invitato: 'Invito da accettare', disattivato: 'Disattivato',
};

/**
 * Le iniziali per il tondo colorato accanto al nome.
 *
 * Si prende dal nome quando c'è, altrimenti dall'email: un collaboratore
 * invitato e non ancora entrato non ha un nome, e lasciare il cerchio
 * vuoto lo farebbe sembrare un errore invece di un invito in attesa.
 */
function iniziali(nome: string | null, email: string): string {
  const base = (nome || email.split('@')[0] || '').trim();
  const parti = base.split(/[\s._-]+/).filter(Boolean);
  if (parti.length >= 2) return (parti[0][0] + parti[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function Avatar({ nome, email, grande = false }: { nome: string | null; email: string; grande?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-bordeaux-50 font-semibold text-bordeaux-700 ${
        grande ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs'
      }`}
    >
      {iniziali(nome, email)}
    </span>
  );
}

/** Le tre tessere che spiegano cosa garantisce la gestione collaboratori. */
function Garanzia({ icona, tinta, titolo, testo }: {
  icona: NomeIcona; tinta: string; titolo: string; testo: string;
}) {
  return (
    <div className="flex gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tinta}`}>
        <Icon nome={icona} className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">{titolo}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{testo}</p>
      </div>
    </div>
  );
}

export default function CollaboratoriClient() {
  const supabase = createClient();
  const [membri, setMembri] = useState<Membro[]>([]);
  const [posti, setPosti] = useState(0);
  const [plan, setPlan] = useState<string | null>(null);
  const [occupati, setOccupati] = useState(0);
  const [caricando, setCaricando] = useState(true);
  const [invitando, setInvitando] = useState(false);
  const [errore, setErrore] = useState('');
  const [linkGenerato, setLinkGenerato] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [attivita, setAttivita] = useState<Attivita[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/collaboratori');
    const body = await res.json();
    if (res.ok) {
      setMembri(body.collaboratori || []);
      setPosti(body.posti || 0);
      setOccupati(body.occupati || 0);
      setPlan(body.plan ?? null);
    }
    setCaricando(false);
  }, []);

  /**
   * Le ultime cose fatte dai collaboratori.
   *
   * Si legge da incarichi_storico, che è la traccia vera scritta dai
   * trigger del database — non falsificabile dall'interfaccia. Non ci
   * sono righe di "accesso effettuato" perché quel dato non lo
   * registriamo per collaboratore: mostrarlo comunque significherebbe
   * inventarlo.
   */
  const loadAttivita = useCallback(async () => {
    const { data } = await supabase
      .from('incarichi_storico')
      .select('id, azione, attore_nome, a_utente_nome, created_at, incarichi(titolo)')
      .order('created_at', { ascending: false })
      .limit(6);

    type Riga = {
      id: number; azione: string; attore_nome: string | null; a_utente_nome: string | null;
      created_at: string; incarichi: { titolo: string } | { titolo: string }[] | null;
    };

    setAttivita(((data || []) as unknown as Riga[]).map((r) => {
      const inc = Array.isArray(r.incarichi) ? r.incarichi[0] : r.incarichi;
      const verbo = LABEL_AZIONE_STORICO[r.azione] || r.azione;
      const a = (r.azione === 'assegnato' || r.azione === 'passato') && r.a_utente_nome
        ? ` a ${r.a_utente_nome}` : '';
      return {
        chiave: `s${r.id}`,
        chi: r.attore_nome,
        testo: `${verbo.replace('l’incarico', `«${inc?.titolo ?? 'incarico'}»`)}${a}`,
        quando: r.created_at,
      };
    }));
  }, [supabase]);

  useEffect(() => { load(); loadAttivita(); }, [load, loadAttivita]);

  async function handleInvita(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore('');
    setLinkGenerato(null);
    const form = new FormData(e.currentTarget);
    setInvitando(true);
    const res = await fetch('/api/collaboratori', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), nome: form.get('nome') }),
    });
    const body = await res.json();
    setInvitando(false);
    if (!res.ok) { setErrore(body.error || 'Invito non riuscito'); return; }
    (e.target as HTMLFormElement).reset();
    setLinkGenerato(`${window.location.origin}/unisciti?invito=${body.code}`);
    setCopiato(false);
    load();
  }

  async function handleCopia() {
    if (!linkGenerato) return;
    try {
      await navigator.clipboard.writeText(linkGenerato);
      setCopiato(true);
    } catch {
      setErrore('Copia non riuscita: seleziona e copia il link a mano.');
    }
  }

  async function handleCambiaStato(m: Membro, stato: 'attivo' | 'disattivato') {
    if (stato === 'disattivato' && !confirm(`Disattivare ${m.nome || m.email}? Perderà l'accesso, ma il suo lavoro resta.`)) return;
    const res = await fetch(`/api/collaboratori/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stato }),
    });
    if (!res.ok) { const b = await res.json(); alert(b.error || 'Operazione non riuscita'); return; }
    load();
  }

  async function handleRimuovi(m: Membro) {
    if (!confirm(`Rimuovere definitivamente ${m.nome || m.email}?\n\nL'account di accesso viene cancellato. Il lavoro già svolto resta nello studio.`)) return;
    const res = await fetch(`/api/collaboratori/${m.id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json(); alert(b.error || 'Rimozione non riuscita'); return; }
    load();
  }

  const postiEsauriti = occupati >= posti;
  // La barra non supera mai il pieno anche quando i collaboratori sono più
  // dei posti (succede dopo un declassamento di piano): un indicatore che
  // sfora il proprio contenitore sembra un difetto grafico, non un avviso.
  const percentuale = posti > 0 ? Math.min(100, Math.round((occupati / posti) * 100)) : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-neutral-900">Collaboratori</h1>
          <p className="mt-1 text-sm text-neutral-500">Gestisci il tuo team e i permessi di accesso</p>
        </div>
        <div className="min-w-64 rounded-xl bg-neutral-50 p-4">
          <div className="flex items-center gap-3">
            <Icon nome="collaboratori" className="h-5 w-5 shrink-0 text-neutral-400" />
            <p className="text-sm text-neutral-500">
              <span className="font-semibold text-neutral-900">{occupati} di {posti}</span> posti occupati
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full ${postiEsauriti ? 'bg-gold-500' : 'bg-bordeaux-700'}`}
              style={{ width: `${percentuale}%` }}
            />
          </div>
        </div>
      </div>

      {posti === 0 && (
        <p className="mb-4 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-800">
          Il piano attuale{plan ? ` (${plan})` : ''} non prevede collaboratori. I posti sono
          previsti dai piani Mensile (1), Semestrale (3) e Annuale (5).
        </p>
      )}
      {occupati > posti && (
        <p className="mb-4 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-800">
          Hai {occupati} collaboratori attivi ma il tuo piano ne prevede {posti}. Nessuno perde
          l&apos;accesso, ma non puoi invitarne di nuovi: disattiva chi non ti serve, oppure passa
          a un piano con più posti.
        </p>
      )}

      <div className="mb-4 rounded-2xl bg-neutral-50 p-6">
        <h2 className="mb-4 font-semibold text-neutral-900">Chi collabora con te</h2>
        {caricando ? (
          <p className="text-sm text-neutral-500">Caricamento...</p>
        ) : membri.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 py-10 text-center">
            <Icon nome="collaboratori" className="mx-auto h-10 w-10 text-neutral-200" />
            <p className="mt-3 text-sm text-neutral-500">Nessun collaboratore.</p>
            <p className="text-sm text-neutral-400">Invitane uno qui sotto.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {membri.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3"
              >
                <Avatar nome={m.nome} email={m.email} grande />
                <div className="min-w-40 flex-1">
                  <div className="font-medium text-neutral-900">{m.nome || m.email.split('@')[0]}</div>
                  <div className="text-xs text-neutral-400">{m.email}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STILE_STATO[m.stato] || ''}`}>
                  {LABEL_STATO[m.stato] || m.stato}
                </span>
                {m.stato === 'disattivato' ? (
                  <button onClick={() => handleCambiaStato(m, 'attivo')} className="text-sm text-bordeaux-700 hover:underline">
                    Riattiva
                  </button>
                ) : (
                  <button onClick={() => handleCambiaStato(m, 'disattivato')} className="text-sm text-neutral-600 hover:underline">
                    Disattiva
                  </button>
                )}
                <button onClick={() => handleRimuovi(m)} className="text-sm text-red-600 hover:underline">
                  Rimuovi
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4 rounded-2xl bg-neutral-50 p-6">
        <h2 className="font-semibold text-neutral-900">Invita un collaboratore</h2>
        {linkGenerato ? (
          <>
            <p className="mb-3 mt-1 text-sm text-neutral-500">
              Invito creato. Copia questo link e mandalo alla persona: lo aprirà, sceglierà una
              password ed entrerà nello studio.
            </p>
            <input
              readOnly value={linkGenerato} onFocus={(e) => e.currentTarget.select()}
              className="mb-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            />
            <p className="mb-3 text-xs text-neutral-400">Il link vale 7 giorni.</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopia}
                className="premi rounded-full bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bordeaux-800"
              >
                {copiato ? 'Copiato!' : 'Copia link'}
              </button>
              <button
                onClick={() => setLinkGenerato(null)}
                className="premi rounded-full bg-neutral-100 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-200"
              >
                Invita un altro
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleInvita}>
            <p className="mb-4 mt-1 text-sm text-neutral-500">
              Il link va consegnato a mano — via email, messaggio o di persona. Themis non manda
              email da solo.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="relative">
                <Icon nome="utente" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400" />
                <input
                  name="nome" placeholder="Nome e cognome (facoltativo)"
                  className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                />
              </div>
              <div className="relative">
                <Icon nome="pec" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400" />
                <input
                  name="email" type="email" required placeholder="Email"
                  className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                />
              </div>
            </div>
            {errore && <p className="mt-3 text-sm text-red-600">{errore}</p>}
            <div className="mt-4 flex justify-end">
              <button
                type="submit" disabled={invitando || postiEsauriti}
                title={postiEsauriti ? 'Non ci sono posti liberi nel tuo piano' : undefined}
                className="flex items-center gap-2 premi rounded-full bg-bordeaux-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
              >
                <Icon nome="invio" className="h-[18px] w-[18px]" />
                {invitando ? 'Creazione invito...' : 'Genera link di invito'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-6 rounded-2xl bg-neutral-50 p-6 md:grid-cols-3 md:divide-x md:divide-neutral-100">
        <Garanzia
          icona="lucchetto" tinta="bg-violet-50 text-violet-500" titolo="Sicuro"
          testo="Fatturazione, caselle PEC ed eliminazioni restano solo tue."
        />
        <div className="md:pl-6">
          <Garanzia
            icona="collaboratori" tinta="bg-emerald-50 text-emerald-500" titolo="Semplice"
            testo="Inviti, disattivi e rimuovi in pochi passaggi, senza toccare i dati."
          />
        </div>
        <div className="md:pl-6">
          <Garanzia
            icona="scudo" tinta="bg-sky-50 text-sky-500" titolo="Tracciabile"
            testo="Ogni passaggio di lavoro è registrato dal database, non dall'interfaccia."
          />
        </div>
      </div>

      <div className="rounded-2xl bg-neutral-50 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-neutral-900">Attività recenti</h2>
          <Link
            href="/attivita"
            className="flex items-center gap-1.5 text-sm font-medium text-bordeaux-700 hover:underline"
          >
            Vedi tutte le attività
            <Icon nome="freccia" className="h-4 w-4" />
          </Link>
        </div>

        {attivita.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">
            Nessuna attività registrata finora.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                  <th className="pb-2 font-medium">Collaboratore</th>
                  <th className="pb-2 font-medium">Azione</th>
                  <th className="pb-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {attivita.map((a) => (
                  <tr key={a.chiave} className="border-b border-neutral-50 last:border-0">
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2.5">
                        <Avatar nome={a.chi} email={a.chi || '?'} />
                        <span className="font-medium text-neutral-800">{a.chi || 'Sconosciuto'}</span>
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-neutral-600">{a.testo}</td>
                    <td className="py-3 whitespace-nowrap text-neutral-500">
                      {new Date(a.quando).toLocaleString('it-IT', {
                        day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
