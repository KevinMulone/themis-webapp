'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { TIPI_PRATICA, labelFromOptions, clientLabel, formatDateIt } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';

type MatterInfo = {
  tipo_pratica: string; tribunale: string | null; sezione: string | null;
  rg_numero: string | null; rg_anno: string | null; giudice: string | null;
  controparte_nome: string | null; data_apertura: string | null;
};
type ClientePieno = {
  tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null;
  codice_fiscale: string | null; partita_iva: string | null;
  indirizzo: string | null; cap: string | null; citta: string | null; provincia: string | null;
  telefono: string | null; email: string | null; pec: string | null;
};
type DatiAvvocato = {
  avvocato_cognome: string | null; avvocato_nome: string | null; avvocato_codice_fiscale: string | null;
  avvocato_indirizzo: string | null; avvocato_cap: string | null; avvocato_citta: string | null;
  avvocato_provincia: string | null;
};
type Documento = { id: string; nome_file: string; data_generazione: string };

/** Un file .p7m è, per definizione, una busta di firma CAdES: il segno più
 * affidabile che quel documento è già stato firmato digitalmente. */
function eFirmato(nomeFile: string): boolean {
  return nomeFile.toLowerCase().endsWith('.p7m');
}

/** Una riga del prontuario: etichetta, valore, e un bottone per copiarlo da solo. */
function Riga({ etichetta, valore, assente, firmato }: { etichetta: string; valore: string; assente?: string; firmato?: boolean }) {
  const [copiato, setCopiato] = useState(false);
  const vuoto = !valore.trim();
  async function copia() {
    await navigator.clipboard.writeText(valore);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 1200);
  }
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[11px] text-neutral-500">{etichetta}</div>
        <div className={`flex items-center gap-2 truncate text-sm ${vuoto ? 'italic text-amber-600' : 'text-neutral-900'}`}>
          <span className="truncate">{vuoto ? (assente || 'da compilare') : valore}</span>
          {firmato && (
            <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Firmato</span>
          )}
        </div>
      </div>
      {!vuoto && (
        <button
          type="button" onClick={copia}
          className="premi shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
        >
          {copiato ? 'Copiato' : 'Copia'}
        </button>
      )}
    </div>
  );
}

function Sezione({ numero, titolo, children }: { numero: string; titolo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-neutral-200 pt-4 first:border-0 first:pt-0">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[11px] font-semibold text-bordeaux-700">SLpct {numero}</span>
        <h3 className="text-sm font-semibold text-neutral-900">{titolo}</h3>
      </div>
      <div className="divide-y divide-neutral-100">{children}</div>
    </div>
  );
}

/** La barra con "Copia tutto": lo stesso prontuario, in un unico blocco di testo. */
function ProntuarioTesto({ matter, cliente, indirizzoCliente, nomeAvvocato, avvocato, domicilioAvvocato, pec, nomeStudio, documenti }: {
  matter: MatterInfo; cliente: ClientePieno | null; indirizzoCliente: string;
  nomeAvvocato: string; avvocato: DatiAvvocato | null; domicilioAvvocato: string;
  pec: string | null; nomeStudio: string | null; documenti: Documento[];
}) {
  const [copiato, setCopiato] = useState(false);
  const testo = [
    '=== 5.1 Dati generali ===',
    `Ufficio giudiziario: ${[matter.tribunale, matter.sezione].filter(Boolean).join(' — ') || '—'}`,
    `Tipo pratica: ${labelFromOptions(TIPI_PRATICA, matter.tipo_pratica)}`,
    `R.G./anno: ${[matter.rg_numero, matter.rg_anno].filter(Boolean).join('/') || '—'}`,
    `Giudice: ${matter.giudice || '—'}`,
    '',
    '=== 5.3 Partecipanti ===',
    `Assistito: ${cliente ? clientLabel(cliente) : '—'}`,
    `Codice fiscale/P.IVA assistito: ${cliente?.codice_fiscale || cliente?.partita_iva || '—'}`,
    `Indirizzo assistito: ${indirizzoCliente || '—'}`,
    `PEC/email assistito: ${cliente?.pec || cliente?.email || '—'}`,
    `Controparte: ${matter.controparte_nome || '—'}`,
    '',
    '=== 5.4 Avvocato ===',
    `Nome: ${nomeAvvocato || '—'}`,
    `Codice fiscale: ${avvocato?.avvocato_codice_fiscale || '—'}`,
    `Domicilio: ${domicilioAvvocato || '—'}`,
    `PEC: ${pec || '—'}`,
    `Studio: ${nomeStudio || '—'}`,
    '',
    '=== 5.6 Allegati ===',
    ...(documenti.length ? documenti.map((d) => `- ${d.nome_file}`) : ['(nessun documento)']),
  ].join('\n');

  async function copiaTutto() {
    await navigator.clipboard.writeText(testo);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 1500);
  }

  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Prontuario per SLpct</span>
      <button
        type="button" onClick={copiaTutto}
        className="premi rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
      >
        {copiato ? 'Copiato tutto' : 'Copia tutto'}
      </button>
    </div>
  );
}

export default function PreparaDeposito({ matterId, clientId, matter, documenti, onDocumentiCambiati }: {
  matterId: string; clientId: string; matter: MatterInfo; documenti: Documento[];
  onDocumentiCambiati?: () => void;
}) {
  const supabase = createClient();
  const { studioId, nomeStudio } = useStudio();
  const [cliente, setCliente] = useState<ClientePieno | null>(null);
  const [avvocato, setAvvocato] = useState<DatiAvvocato | null>(null);
  const [pec, setPec] = useState<string | null>(null);
  const [attoId, setAttoId] = useState<string>('');
  const [allegatiIds, setAllegatiIds] = useState<string[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [errore, setErrore] = useState('');
  const [caricandoFirmati, setCaricandoFirmati] = useState(false);
  const [erroreFirmati, setErroreFirmati] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: s }, { data: p }] = await Promise.all([
        supabase
          .from('clients')
          .select('tipo_soggetto, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, indirizzo, cap, citta, provincia, telefono, email, pec')
          .eq('id', clientId).single(),
        supabase.from('studio_settings')
          .select('avvocato_cognome, avvocato_nome, avvocato_codice_fiscale, avvocato_indirizzo, avvocato_cap, avvocato_citta, avvocato_provincia')
          .eq('studio_id', studioId).maybeSingle(),
        supabase.from('pec_account').select('indirizzo_pec').eq('attivo', true).order('created_at').limit(1).maybeSingle(),
      ]);
      setCliente(c || null);
      setAvvocato(s || null);
      setPec(p?.indirizzo_pec || null);
    })();
  }, [clientId, studioId, supabase]);

  function alternaAllegato(id: string) {
    setAllegatiIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function scaricaPacchetto() {
    setErrore('');
    if (!attoId && allegatiIds.length === 0) { setErrore('Scegli almeno un documento.'); return; }
    setPreparando(true);
    try {
      const res = await fetch(`/api/pratiche/${matterId}/pacchetto-deposito`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attoId: attoId || null, allegatiIds }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ error: 'Errore nella preparazione' }));
        setErrore(b.error || 'Errore nella preparazione');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deposito_${matterId.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPreparando(false);
    }
  }

  /**
   * Ricarica in Themis i file già firmati fuori di qui (Dike, ArubaSign,
   * o la firma di SLpct stesso). Non firma nulla — la chiave resta sempre
   * nella chiavetta del difensore — si limita ad aggiungerli al fascicolo
   * come nuovi documenti, accanto agli originali non firmati e non al loro
   * posto: perdere l'originale per un caricamento fallito a metà sarebbe
   * peggio che tenerne uno di troppo.
   */
  async function handleCaricaFirmati(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files;
    if (!file || file.length === 0) return;
    setErroreFirmati('');
    setCaricandoFirmati(true);
    try {
      for (const f of Array.from(file)) {
        const form = new FormData();
        form.append('file', f);
        form.append('matter_id', matterId);
        const res = await fetch('/api/documenti/upload', { method: 'POST', body: form });
        if (!res.ok) {
          const b = await res.json().catch(() => ({ error: 'Errore caricamento' }));
          setErroreFirmati(`"${f.name}": ${b.error || 'errore di caricamento'}`);
          return;
        }
      }
      onDocumentiCambiati?.();
    } finally {
      setCaricandoFirmati(false);
      e.target.value = '';
    }
  }

  const indirizzoCliente = cliente
    ? [cliente.indirizzo, cliente.cap, cliente.citta, cliente.provincia].filter(Boolean).join(', ')
    : '';
  const domicilioAvvocato = avvocato
    ? [avvocato.avvocato_indirizzo, avvocato.avvocato_cap, avvocato.avvocato_citta, avvocato.avvocato_provincia].filter(Boolean).join(', ')
    : '';
  const nomeAvvocato = avvocato ? `${avvocato.avvocato_cognome || ''} ${avvocato.avvocato_nome || ''}`.trim() : '';

  const checklist: { ok: boolean; testo: string; azione?: { href: string; label: string } }[] = [
    { ok: !!matter.tribunale, testo: 'Ufficio giudiziario indicato nella pratica' },
    { ok: !!matter.controparte_nome, testo: 'Controparte indicata nella pratica' },
    { ok: documenti.length > 0, testo: "Almeno un documento caricato nella pratica" },
    {
      ok: !!(avvocato?.avvocato_codice_fiscale && domicilioAvvocato),
      testo: 'Dati del difensore compilati (codice fiscale e domicilio)',
      azione: { href: '/impostazioni', label: 'Vai alle Impostazioni' },
    },
    { ok: !!pec, testo: 'Una casella PEC configurata per la ricevuta di deposito', azione: { href: '/impostazioni', label: 'Vai alle Impostazioni' } },
  ];

  return (
    <div className="mb-4 rounded-xl bg-neutral-50 p-6">
      <div className="mb-1 flex items-center gap-2">
        <Icon nome="genera" className="h-[18px] w-[18px] text-bordeaux-600" />
        <h2 className="font-semibold text-neutral-900">Prepara per il deposito</h2>
      </div>
      <p className="mb-4 text-xs text-neutral-500">
        Un prontuario da copiare dentro SLpct, e un pacchetto con atto e allegati già ordinati. La firma e l&rsquo;invio
        restano sempre in SLpct: qui non si tocca la busta né la firma digitale.
      </p>

      <div className="mb-5 rounded-lg bg-white p-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Prima di depositare</div>
        <ul className="space-y-1.5">
          {checklist.map((v) => (
            <li key={v.testo} className="flex items-center justify-between gap-3 text-sm">
              <span className={`flex items-center gap-2 ${v.ok ? 'text-neutral-700' : 'text-amber-700'}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${v.ok ? 'bg-green-500' : 'bg-amber-500'}`} />
                {v.testo}
              </span>
              {!v.ok && v.azione && (
                <a href={v.azione.href} className="shrink-0 text-xs font-medium text-bordeaux-700 hover:underline">{v.azione.label}</a>
              )}
            </li>
          ))}
        </ul>
      </div>

      <ProntuarioTesto
        matter={matter} cliente={cliente} indirizzoCliente={indirizzoCliente}
        nomeAvvocato={nomeAvvocato} avvocato={avvocato} domicilioAvvocato={domicilioAvvocato}
        pec={pec} nomeStudio={nomeStudio} documenti={documenti}
      />

      <div className="space-y-4 rounded-lg bg-white p-4">
        <Sezione numero="5.1" titolo="Dati generali">
          <Riga etichetta="Ufficio giudiziario" valore={[matter.tribunale, matter.sezione].filter(Boolean).join(' — ')} />
          <Riga etichetta="Tipo di pratica in Themis (verifica il tipo atto in SLpct)" valore={labelFromOptions(TIPI_PRATICA, matter.tipo_pratica)} />
          <Riga etichetta="R.G. e anno (se già iscritta a ruolo)" valore={[matter.rg_numero, matter.rg_anno].filter(Boolean).join('/')} assente="non ancora iscritta, o da inserire" />
          <Riga etichetta="Giudice" valore={matter.giudice || ''} assente="non assegnato" />
          <Riga etichetta="Data apertura pratica" valore={matter.data_apertura ? formatDateIt(matter.data_apertura) : ''} />
        </Sezione>

        <Sezione numero="5.2" titolo="Contributo unificato">
          <p className="py-1.5 text-xs italic text-amber-600">
            Themis non registra questo dato: verifica importo e stato del versamento in base al valore della causa.
          </p>
        </Sezione>

        <Sezione numero="5.3" titolo="Partecipanti">
          <Riga etichetta="Assistito" valore={cliente ? clientLabel(cliente) : ''} />
          <Riga etichetta="Codice fiscale / P.IVA assistito" valore={cliente?.codice_fiscale || cliente?.partita_iva || ''} />
          <Riga etichetta="Indirizzo assistito" valore={indirizzoCliente} />
          <Riga etichetta="PEC / email assistito" valore={cliente?.pec || cliente?.email || ''} />
          <Riga etichetta="Controparte" valore={matter.controparte_nome || ''} />
          <p className="py-1.5 text-xs italic text-amber-600">
            Codice fiscale e indirizzo della controparte non sono tracciati in Themis: recuperali dal fascicolo.
          </p>
        </Sezione>

        <Sezione numero="5.4" titolo="Avvocato">
          <Riga etichetta="Cognome e nome" valore={nomeAvvocato} assente="compila i dati del difensore in Impostazioni" />
          <Riga etichetta="Codice fiscale" valore={avvocato?.avvocato_codice_fiscale || ''} />
          <Riga etichetta="Domicilio" valore={domicilioAvvocato} />
          <Riga etichetta="PEC" valore={pec || ''} assente="nessuna casella PEC attiva configurata" />
          <Riga etichetta="Studio" valore={nomeStudio || ''} />
        </Sezione>

        <Sezione numero="5.6" titolo="Allegati">
          {documenti.length === 0 ? (
            <p className="py-1.5 text-sm text-neutral-500">Nessun documento caricato in questa pratica.</p>
          ) : (
            documenti.map((d) => (
              <Riga key={d.id} etichetta={formatDateIt(d.data_generazione?.slice(0, 10))} valore={d.nome_file} firmato={eFirmato(d.nome_file)} />
            ))
          )}
        </Sezione>

        <Sezione numero="5.7" titolo="Attestazione di conformità">
          <p className="py-1.5 text-xs text-neutral-500">
            Se depositi copie scansionate di originali cartacei, ricorda l&rsquo;attestazione di conformità
            (art. 16-undecies D.L. 179/2012) prima di firmare la busta.
          </p>
        </Sezione>
      </div>

      <div className="mt-5 rounded-lg bg-white p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Pacchetto per il deposito (5.6 — Allegazione documenti)
        </div>
        {documenti.length === 0 ? (
          <p className="text-sm text-neutral-500">Carica prima almeno un documento nella pratica.</p>
        ) : (
          <>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {documenti.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50">
                  <label className="flex flex-1 items-center gap-2">
                    <input
                      type="radio" name="atto-principale" checked={attoId === d.id}
                      onChange={() => setAttoId(d.id)}
                    />
                    <span className="truncate">{d.nome_file}</span>
                    {eFirmato(d.nome_file) && (
                      <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Firmato</span>
                    )}
                  </label>
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-500">
                    <input
                      type="checkbox" checked={allegatiIds.includes(d.id)}
                      onChange={() => alternaAllegato(d.id)}
                      disabled={attoId === d.id}
                    />
                    allegato
                  </label>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-neutral-400">
              Seleziona con il pallino l&rsquo;atto principale, con le caselle gli allegati.
            </p>
            {errore && <p className="mt-2 text-xs text-red-600">{errore}</p>}
            <div className="mt-3 flex justify-end">
              <button
                type="button" onClick={scaricaPacchetto} disabled={preparando}
                className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
              >
                {preparando ? 'Preparazione...' : 'Scarica pacchetto (.zip)'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-5 rounded-lg bg-white p-4">
        <div className="mb-1 flex items-center gap-2">
          <Icon nome="lucchetto" className="h-4 w-4 text-neutral-400" />
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Ricarica i file firmati
          </div>
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          Dopo aver firmato atto e allegati con la tua chiavetta (in Dike, ArubaSign o SLpct), ricarica qui
          i file firmati (<code>.p7m</code>): restano nella pratica accanto agli originali, come prova.
          Themis non firma nulla — la chiave non lascia mai il tuo computer.
        </p>
        <label className="premi inline-flex cursor-pointer items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200">
          {caricandoFirmati ? 'Caricamento...' : '+ Carica file firmati'}
          <input type="file" multiple className="hidden" onChange={handleCaricaFirmati} disabled={caricandoFirmati} />
        </label>
        {erroreFirmati && <p className="mt-2 text-xs text-red-600">{erroreFirmati}</p>}
      </div>
    </div>
  );
}
