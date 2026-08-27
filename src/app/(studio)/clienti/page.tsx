'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TIPI_SOGGETTO, TIPI_PRATICA, labelFromOptions, clientLabel } from '@/lib/constants';

type Client = {
  id: string;
  tipo_soggetto: string;
  nome: string | null;
  cognome: string | null;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
  data_nascita: string | null;
  luogo_nascita: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  pec: string | null;
  note: string | null;
  archiviato: boolean;
};

const EMPTY: Partial<Client> = { tipo_soggetto: 'persona_fisica' };

export default function ClientiPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Client> | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteModal, setInviteModal] = useState<{
    client: Partial<Client>; email: string; link: string | null; error: string | null; copied: boolean;
  } | null>(null);
  const [clientDocs, setClientDocs] = useState<{ id: string; nome_file: string; data_generazione: string; tipo_pratica: string }[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('archiviato', false)
      .order('cognome', { ascending: true });
    setClients(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function loadClientDocs(clientId: string) {
    setLoadingDocs(true);
    const { data } = await supabase
      .from('documenti')
      .select('id, nome_file, data_generazione, matters!inner(client_id, tipo_pratica)')
      .eq('matters.client_id', clientId)
      .order('data_generazione', { ascending: false });
    type Row = { id: string; nome_file: string; data_generazione: string; matters: { tipo_pratica: string } | { tipo_pratica: string }[] };
    setClientDocs(
      ((data as Row[]) || []).map((d) => ({
        id: d.id,
        nome_file: d.nome_file,
        data_generazione: d.data_generazione,
        tipo_pratica: Array.isArray(d.matters) ? d.matters[0]?.tipo_pratica : d.matters.tipo_pratica,
      })),
    );
    setLoadingDocs(false);
  }

  function openEdit(c: Partial<Client>) {
    setEditing(c);
    setClientDocs([]);
    if (c.id) loadClientDocs(c.id);
  }

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const haystack = [c.nome, c.cognome, c.ragione_sociale, c.codice_fiscale, c.partita_iva, c.email, c.telefono]
      .join(' ').toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    form.forEach((value, key) => { payload[key] = value === '' ? null : value; });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editing?.id) {
      await supabase.from('clients').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('clients').insert({ ...payload, studio_id: user.id });
    }
    setEditing(null);
    load();
  }

  async function handleArchive(id: string) {
    if (!confirm('Archiviare questo cliente?')) return;
    await supabase.from('clients').update({ archiviato: true }).eq('id', id);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm(
      'Eliminare definitivamente questo cliente?\n\n' +
      'ATTENZIONE: verranno cancellate per sempre anche tutte le sue pratiche e i documenti ' +
      'generati collegati. Non è reversibile.\n\n' +
      'Se vuoi solo nasconderlo dall\'elenco mantenendo lo storico, usa "Archivia" invece.',
    )) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') {
        alert('Impossibile eliminare: questo cliente ha pratiche o documenti collegati. Elimina prima quelli, oppure usa "Archivia".');
      } else {
        alert(error.message);
      }
      return;
    }
    setEditing(null);
    load();
  }

  function handleInvitePortal(client: Partial<Client>) {
    if (!client.id) return;
    setInviteModal({ client, email: client.email || '', link: null, error: null, copied: false });
  }

  async function handleGenerateInviteLink() {
    if (!inviteModal || !inviteModal.client.id) return;
    const email = inviteModal.email.trim();
    if (!email) { setInviteModal({ ...inviteModal, error: 'Inserisci un indirizzo email.' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const code = crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase.from('portal_invites').insert({
      studio_id: user.id, code, client_id: inviteModal.client.id, nome_cliente: clientLabel(inviteModal.client), email,
    });
    if (error) { setInviteModal({ ...inviteModal, error: error.message }); return; }
    const link = `${window.location.origin}/portale?invite=${code}`;
    setInviteModal({ ...inviteModal, email, link, error: null, copied: false });
  }

  async function handleCopyInviteLink() {
    if (!inviteModal?.link) return;
    try {
      await navigator.clipboard.writeText(inviteModal.link);
      setInviteModal({ ...inviteModal, copied: true });
    } catch {
      setInviteModal({ ...inviteModal, error: 'Copia non riuscita: seleziona e copia il link manualmente.' });
    }
  }

  const isPF = (editing?.tipo_soggetto ?? 'persona_fisica') === 'persona_fisica';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Clienti</h1>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800"
        >
          + Nuovo cliente
        </button>
      </div>
      <input
        className="mb-4 w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm"
        placeholder="Cerca per nome, cognome, ragione sociale, CF..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-sm text-neutral-500">Caricamento...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          Nessun cliente trovato.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">CF / P.IVA</th>
                <th className="px-4 py-2">Telefono</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Città</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                  onClick={() => openEdit(c)}
                >
                  <td className="px-4 py-2">{clientLabel(c)}</td>
                  <td className="px-4 py-2">{c.codice_fiscale || c.partita_iva}</td>
                  <td className="px-4 py-2">{c.telefono}</td>
                  <td className="px-4 py-2">{c.email}</td>
                  <td className="px-4 py-2">{c.citta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">
              {editing.id ? 'Modifica cliente' : 'Nuovo cliente'}
            </h2>
            <form onSubmit={handleSave} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-neutral-500">Tipo soggetto</label>
                <select
                  name="tipo_soggetto"
                  defaultValue={editing.tipo_soggetto ?? 'persona_fisica'}
                  onChange={(e) => setEditing({ ...editing, tipo_soggetto: e.target.value })}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  {TIPI_SOGGETTO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {isPF ? (
                <>
                  <Field label="Nome" name="nome" defaultValue={editing.nome} />
                  <Field label="Cognome" name="cognome" defaultValue={editing.cognome} />
                  <Field label="Codice fiscale" name="codice_fiscale" defaultValue={editing.codice_fiscale} />
                  <Field label="Data di nascita" name="data_nascita" type="date" defaultValue={editing.data_nascita} />
                  <Field label="Luogo di nascita" name="luogo_nascita" defaultValue={editing.luogo_nascita} />
                </>
              ) : (
                <>
                  <Field label="Ragione sociale" name="ragione_sociale" defaultValue={editing.ragione_sociale} full />
                  <Field label="Partita IVA" name="partita_iva" defaultValue={editing.partita_iva} />
                </>
              )}
              <Field label="Indirizzo" name="indirizzo" defaultValue={editing.indirizzo} full />
              <Field label="CAP" name="cap" defaultValue={editing.cap} />
              <Field label="Città" name="citta" defaultValue={editing.citta} />
              <Field label="Provincia" name="provincia" defaultValue={editing.provincia} />
              <Field label="Telefono" name="telefono" defaultValue={editing.telefono} />
              <Field label="Email" name="email" defaultValue={editing.email} />
              <Field label="PEC" name="pec" defaultValue={editing.pec} />
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-neutral-500">Note</label>
                <textarea
                  name="note"
                  defaultValue={editing.note ?? ''}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              {editing.id && (
                <div className="col-span-2 border-t border-neutral-200 pt-4">
                  <p className="mb-2 text-xs font-semibold text-neutral-500">
                    Documenti generati per questo cliente
                  </p>
                  {loadingDocs ? (
                    <p className="text-sm text-neutral-400">Caricamento...</p>
                  ) : clientDocs.length === 0 ? (
                    <p className="text-sm text-neutral-400">Nessun documento generato finora.</p>
                  ) : (
                    <ul className="max-h-40 divide-y divide-neutral-100 overflow-y-auto text-sm">
                      {clientDocs.map((d) => (
                        <li key={d.id} className="flex items-center justify-between py-1.5">
                          <div>
                            <div>{d.nome_file}</div>
                            <div className="text-xs text-neutral-400">
                              {labelFromOptions(TIPI_PRATICA, d.tipo_pratica)} · {new Date(d.data_generazione).toLocaleDateString('it-IT')}
                            </div>
                          </div>
                          <a
                            href={`/api/documenti/${d.id}/download`}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                          >
                            Scarica
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="col-span-2 mt-2 flex justify-end gap-2 border-t border-neutral-200 pt-4">
                {editing.id && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleInvitePortal(editing)}
                      className="mr-auto rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
                    >
                      Invita al portale
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive(editing.id!)}
                      className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      Archivia
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(editing.id!)}
                      className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                    >
                      Elimina
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {inviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">
              Invita {clientLabel(inviteModal.client)} al portale
            </h2>

            {!inviteModal.link ? (
              <>
                <label className="mb-1 block text-xs text-neutral-500">Email del cliente</label>
                <input
                  type="email"
                  autoFocus
                  value={inviteModal.email}
                  onChange={(e) => setInviteModal({ ...inviteModal, email: e.target.value, error: null })}
                  className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="cliente@esempio.it"
                />
                {inviteModal.error && <p className="mb-3 text-sm text-red-600">{inviteModal.error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteModal(null)}
                    className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateInviteLink}
                    className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800"
                  >
                    Genera link
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-2 text-sm text-neutral-600">Copia questo link e mandalo al cliente:</p>
                <input
                  readOnly
                  value={inviteModal.link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mb-3 w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm"
                />
                {inviteModal.error && <p className="mb-3 text-sm text-red-600">{inviteModal.error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteModal(null)}
                    className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
                  >
                    Chiudi
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800"
                  >
                    {inviteModal.copied ? 'Copiato!' : 'Copia link'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, name, defaultValue, type = 'text', full = false }: {
  label: string; name: string; defaultValue?: string | null; type?: string; full?: boolean;
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
