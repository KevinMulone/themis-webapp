'use client';

import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  TIPI_PRATICA, STATI_PRATICA, TIPI_SINISTRO, STATI_NEGOZIAZIONE, METODI_PAGAMENTO,
  labelFromOptions, clientLabel,
} from '@/lib/constants';

type Matter = {
  id: string; client_id: string; tipo_pratica: string; stato: string;
  controparte_nome: string | null; compagnia_assicurativa: string | null;
  numero_riferimento: string | null; tribunale: string | null; sezione: string | null;
  rg_numero: string | null; rg_anno: string | null; giudice: string | null;
  data_apertura: string | null; data_chiusura: string | null;
  descrizione: string | null; metodo_pagamento: string | null;
};
type Sinistro = {
  id: string; matter_id: string; data_sinistro: string | null; luogo_sinistro: string | null;
  tipo_sinistro: string | null; numero_sinistro_compagnia: string | null;
  liquidatore_nome: string | null; liquidatore_contatti: string | null;
  ip_percentuale: number | null; itt_giorni: number | null;
  importo_richiesto_cent: number | null; importo_offerto_cent: number | null; importo_liquidato_cent: number | null;
  stato_negoziazione: string; data_invio_negoziazione: string | null; note: string | null;
  dinamica: string | null; testimoni_presenti: boolean | null;
};
type Testimone = {
  id: string; sinistro_id: string; nome: string | null; cognome: string | null;
  contatti: string | null; dichiarazione: string | null; note: string | null;
};
type Documento = { id: string; nome_file: string; data_generazione: string };

export default function MatterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const supabase = createClient();
  const router = useRouter();
  const [matter, setMatter] = useState<Matter | null>(null);
  const [client, setClient] = useState<{ id: string; tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null } | null>(null);
  const [sinistro, setSinistro] = useState<Sinistro | null>(null);
  const [testimoni, setTestimoni] = useState<Testimone[]>([]);
  const [addingTestimone, setAddingTestimone] = useState(false);
  const [saved, setSaved] = useState(false);
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  async function loadDocumenti() {
    const { data } = await supabase.from('documenti').select('id, nome_file, data_generazione').eq('matter_id', id).order('data_generazione', { ascending: false });
    setDocumenti(data || []);
  }

  async function handleUploadDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    const form = new FormData();
    form.append('file', file);
    form.append('matter_id', id);
    const res = await fetch('/api/documenti/upload', { method: 'POST', body: form });
    setUploadingDoc(false);
    if (!res.ok) { const b = await res.json(); alert(b.error || 'Errore caricamento'); return; }
    e.target.value = '';
    loadDocumenti();
  }

  async function load() {
    loadDocumenti();
    const { data: m } = await supabase.from('matters').select('*').eq('id', id).single();
    if (!m) return;
    setMatter(m);
    const { data: c } = await supabase.from('clients').select('*').eq('id', m.client_id).single();
    setClient(c);
    if (m.tipo_pratica === 'sinistro') {
      const { data: s } = await supabase.from('sinistri').select('*').eq('matter_id', id).single();
      setSinistro(s);
      if (s) {
        const { data: t } = await supabase.from('testimoni').select('*').eq('sinistro_id', s.id).order('created_at');
        setTestimoni(t || []);
      }
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSaveMatter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    form.forEach((value, key) => { payload[key] = value === '' ? null : value; });
    await supabase.from('matters').update(payload).eq('id', id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  async function handleSaveSinistro(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sinistro) return;
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    form.forEach((value, key) => { payload[key] = value === '' ? null : value; });
    if (payload.testimoni_presenti !== undefined) payload.testimoni_presenti = payload.testimoni_presenti === 'true';
    await supabase.from('sinistri').update(payload).eq('id', sinistro.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  async function handleAddTestimone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sinistro) return;
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { sinistro_id: sinistro.id, studio_id: matter && (await supabase.auth.getUser()).data.user?.id };
    form.forEach((value, key) => { payload[key] = value === '' ? null : value; });
    if (!payload.nome && !payload.cognome) { alert('Inserisci almeno un nome'); return; }
    await supabase.from('testimoni').insert(payload);
    setAddingTestimone(false);
    load();
  }

  async function handleDeleteTestimone(tid: string) {
    if (!confirm('Eliminare questo testimone?')) return;
    await supabase.from('testimoni').delete().eq('id', tid);
    load();
  }

  async function handleArchive() {
    if (!confirm('Archiviare questa pratica?')) return;
    await supabase.from('matters').update({ stato: 'archiviata' }).eq('id', id);
    router.push('/pratiche');
  }

  if (!matter) return <p className="text-sm text-neutral-500">Caricamento...</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{clientLabel(client)}</h1>
          <p className="text-sm text-neutral-500">{labelFromOptions(TIPI_PRATICA, matter.tipo_pratica)}</p>
        </div>
        {saved && <span className="text-sm text-green-700">Salvato</span>}
      </div>

      <form onSubmit={handleSaveMatter} className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Dati pratica</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Stato</label>
            <select name="stato" defaultValue={matter.stato} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
              {STATI_PRATICA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <Field label="Controparte" name="controparte_nome" defaultValue={matter.controparte_nome} />
          <Field label="Compagnia assicurativa" name="compagnia_assicurativa" defaultValue={matter.compagnia_assicurativa} />
          <Field label="Numero riferimento" name="numero_riferimento" defaultValue={matter.numero_riferimento} />
          <Field label="Tribunale" name="tribunale" defaultValue={matter.tribunale} />
          <Field label="Sezione" name="sezione" defaultValue={matter.sezione} />
          <Field label="RG numero" name="rg_numero" defaultValue={matter.rg_numero} />
          <Field label="RG anno" name="rg_anno" defaultValue={matter.rg_anno} />
          <Field label="Giudice" name="giudice" defaultValue={matter.giudice} />
          <Field label="Data apertura" name="data_apertura" type="date" defaultValue={matter.data_apertura} />
          <Field label="Data chiusura" name="data_chiusura" type="date" defaultValue={matter.data_chiusura} />
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Metodo pagamento</label>
            <select name="metodo_pagamento" defaultValue={matter.metodo_pagamento ?? ''} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
              <option value="">Non specificato</option>
              {METODI_PAGAMENTO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Descrizione</label>
            <textarea name="descrizione" defaultValue={matter.descrizione ?? ''} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-4 flex justify-between border-t border-neutral-200 pt-4">
          <button type="button" onClick={handleArchive} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
            Archivia pratica
          </button>
          <button type="submit" className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">
            Salva
          </button>
        </div>
      </form>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Documenti</h2>
          <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50">
            {uploadingDoc ? 'Caricamento...' : '+ Carica documento'}
            <input type="file" className="hidden" onChange={handleUploadDocumento} disabled={uploadingDoc} />
          </label>
        </div>
        {documenti.length === 0 ? (
          <p className="text-sm text-neutral-500">Nessun documento caricato per questa pratica.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {documenti.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <span>{d.nome_file}</span>
                <a href={`/api/documenti/${d.id}/download`} className="text-xs font-semibold text-bordeaux-700 hover:underline">
                  Scarica
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {matter.tipo_pratica === 'sinistro' && sinistro && (
        <>
          <form onSubmit={handleSaveSinistro} className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold text-neutral-900">Dati sinistro</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data sinistro" name="data_sinistro" type="date" defaultValue={sinistro.data_sinistro} />
              <Field label="Luogo sinistro" name="luogo_sinistro" defaultValue={sinistro.luogo_sinistro} />
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Tipo sinistro</label>
                <select name="tipo_sinistro" defaultValue={sinistro.tipo_sinistro ?? ''} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  <option value="">Non specificato</option>
                  {TIPI_SINISTRO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <Field label="Numero sinistro compagnia" name="numero_sinistro_compagnia" defaultValue={sinistro.numero_sinistro_compagnia} />
              <Field label="Liquidatore" name="liquidatore_nome" defaultValue={sinistro.liquidatore_nome} />
              <Field label="Contatti liquidatore" name="liquidatore_contatti" defaultValue={sinistro.liquidatore_contatti} />
              <Field label="IP %" name="ip_percentuale" type="number" defaultValue={sinistro.ip_percentuale?.toString()} />
              <Field label="ITT giorni" name="itt_giorni" type="number" defaultValue={sinistro.itt_giorni?.toString()} />
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Stato negoziazione</label>
                <select name="stato_negoziazione" defaultValue={sinistro.stato_negoziazione} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  {STATI_NEGOZIAZIONE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <Field label="Data invio negoziazione" name="data_invio_negoziazione" type="date" defaultValue={sinistro.data_invio_negoziazione} />
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-neutral-500">Dinamica</label>
                <textarea name="dinamica" defaultValue={sinistro.dinamica ?? ''} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-neutral-500">Note</label>
                <textarea name="note" defaultValue={sinistro.note ?? ''} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
              <button type="submit" className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">
                Salva
              </button>
            </div>
          </form>

          <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900">Testimoni</h2>
              <button onClick={() => setAddingTestimone(true)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50">
                + Aggiungi testimone
              </button>
            </div>
            {testimoni.length === 0 ? (
              <p className="text-sm text-neutral-500">Nessun testimone registrato.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {testimoni.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{t.cognome} {t.nome} {t.contatti && `— ${t.contatti}`}</span>
                    <button onClick={() => handleDeleteTestimone(t.id)} className="text-xs text-red-700 hover:underline">
                      Elimina
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {addingTestimone && (
              <form onSubmit={handleAddTestimone} className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
                <Field label="Nome" name="nome" />
                <Field label="Cognome" name="cognome" />
                <Field label="Contatti" name="contatti" />
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-neutral-500">Dichiarazione</label>
                  <textarea name="dichiarazione" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setAddingTestimone(false)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
                    Annulla
                  </button>
                  <button type="submit" className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">
                    Salva
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, name, defaultValue, type = 'text' }: {
  label: string; name: string; defaultValue?: string | null; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <input type={type} name={name} defaultValue={defaultValue ?? ''} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
    </div>
  );
}
