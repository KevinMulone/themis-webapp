'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { TIPI_PRATICA, labelFromOptions, clientLabel } from '@/lib/constants';
import { Icon, type NomeIcona } from '@/components/ui/Icon';
import ChiediAlFascicolo from '../pratiche/[id]/ChiediAlFascicolo';
import RedigiAtto from '../pratiche/[id]/RedigiAtto';

type Matter = {
  id: string;
  tipo_pratica: string;
  controparte_nome: string | null;
  clients?: { nome: string | null; cognome: string | null; ragione_sociale: string | null; tipo_soggetto: string };
};
type Documento = { id: string; nome_file: string };

/** Una delle tre cose che Themis sa fare, spiegata in due righe. */
function CapacitaCard({ icona, titolo, testo }: { icona: NomeIcona; titolo: string; testo: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 text-left">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
        <Icon nome={icona} className="h-5 w-5" />
      </span>
      <h3 className="text-sm font-semibold text-neutral-900">{titolo}</h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{testo}</p>
    </div>
  );
}

/**
 * La stessa Themis della pagina della pratica, raggiungibile dal menu.
 *
 * I due riquadri non sono riscritti: sono gli stessi componenti, montati
 * qui dopo aver scelto la pratica. Se un domani cambia il riquadro nel
 * fascicolo, cambia anche questo — che è il motivo per cui non l'ho
 * duplicato.
 */
export default function ThemisPage() {
  const supabase = createClient();
  const [pratiche, setPratiche] = useState<Matter[]>([]);
  const [matterId, setMatterId] = useState('');
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('matters')
        .select('id, tipo_pratica, controparte_nome, clients(nome, cognome, ragione_sociale, tipo_soggetto)')
        .neq('stato', 'archiviata')
        .order('data_apertura', { ascending: false });
      setPratiche((data as unknown as Matter[]) || []);
      setCaricando(false);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!matterId) { setDocumenti([]); return; }
    (async () => {
      const { data } = await supabase
        .from('documenti').select('id, nome_file').eq('matter_id', matterId)
        .order('data_generazione', { ascending: false });
      setDocumenti(data || []);
    })();
  }, [matterId, supabase]);

  async function ricaricaDocumenti() {
    if (!matterId) return;
    const { data } = await supabase
      .from('documenti').select('id, nome_file').eq('matter_id', matterId)
      .order('data_generazione', { ascending: false });
    setDocumenti(data || []);
  }

  const scelta = pratiche.find((p) => p.id === matterId);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-neutral-900">Themis</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600">
            <Icon nome="stelle" className="h-3.5 w-3.5" />
            Assistente IA
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          L&apos;assistente dello studio. Scegli una pratica: Themis legge quel fascicolo,
          risponde su ciò che vi trova e prepara la prima stesura degli atti.
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">1. Seleziona una pratica</h2>
        <div className="relative">
          <Icon nome="pratiche" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400" />
          <select
            value={matterId} onChange={(e) => setMatterId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-neutral-300 py-3 pl-11 pr-10 text-sm"
            disabled={caricando}
          >
            <option value="">
              {caricando ? 'Caricamento delle pratiche...' : 'Scegli una pratica...'}
            </option>
            {pratiche.map((p) => (
              <option key={p.id} value={p.id}>
                {clientLabel(p.clients)} — {labelFromOptions(TIPI_PRATICA, p.tipo_pratica)}
                {p.controparte_nome ? ` c. ${p.controparte_nome}` : ''}
              </option>
            ))}
          </select>
          <Icon nome="freccia" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-neutral-400" />
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Themis lavora su una pratica alla volta: non mette insieme fascicoli diversi.
        </p>

        {scelta && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>
              {documenti.length === 0
                ? 'Questa pratica non ha documenti allegati: Themis potrà basarsi solo sui dati della scheda.'
                : `${documenti.length} document${documenti.length === 1 ? 'o' : 'i'} nel fascicolo.`}
            </span>
            <Link href={`/pratiche/${scelta.id}`} className="font-medium text-bordeaux-700 hover:underline">
              Apri la pratica
            </Link>
          </p>
        )}
      </div>

      {!matterId ? (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-violet-200 bg-white p-8">
          <div className="text-center">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-50 text-violet-500">
              <Icon nome="stelle" className="h-7 w-7" />
            </span>
            <h2 className="text-lg font-semibold text-neutral-900">Scegli una pratica per iniziare</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
              Seleziona una pratica dal menu qui sopra. Themis leggerà i documenti e ti aiuterà
              a preparare atti e risposte.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <CapacitaCard
              icona="documento" titolo="Analisi del fascicolo"
              testo="Legge i documenti della pratica che scegli: PDF, Word e testo."
            />
            <CapacitaCard
              icona="matita" titolo="Risposte con citazione"
              testo="Risponde solo su ciò che trova negli atti, indicando documento e pagina."
            />
            <CapacitaCard
              icona="genera" titolo="Bozze di atti"
              testo="Prima stesura di diffide, ricorsi e memorie, seguendo lo stile dello studio."
            />
          </div>
        </div>
      ) : (
        <>
          <ChiediAlFascicolo key={`d-${matterId}`} matterId={matterId} documenti={documenti} />
          <RedigiAtto
            key={`a-${matterId}`} matterId={matterId} documenti={documenti}
            onSalvato={ricaricaDocumenti}
          />
        </>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-600">
            <Icon nome="lucchetto" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Sicurezza e riservatezza</h3>
            {/* Il testo dice due cose vere insieme, e la seconda è quella che
                conta per un avvocato: i documenti ESCONO dallo studio. Dire
                solo "i tuoi dati sono al sicuro" sarebbe rassicurante e
                incompleto, e su materiale coperto da segreto professionale
                l'incompletezza è il modo in cui si prendono decisioni
                sbagliate. */}
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              I documenti che selezioni vengono inviati a un fornitore esterno per
              l&apos;elaborazione, e <strong>non vengono usati per addestrare i suoi modelli</strong>.
              Resta un trattamento affidato a un responsabile esterno: va indicato
              nell&apos;informativa privacy dello studio, e i clienti devono saperlo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
