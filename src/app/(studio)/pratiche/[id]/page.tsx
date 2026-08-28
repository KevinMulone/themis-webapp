'use client';

import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  TIPI_PRATICA, STATI_PRATICA, TIPI_SINISTRO, STATI_NEGOZIAZIONE, METODI_PAGAMENTO,
  labelFromOptions, clientLabel,
} from '@/lib/constants';
import { GRUPPI_SCADENZE, calcolaScadenza, toIsoLocale, type RegolaScadenza } from '@/lib/scadenzeLegali';

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
type RichiestaDocumento = {
  id: string; titolo: string; note: string | null; stato: string; documento_id: string | null;
};
type Patrocinio = {
  id: string; matter_id: string;
  data_istanza: string | null; stato_istanza: string | null; data_delibera: string | null;
  numero_rg_procedimento: string | null; data_decreto_liquidazione: string | null;
  importo_liquidato_cent: number | null; data_comunicazione_decreto: string | null;
  opposizione_proposta: boolean; data_opposizione: string | null;
  fattura_emessa: boolean; data_fattura: string | null; numero_fattura: string | null;
  pagamento_incassato: boolean; data_incasso: string | null; note: string | null;
};

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
  const [richieste, setRichieste] = useState<RichiestaDocumento[]>([]);
  const [creandoRichiesta, setCreandoRichiesta] = useState(false);
  const [regolaId, setRegolaId] = useState('');
  const [dataRiferimento, setDataRiferimento] = useState('');
  const [scadenzaMsg, setScadenzaMsg] = useState('');
  const [patrocinio, setPatrocinio] = useState<Patrocinio | null>(null);
  const [savedPatrocinio, setSavedPatrocinio] = useState(false);
  const [patrocinioError, setPatrocinioError] = useState('');

  async function loadDocumenti() {
    const { data } = await supabase.from('documenti').select('id, nome_file, data_generazione').eq('matter_id', id).order('data_generazione', { ascending: false });
    setDocumenti(data || []);
  }

  async function loadRichieste() {
    const { data } = await supabase.from('document_requests')
      .select('id, titolo, note, stato, documento_id').eq('matter_id', id).order('created_at', { ascending: false });
    setRichieste(data || []);
  }

  async function handleCreaRichiesta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!matter) return;
    const form = new FormData(e.currentTarget);
    const titolo = (form.get('titolo') as string || '').trim();
    if (!titolo) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCreandoRichiesta(true);
    await supabase.from('document_requests').insert({
      studio_id: user.id, matter_id: id, client_id: matter.client_id,
      titolo, note: (form.get('note') as string) || null,
    });
    setCreandoRichiesta(false);
    (e.target as HTMLFormElement).reset();
    loadRichieste();
  }

  async function handleEliminaRichiesta(richiestaId: string) {
    if (!confirm('Annullare questa richiesta?')) return;
    await supabase.from('document_requests').delete().eq('id', richiestaId);
    loadRichieste();
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
    loadRichieste();
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
    if (m.metodo_pagamento === 'gratuito_patrocinio') {
      const { data: p } = await supabase.from('patrocini_spese_stato').select('*').eq('matter_id', id).single();
      setPatrocinio(p);
    } else {
      setPatrocinio(null);
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

  function trovaRegola(id: string): RegolaScadenza | null {
    for (const gruppo of GRUPPI_SCADENZE) {
      const trovata = gruppo.regole.find((r) => r.id === id);
      if (trovata) return trovata;
    }
    return null;
  }

  const regolaSelezionata = trovaRegola(regolaId);
  const dataCalcolata = regolaSelezionata && dataRiferimento
    ? calcolaScadenza(new Date(`${dataRiferimento}T00:00:00`), regolaSelezionata.giorni, regolaSelezionata.sospensioneFeriale)
    : null;

  async function handleAddScadenza() {
    if (!regolaSelezionata || !dataCalcolata) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const iso = toIsoLocale(dataCalcolata);
    const { error } = await supabase.from('eventi').insert({
      studio_id: user.id, matter_id: id, titolo: regolaSelezionata.label,
      tipo: 'termine_processuale', data: iso, all_day: false, ora_inizio: '09:00',
      note: `${regolaSelezionata.riferimento}. Data di riferimento: ${dataRiferimento}. Verificare sempre eccezioni al caso concreto.`,
    });
    if (error) { setScadenzaMsg(`Errore: ${error.message}`); return; }
    setScadenzaMsg(`Aggiunta al calendario in data ${dataCalcolata.toLocaleDateString('it-IT')}.`);
    setTimeout(() => setScadenzaMsg(''), 4000);
  }

  async function handleSavePatrocinio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const form = new FormData(formEl);
    const payload: Record<string, unknown> = { studio_id: user.id, matter_id: id };
    form.forEach((value, key) => {
      if (key === 'opposizione_proposta' || key === 'fattura_emessa' || key === 'pagamento_incassato') return;
      payload[key] = value === '' ? null : value;
    });
    payload.opposizione_proposta = form.get('opposizione_proposta') === 'on';
    payload.fattura_emessa = form.get('fattura_emessa') === 'on';
    payload.pagamento_incassato = form.get('pagamento_incassato') === 'on';
    if (payload.importo_liquidato_cent) {
      payload.importo_liquidato_cent = Math.round(Number(payload.importo_liquidato_cent) * 100);
    }
    const { error } = await supabase.from('patrocini_spese_stato').upsert(payload, { onConflict: 'matter_id' });
    if (error) { setPatrocinioError(error.message); return; }
    setPatrocinioError('');
    setSavedPatrocinio(true);
    setTimeout(() => setSavedPatrocinio(false), 2000);
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
          <h1 className="text-2xl font-display font-semibold text-neutral-900">{clientLabel(client)}</h1>
          <p className="text-sm text-neutral-500">{labelFromOptions(TIPI_PRATICA, matter.tipo_pratica)}</p>
        </div>
        {saved && <span className="text-sm text-green-700">Salvato</span>}
      </div>

      <form onSubmit={handleSaveMatter} className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Dati pratica</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Documenti richiesti al cliente</h2>
        {richieste.length === 0 ? (
          <p className="mb-3 text-sm text-neutral-500">Nessuna richiesta inviata.</p>
        ) : (
          <ul className="mb-3 divide-y divide-neutral-100 text-sm">
            {richieste.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="font-medium text-neutral-800">{r.titolo}</div>
                  {r.note && <div className="text-xs text-neutral-400">{r.note}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {r.stato === 'caricato' ? (
                    <a href={`/api/documenti/${r.documento_id}/download`} className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700 hover:underline">
                      Caricato — scarica
                    </a>
                  ) : (
                    <>
                      <span className="rounded-full bg-gold-100 px-2 py-1 text-xs text-gold-700">In attesa</span>
                      <button onClick={() => handleEliminaRichiesta(r.id)} className="text-xs text-red-600 hover:underline">Annulla</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleCreaRichiesta} className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
          <input name="titolo" required placeholder="Es. Copia carta d'identità" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <input name="note" placeholder="Nota per il cliente (opzionale)" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={creandoRichiesta} className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
              {creandoRichiesta ? 'Invio...' : 'Richiedi documento'}
            </button>
          </div>
        </form>
      </div>

      {matter.metodo_pagamento === 'gratuito_patrocinio' && (
        <form onSubmit={handleSavePatrocinio} className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Patrocinio a spese dello Stato</h2>
            {savedPatrocinio && <span className="text-sm text-green-700">Salvato</span>}
          </div>
          {patrocinioError && <p className="mb-3 text-sm text-red-600">{patrocinioError}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Data istanza di ammissione" name="data_istanza" type="date" defaultValue={patrocinio?.data_istanza} />
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Stato istanza</label>
              <select name="stato_istanza" defaultValue={patrocinio?.stato_istanza ?? ''} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                <option value="">Non specificato</option>
                <option value="depositata">Depositata</option>
                <option value="ammessa">Ammessa</option>
                <option value="respinta">Respinta</option>
              </select>
            </div>
            <Field label="Data delibera del Consiglio dell'Ordine" name="data_delibera" type="date" defaultValue={patrocinio?.data_delibera} />
            <Field label="Numero R.G. procedimento" name="numero_rg_procedimento" defaultValue={patrocinio?.numero_rg_procedimento} />
            <Field label="Data decreto di liquidazione" name="data_decreto_liquidazione" type="date" defaultValue={patrocinio?.data_decreto_liquidazione} />
            <Field
              label="Importo liquidato (€)" name="importo_liquidato_cent" type="number" step="any"
              defaultValue={patrocinio?.importo_liquidato_cent != null ? (patrocinio.importo_liquidato_cent / 100).toFixed(2) : undefined}
            />
            <Field label="Data comunicazione decreto" name="data_comunicazione_decreto" type="date" defaultValue={patrocinio?.data_comunicazione_decreto} />
            <div className="flex items-end gap-2 pb-2">
              <input type="checkbox" name="opposizione_proposta" defaultChecked={patrocinio?.opposizione_proposta} id="opposizione_proposta" />
              <label htmlFor="opposizione_proposta" className="text-xs text-neutral-500">Opposizione proposta</label>
            </div>
            <Field label="Data opposizione (se proposta)" name="data_opposizione" type="date" defaultValue={patrocinio?.data_opposizione} />
            <div className="flex items-end gap-2 pb-2">
              <input type="checkbox" name="fattura_emessa" defaultChecked={patrocinio?.fattura_emessa} id="fattura_emessa" />
              <label htmlFor="fattura_emessa" className="text-xs text-neutral-500">Fattura emessa</label>
            </div>
            <Field label="Numero fattura" name="numero_fattura" defaultValue={patrocinio?.numero_fattura} />
            <Field label="Data fattura" name="data_fattura" type="date" defaultValue={patrocinio?.data_fattura} />
            <div className="flex items-end gap-2 pb-2">
              <input type="checkbox" name="pagamento_incassato" defaultChecked={patrocinio?.pagamento_incassato} id="pagamento_incassato" />
              <label htmlFor="pagamento_incassato" className="text-xs text-neutral-500">Pagamento incassato</label>
            </div>
            <Field label="Data incasso" name="data_incasso" type="date" defaultValue={patrocinio?.data_incasso} />
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-neutral-500">Note</label>
              <textarea name="note" defaultValue={patrocinio?.note ?? ''} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
            <button type="submit" className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">
              Salva
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Scadenze legali suggerite</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Suggerimenti con riferimento normativo, da verificare sempre sul caso concreto: la sospensione
          feriale (1-31 agosto) è applicata dove pertinente, esclusa per lavoro e previdenza.
        </p>
        <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Tipo di termine</label>
            <select
              value={regolaId} onChange={(e) => setRegolaId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Seleziona...</option>
              {GRUPPI_SCADENZE.map((g) => (
                <optgroup key={g.categoria} label={g.categoria}>
                  {g.regole.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Data di riferimento</label>
            <input
              type="date" value={dataRiferimento} onChange={(e) => setDataRiferimento(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {regolaSelezionata && (
          <div className="mb-3 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
            <p className="mb-1 font-semibold text-neutral-700">{regolaSelezionata.riferimento}</p>
            <p>Termine: {regolaSelezionata.giorni} giorni{regolaSelezionata.sospensioneFeriale ? ', con sospensione feriale se applicabile' : ' (materia esclusa dalla sospensione feriale)'}</p>
            {dataCalcolata && (
              <p className="mt-2 text-sm font-bold text-bordeaux-800">
                Scadenza calcolata: {dataCalcolata.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        )}

        {scadenzaMsg && <p className="mb-3 text-sm text-green-700">{scadenzaMsg}</p>}

        <button
          onClick={handleAddScadenza}
          disabled={!dataCalcolata}
          className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
        >
          Aggiungi al calendario
        </button>
      </div>

      {matter.tipo_pratica === 'sinistro' && sinistro && (
        <>
          <form onSubmit={handleSaveSinistro} className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold text-neutral-900">Dati sinistro</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <Field label="IP %" name="ip_percentuale" type="number" step="any" defaultValue={sinistro.ip_percentuale?.toString()} />
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
              <form onSubmit={handleAddTestimone} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
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

function Field({ label, name, defaultValue, type = 'text', step }: {
  label: string; name: string; defaultValue?: string | null; type?: string; step?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <input type={type} name={name} step={step} defaultValue={defaultValue ?? ''} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
    </div>
  );
}
