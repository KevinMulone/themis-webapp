'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TIPI_PRATICA, labelFromOptions } from '@/lib/constants';

type Template = { id: string; nome: string; categoria: string | null; descrizione: string | null; studio_id: string | null };
type Settings = { font_family: string; font_size_pt: number; line_spacing: number };

const FONT_CHOICES = ['Times New Roman', 'Garamond', 'Georgia', 'Cambria', 'Calibri', 'Arial', 'Verdana'];
const LINE_SPACING_CHOICES = [1.0, 1.15, 1.5, 2.0];

export default function ImpostazioniPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<Settings>({ font_family: 'Times New Roman', font_size_pt: 12, line_spacing: 1.5 });
  const [letterhead, setLetterhead] = useState<{ exists: boolean; data_url?: string }>({ exists: false });
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const templateFileRef = useRef<HTMLInputElement>(null);
  const letterheadFileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: tpl } = await supabase.from('templates').select('id, nome, categoria, descrizione, studio_id').eq('attivo', true).order('categoria');
    setTemplates(tpl || []);
    const { data: s } = await supabase.from('studio_settings').select('*').eq('studio_id', user.id).single();
    if (s) setSettings({ font_family: s.font_family, font_size_pt: s.font_size_pt, line_spacing: s.line_spacing });
    const res = await fetch('/api/settings/letterhead');
    setLetterhead(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleTemplateUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!templateFileRef.current?.files?.[0]) { alert('Scegli un file .docx'); return; }
    setUploadingTemplate(true);
    const res = await fetch('/api/templates/upload', { method: 'POST', body: form });
    const body = await res.json();
    setUploadingTemplate(false);
    if (!res.ok) { alert(body.error || 'Errore caricamento'); return; }
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function handleLetterheadUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/settings/letterhead', { method: 'POST', body: form });
    if (!res.ok) { const b = await res.json(); alert(b.error || 'Errore caricamento'); return; }
    load();
  }

  async function handleRemoveLetterhead() {
    if (!confirm("Rimuovere l'intestazione?")) return;
    await fetch('/api/settings/letterhead', { method: 'DELETE' });
    load();
  }

  async function handleSaveTypography(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const form = new FormData(e.currentTarget);
    const payload = {
      studio_id: user.id,
      font_family: form.get('font_family') as string,
      font_size_pt: Number(form.get('font_size_pt')),
      line_spacing: Number(form.get('line_spacing')),
    };
    await supabase.from('studio_settings').upsert(payload, { onConflict: 'studio_id' });
    alert('Impostazioni salvate');
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">Impostazioni</h1>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Intestazione documenti</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Immagine (logo e dati dello studio) usata automaticamente nell&apos;intestazione di ogni documento generato.
        </p>
        {letterhead.exists ? (
          <img src={letterhead.data_url} alt="Intestazione" className="mb-3 max-h-40 rounded border border-neutral-200" />
        ) : (
          <p className="mb-3 text-sm text-neutral-400">Nessuna intestazione caricata.</p>
        )}
        <div className="flex gap-2">
          <button onClick={() => letterheadFileRef.current?.click()} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
            Carica intestazione...
          </button>
          <input ref={letterheadFileRef} type="file" accept="image/*" className="hidden" onChange={handleLetterheadUpload} />
          {letterhead.exists && (
            <button onClick={handleRemoveLetterhead} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
              Rimuovi
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveTypography} className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Formattazione documenti</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Carattere</label>
            <select name="font_family" defaultValue={settings.font_family} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
              {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Dimensione (pt)</label>
            <input type="number" name="font_size_pt" min={6} max={32} step={0.5} defaultValue={settings.font_size_pt} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Interlinea</label>
            <select name="line_spacing" defaultValue={settings.line_spacing} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
              {LINE_SPACING_CHOICES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
          <button type="submit" className="rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900">
            Salva
          </button>
        </div>
      </form>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Modelli disponibili ({templates.length})</h2>
        <p className="mb-3 text-xs text-neutral-500">
          I modelli &quot;di sistema&quot; sono forniti da Themis e uguali per tutti gli studi. Puoi caricarne di tuoi:
          restano privati e cifrati, visibili solo a questo studio.
        </p>
        <ul className="mb-4 max-h-64 divide-y divide-neutral-100 overflow-y-auto text-sm">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <div>
                <div>{t.nome}</div>
                <div className="text-xs text-neutral-400">{labelFromOptions(TIPI_PRATICA, t.categoria || '')}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${t.studio_id ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                {t.studio_id ? 'Personalizzato' : 'Di sistema'}
              </span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleTemplateUpload} className="grid grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Nome modello</label>
            <input name="nome" required className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
            <select name="categoria" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
              {TIPI_PRATICA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">File .docx</label>
            <input ref={templateFileRef} type="file" name="file" accept=".docx" required className="w-full text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Descrizione</label>
            <input name="descrizione" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={uploadingTemplate} className="rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50">
              {uploadingTemplate ? 'Caricamento...' : 'Carica modello'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
