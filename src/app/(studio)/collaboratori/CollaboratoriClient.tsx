'use client';

import { useEffect, useState } from 'react';

type Membro = {
  id: string; email: string; nome: string | null; ruolo: string; stato: string;
  invite_code: string | null; created_at: string; attivato_at: string | null;
};

const STILE_STATO: Record<string, string> = {
  attivo: 'bg-green-100 text-green-700',
  invitato: 'bg-gold-100 text-gold-700',
  disattivato: 'bg-neutral-100 text-neutral-500',
};
const LABEL_STATO: Record<string, string> = {
  attivo: 'Attivo', invitato: 'Invito da accettare', disattivato: 'Disattivato',
};

export default function CollaboratoriClient() {
  const [membri, setMembri] = useState<Membro[]>([]);
  const [posti, setPosti] = useState(0);
  const [occupati, setOccupati] = useState(0);
  const [caricando, setCaricando] = useState(true);
  const [invitando, setInvitando] = useState(false);
  const [errore, setErrore] = useState('');
  const [linkGenerato, setLinkGenerato] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);

  async function load() {
    const res = await fetch('/api/collaboratori');
    const body = await res.json();
    if (res.ok) {
      setMembri(body.collaboratori || []);
      setPosti(body.posti || 0);
      setOccupati(body.occupati || 0);
    }
    setCaricando(false);
  }

  useEffect(() => { load(); }, []);

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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-display font-semibold text-neutral-900">Collaboratori</h1>
        <span className="text-sm text-neutral-500">{occupati} di {posti} posti occupati</span>
      </div>

      {posti === 0 && (
        <p className="mb-4 rounded-md bg-gold-100 px-4 py-3 text-sm text-gold-700">
          Il tuo piano non prevede collaboratori. Passa a un piano superiore per aggiungerne.
        </p>
      )}
      {occupati > posti && (
        <p className="mb-4 rounded-md bg-gold-100 px-4 py-3 text-sm text-gold-700">
          Hai {occupati} collaboratori attivi ma il tuo piano ne prevede {posti}. Nessuno perde
          l&apos;accesso, ma non puoi invitarne di nuovi: disattiva chi non ti serve, oppure passa
          a un piano con più posti.
        </p>
      )}

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Chi collabora con te</h2>
        {caricando ? (
          <p className="text-sm text-neutral-500">Caricamento...</p>
        ) : membri.length === 0 ? (
          <p className="text-sm text-neutral-500">Nessun collaboratore. Invitane uno qui sotto.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {membri.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <div className="font-medium text-neutral-800">{m.nome || '—'}</div>
                  <div className="text-xs text-neutral-400">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${STILE_STATO[m.stato] || ''}`}>
                    {LABEL_STATO[m.stato] || m.stato}
                  </span>
                  {m.stato === 'disattivato' ? (
                    <button onClick={() => handleCambiaStato(m, 'attivo')} className="text-xs text-bordeaux-700 hover:underline">
                      Riattiva
                    </button>
                  ) : (
                    <button onClick={() => handleCambiaStato(m, 'disattivato')} className="text-xs text-neutral-600 hover:underline">
                      Disattiva
                    </button>
                  )}
                  <button onClick={() => handleRimuovi(m)} className="text-xs text-red-600 hover:underline">
                    Rimuovi
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Invita un collaboratore</h2>
        {linkGenerato ? (
          <>
            <p className="mb-2 text-sm text-neutral-600">
              Invito creato. Copia questo link e mandalo alla persona: lo aprirà, sceglierà una
              password ed entrerà nello studio.
            </p>
            <input
              readOnly value={linkGenerato} onFocus={(e) => e.currentTarget.select()}
              className="mb-3 w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm"
            />
            <p className="mb-3 text-xs text-neutral-400">Il link vale 7 giorni.</p>
            <div className="flex gap-2">
              <button onClick={handleCopia} className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">
                {copiato ? 'Copiato!' : 'Copia link'}
              </button>
              <button onClick={() => setLinkGenerato(null)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
                Invita un altro
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleInvita} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input name="nome" placeholder="Nome e cognome (facoltativo)" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            <input name="email" type="email" required placeholder="Email" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            {errore && <p className="col-span-full text-sm text-red-600">{errore}</p>}
            <div className="col-span-full flex justify-end">
              <button
                type="submit" disabled={invitando || postiEsauriti}
                title={postiEsauriti ? 'Non ci sono posti liberi nel tuo piano' : undefined}
                className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
              >
                {invitando ? 'Creazione invito...' : 'Genera link di invito'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
