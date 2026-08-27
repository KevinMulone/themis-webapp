'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TIPI_PRATICA, labelFromOptions, clientLabel } from '@/lib/constants';

type Matter = { id: string; tipo_pratica: string; clients?: { nome: string | null; cognome: string | null; ragione_sociale: string | null; tipo_soggetto: string } };
type Template = { id: string; nome: string; categoria: string | null };
type Placeholder = { placeholder_key: string; etichetta: string; sorgente: string; tipo_campo: string; obbligatorio: boolean };

export default function GeneraPage() {
  const supabase = createClient();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [matterId, setMatterId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [outputFilename, setOutputFilename] = useState('documento.docx');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ documento_id: string; nome_file: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from('matters').select('id, tipo_pratica, clients(nome, cognome, ragione_sociale, tipo_soggetto)').neq('stato', 'archiviata');
      setMatters((m as unknown as Matter[]) || []);
      const { data: t } = await supabase.from('templates').select('id, nome, categoria').eq('attivo', true).order('categoria');
      setTemplates(t || []);
    })();
  }, []);

  useEffect(() => {
    if (!templateId) { setPlaceholders([]); return; }
    (async () => {
      const { data } = await supabase.from('template_placeholders').select('*').eq('template_id', templateId).order('ordine');
      const manualOnes = (data || []).filter((p) => p.sorgente === 'manuale');
      setPlaceholders(manualOnes);
      setManualValues({});
    })();
  }, [templateId]);

  async function handleGenerate() {
    setError('');
    setResult(null);
    if (!matterId || !templateId) { setError('Seleziona una pratica e un modello'); return; }
    setGenerating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: session?.access_token, matter_id: matterId, template_id: templateId,
        manual_values: manualValues, output_filename: outputFilename,
      }),
    });
    const body = await res.json();
    setGenerating(false);
    if (!res.ok || !body.ok) { setError(body.error || 'Generazione non riuscita'); return; }
    setResult({ documento_id: body.documento_id, nome_file: body.nome_file });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">Genera Atto</h1>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">Pratica</label>
          <select value={matterId} onChange={(e) => setMatterId(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Seleziona...</option>
            {matters.map((m) => <option key={m.id} value={m.id}>{clientLabel(m.clients)} - {labelFromOptions(TIPI_PRATICA, m.tipo_pratica)}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">Modello</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Seleziona...</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>

        {placeholders.length > 0 && (
          <div className="mb-4 space-y-3 border-t border-neutral-200 pt-4">
            <p className="text-xs font-semibold text-neutral-500">Campi da compilare</p>
            {placeholders.map((p) => (
              <div key={p.placeholder_key}>
                <label className="mb-1 block text-xs text-neutral-500">
                  {p.etichetta}{p.obbligatorio && ' *'}
                </label>
                <input
                  type={p.tipo_campo === 'data' ? 'date' : p.tipo_campo === 'numero' || p.tipo_campo === 'importo' ? 'number' : 'text'}
                  value={manualValues[p.placeholder_key] || ''}
                  onChange={(e) => setManualValues({ ...manualValues, [p.placeholder_key]: e.target.value })}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        <div className="mb-4 border-t border-neutral-200 pt-4">
          <label className="mb-1 block text-xs text-neutral-500">Nome file</label>
          <input value={outputFilename} onChange={(e) => setOutputFilename(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
        >
          {generating ? 'Generazione...' : 'Genera'}
        </button>

        {result && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm">
            Documento generato: {result.nome_file}.{' '}
            <a href={`/api/documenti/${result.documento_id}/download`} className="font-semibold text-amber-800 hover:underline">
              Scarica
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
