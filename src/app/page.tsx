'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

/** Un link mostrato in pagina viene sempre da dati inseriti da terzi
 *  (sponsor, studi in elenco): si accetta solo http/https, mai altri
 *  schemi (es. javascript:) che il click eseguirebbe nel browser. */
function urlSicuro(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function Reveal({ children, className = '', delay = 0 }: {
  children: ReactNode; className?: string; delay?: number;
}) {
  const rif = useRef<HTMLDivElement>(null);
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    const nodo = rif.current;
    if (!nodo) return;
    const osservatore = new IntersectionObserver(
      ([voce]) => {
        if (voce.isIntersecting) {
          setVisibile(true);
          osservatore.disconnect();
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -6% 0px' },
    );
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, []);

  return (
    <div
      ref={rif}
      className={`transition-[opacity,transform] duration-700 ease-out ${
        visibile ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const MODULI: { icona: NomeIcona; titolo: string; testo: string }[] = [
  { icona: 'pratiche', titolo: 'Gestione pratiche', testo: 'Fascicoli, R.G., stato, controparte e assegnazione in un elenco solo.' },
  { icona: 'clienti', titolo: 'Anagrafe clienti', testo: 'Persone e società, archivio, ricerca per nome, CF, pec e città.' },
  { icona: 'pec', titolo: 'PEC in studio', testo: 'Casella collegata, non lette in evidenza, ricevute e termini proposti.' },
  { icona: 'calendario', titolo: 'Calendario unico', testo: 'Udienze e scadenze visibili a titolare e collaboratori, anche su Google.' },
  { icona: 'themis', titolo: 'Assistente Themis', testo: 'Domande al fascicolo con citazione della pagina. Bozze da rileggere sempre.' },
  { icona: 'genera', titolo: 'Generazione atti', testo: 'Modelli dello studio compilati con i dati già in pratica.' },
  { icona: 'parcelle', titolo: 'Parcelle', testo: 'Parametri forensi sulla pratica, senza un foglio a parte.' },
  { icona: 'calcolo', titolo: 'Calcolo del danno', testo: 'Tabelle in uso per invalidità permanente e temporanea.' },
  { icona: 'patrocinio', titolo: 'Patrocinio a spese dello Stato', testo: 'Istanza, delibera, liquidazione e incasso sullo stesso fascicolo.' },
  { icona: 'collaboratori', titolo: 'Collaboratori', testo: 'Inviti, ruoli e un unico spazio di lavoro per lo studio.' },
];

const BLOCCHI = [
  {
    kicker: 'Chi siamo',
    titolo: 'Themis è lo studio, messo in un’unica app.',
    testo: 'Nasce dallo studio legale quotidiano: fascicoli che si perdono tra cartelle, PEC, chat e fogli. L’obiettivo non è un chatbot. È un posto solo dove lo studio lavora — e che resta aggiornato, mese dopo mese.',
  },
  {
    kicker: 'Cosa facciamo',
    titolo: 'Tutto il lavoro del fascicolo, senza cinque programmi.',
    testo: 'Clienti, pratiche, PEC, calendario, atti, parcelle e patrocinio stanno nello stesso spazio. Ogni documento è cifrato per il tuo studio. L’assistente legge solo ciò che gli dai tu.',
  },
  {
    kicker: 'L’obiettivo',
    titolo: 'Un gestionale legale completo, sempre in aggiornamento.',
    testo: 'Themis non è un prodotto chiuso. Esce, si usa, si corregge. Nuove funzioni, più velocità, più chiarezza: la stessa app, migliorata in continuazione. Chi si abbona entra in un lavoro che continua.',
  },
];

const PIANI = [
  {
    key: 'monthly', nome: 'Mensile', pubblico: 'Per piccoli studi', prezzo: '100€', periodo: '/mese',
    dettaglio: 'Fatturazione mensile, disdici quando vuoi.', posti: 1,
    ia: 'Senza assistente Themis (IA).',
  },
  {
    key: 'semestrale', nome: 'Semestrale', pubblico: 'Per studi in crescita', prezzo: '500€', periodo: '/6 mesi',
    dettaglio: 'Un mese omaggio rispetto al mensile.', posti: 3,
    ia: 'Assistente Themis incluso, con un limite di utilizzo mensile.',
  },
  {
    key: 'annuale', nome: 'Annuale', pubblico: 'Per studi strutturati', prezzo: '1.100€', periodo: '/anno',
    dettaglio: 'Include le future funzionalità AI.', posti: 5,
    ia: 'Assistente Themis con il margine più ampio, più uno spazio sponsor gratuito in home.',
  },
] as const;

const FAQ: { d: string; r: string }[] = [
  { d: 'Themis sostituisce lo studio o l’avvocato?', r: 'No. È lo strumento dello studio. Le decisioni, la firma e la responsabilità restano dell’avvocato.' },
  { d: 'Cosa copre oggi?', r: 'Clienti, pratiche (compresi i sinistri), PEC, calendario, assistente sul fascicolo, generazione atti, parcelle, danno biologico, patrocinio, collaboratori e registri di giustizia civile.' },
  { d: 'L’app resterà ferma dopo l’acquisto?', r: 'No. Themis è pensata per aggiornarsi di continuo: correzioni, nuove funzioni, più chiarezza. L’abbonamento include gli aggiornamenti.' },
  { d: 'Themis inventa sentenze o norme?', r: 'No. Dove manca un dato scrive [DA COMPLETARE]. Le bozze vanno sempre rilette prima di usarle.' },
  { d: 'I documenti sono al sicuro?', r: 'Ogni studio ha una propria chiave di cifratura. La cifratura avviene prima dello storage e non si può disattivare.' },
  { d: 'Posso disdire?', r: 'Sì, sul piano mensile quando vuoi. C’è anche una garanzia di rimborso entro 4 giorni: leggi la politica rimborsi.' },
  { d: 'Serve già un account per iniziare?', r: 'Puoi registrarti e attivare con una chiave, oppure scegliere un piano da questa pagina. Dopo il pagamento la chiave arriva via email.' },
  { d: 'Funziona per uno studio con collaboratori?', r: 'Sì. Il titolare invita i collaboratori. I posti inclusi dipendono dal piano (1, 3 o 5 oltre al titolare).' },
  { d: 'L’assistente Themis (IA) è incluso in tutti i piani?', r: 'No. Il piano mensile non lo include. Il semestrale ha un limite di utilizzo mensile. L’annuale ha il margine più ampio e include anche uno spazio sponsor gratuito in home.' },
];

const VISTE_HERO = ['Panoramica', 'Fascicolo', 'Assistente'] as const;

function HeroProductDemo() {
  const [vista, setVista] = useState<(typeof VISTE_HERO)[number]>('Panoramica');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setVista((corrente) => VISTE_HERO[(VISTE_HERO.indexOf(corrente) + 1) % VISTE_HERO.length]);
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hero-product entra d4" aria-label="Anteprima interattiva di Themis">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="mx-auto flex rounded-full bg-white/[0.07] p-1 text-[11px] text-white/60 sm:text-xs">
          {VISTE_HERO.map((nome) => (
            <button key={nome} type="button" onClick={() => setVista(nome)} aria-pressed={vista === nome}
              className={`rounded-full px-3 py-1.5 transition ${vista === nome ? 'bg-white text-neutral-950 shadow-sm' : 'hover:text-white'}`}>
              {nome}
            </button>
          ))}
        </div>
        <span className="hidden text-[10px] font-semibold uppercase tracking-[.16em] text-white/35 sm:block">Live preview</span>
      </div>

      <div className="grid min-h-[350px] grid-cols-[62px_1fr] sm:min-h-[430px] sm:grid-cols-[170px_1fr]">
        <aside className="border-r border-white/10 bg-black/10 p-3 sm:p-5">
          <div className="mb-7 flex items-center gap-2">
            <Image src="/icon.svg" alt="" width={28} height={28} className="rounded-lg" />
            <span className="hidden text-sm font-black tracking-tight text-white sm:block">THEMIS</span>
          </div>
          <div className="space-y-1.5">
            {['Dashboard', 'Clienti', 'Pratiche', 'Themis', 'Calendario'].map((voce, i) => (
              <div key={voce} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs ${i === (vista === 'Panoramica' ? 0 : vista === 'Fascicolo' ? 2 : 3) ? 'bg-white/12 text-white' : 'text-white/40'}`}>
                <span className={`h-2 w-2 rounded-full ${i === 3 ? 'bg-gold-300' : 'bg-white/25'}`} />
                <span className="hidden sm:block">{voce}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="relative overflow-hidden bg-[#f7f7f9] p-4 text-left sm:p-7">
          <div key={vista} className="piano">
            {vista === 'Panoramica' && (
              <>
                <div className="flex items-end justify-between">
                  <div><p className="text-xs text-neutral-500">Buongiorno, Avvocato</p><h3 className="mt-1 text-xl font-bold text-neutral-900 sm:text-2xl">Il tuo studio, oggi.</h3></div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[10px] text-neutral-500 shadow-sm">12 settembre</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  {[['24', 'Pratiche attive'], ['3', 'Scadenze'], ['5', 'PEC non lette'], ['8', 'Incarichi']].map(([n, l], i) => (
                    <div key={l} className="rounded-2xl bg-white p-3 shadow-[0_12px_30px_-22px_rgba(0,0,0,.35)]">
                      <div className={`text-xl font-bold ${i === 2 ? 'text-bordeaux-700' : 'text-neutral-900'}`}>{n}</div>
                      <div className="mt-1 text-[10px] text-neutral-500">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_.75fr]">
                  <div className="rounded-2xl bg-white p-4"><p className="text-xs font-semibold text-neutral-900">Prossime attività</p>{['Udienza · Rossi / Comune', 'Deposito memoria 183', 'Richiamare cliente'].map((x, i) => <div key={x} className="mt-3 flex items-center gap-3 text-[11px] text-neutral-500"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-bordeaux-50 font-semibold text-bordeaux-700">{12 + i}</span>{x}</div>)}</div>
                  <div className="rounded-2xl bg-bordeaux-950 p-4 text-white"><p className="text-[10px] uppercase tracking-wider text-white/50">Themis suggerisce</p><p className="mt-3 text-sm font-semibold leading-snug">Due scadenze richiedono la tua attenzione.</p><span className="mt-5 inline-block text-[11px] text-gold-300">Controlla ora →</span></div>
                </div>
              </>
            )}
            {vista === 'Fascicolo' && (
              <>
                <p className="text-xs font-medium text-bordeaux-700">PRATICA CIVILE</p><h3 className="mt-1 text-xl font-bold text-neutral-900 sm:text-2xl">Rossi Mario / Comune</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">{[['R.G.', '1135/2025'], ['Stato', 'In corso'], ['Responsabile', 'Avv. Bianchi']].map(([l, v]) => <div key={l} className="rounded-2xl bg-white p-4"><p className="text-[10px] text-neutral-400">{l}</p><p className="mt-1 text-sm font-semibold text-neutral-800">{v}</p></div>)}</div>
                <div className="mt-3 rounded-2xl bg-white p-4"><p className="text-xs font-semibold text-neutral-900">Documenti recenti</p>{['Ricorso introduttivo.pdf', 'Verbale udienza.pdf', 'Memoria difensiva.docx'].map((x, i) => <div key={x} className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-[11px]"><span className="text-neutral-600">{x}</span><span className="text-neutral-400">{i + 1} set</span></div>)}</div>
              </>
            )}
            {vista === 'Assistente' && (
              <>
                <p className="text-xs text-neutral-500">Assistente sul fascicolo</p><h3 className="mt-1 text-xl font-bold text-neutral-900 sm:text-2xl">Una risposta, con la fonte.</h3>
                <div className="mt-6 ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-bordeaux-700 px-4 py-3 text-sm text-white">Qual è la prossima scadenza?</div>
                <div className="mt-3 max-w-[92%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm leading-relaxed text-neutral-600 shadow-sm">Il termine per la memoria è il <strong className="text-neutral-900">18 settembre 2026</strong>. La data risulta dal verbale dell’ultima udienza.</div>
                <div className="mt-2 text-[10px] text-neutral-400">Verbale udienza.pdf · pagina 2</div>
                <div className="mt-6 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-2 pl-4 text-xs text-neutral-400"><span className="flex-1">Chiedi qualcosa al fascicolo…</span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-bordeaux-700 text-white">↑</span></div>
              </>
            )}
          </div>
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-52 w-52 rounded-full bg-bordeaux-200/35 blur-3xl" />
        </div>
      </div>
    </div>
  );
}

function RigaFunzione({
  kicker, titolo, testo, invertito, alterna, children,
}: {
  kicker: string; titolo: string; testo: string; invertito?: boolean; alterna?: boolean; children: ReactNode;
}) {
  return (
    <section className={`px-6 py-20 lg:px-12 lg:py-32 ${alterna ? 'bg-[#f5f5f7]' : 'bg-white'}`}>
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal className={invertito ? 'lg:order-2' : ''}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bordeaux-700">{kicker}</p>
          <h2 className="mt-4 text-4xl font-bold leading-[1.04] tracking-[-.04em] text-neutral-900 sm:text-6xl">{titolo}</h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 sm:text-xl">{testo}</p>
        </Reveal>
        <Reveal delay={80} className={invertito ? 'lg:order-1' : ''}>
          {children}
        </Reveal>
      </div>
    </section>
  );
}

function Schermo({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <div className="product-window rialzo overflow-hidden rounded-[26px] bg-white">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-bordeaux-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
        <span className="ml-2 text-[11px] text-neutral-400">{titolo}</span>
      </div>
      {children}
    </div>
  );
}

function VetrinaPiani() {
  const [pianoInCorso, setPianoInCorso] = useState<string | null>(null);
  const [errore, setErrore] = useState('');

  async function scegliPiano(piano: string) {
    setErrore('');
    setPianoInCorso(piano);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: piano }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        setErrore(body.error || 'Impossibile avviare il pagamento. Riprova.');
        setPianoInCorso(null);
        return;
      }
      window.location.href = body.url;
    } catch {
      setErrore('Impossibile contattare il server. Riprova.');
      setPianoInCorso(null);
    }
  }

  return (
    <section id="piani" className="bg-[#f5f5f7] px-6 py-24 lg:px-12 lg:py-32">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-bordeaux-700">Piani trasparenti</p>
        <h2 className="mt-4 text-4xl font-bold tracking-[-.04em] text-neutral-900 sm:text-6xl">Un piano per ogni studio.</h2>
        <p className="mt-4 text-lg text-neutral-500">
          Più lungo è l&rsquo;impegno, più posti per i collaboratori sono inclusi, oltre al titolare.
        </p>
      </Reveal>
      <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-3">
        {PIANI.map((p) => {
          const featured = p.key === 'annuale';
          return (
            <div
              key={p.key}
              className={`rialzo relative flex flex-col overflow-hidden rounded-[28px] p-7 ${featured ? 'bg-gradient-to-br from-bordeaux-700 to-bordeaux-950 text-white shadow-[0_28px_70px_-36px_rgba(69,18,36,.72)]' : 'bg-white text-neutral-900 shadow-[0_20px_50px_-38px_rgba(0,0,0,.25)] ring-1 ring-black/[0.05]'}`}
            >
              {featured && <span className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">Più completo</span>}
              <div className={featured ? 'text-sm text-white/70' : 'text-sm text-neutral-500'}>{p.pubblico}</div>
              <div className="mt-3 text-lg font-semibold">{p.nome}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">{p.prezzo}</span>
                <span className={featured ? 'text-white/70' : 'text-neutral-500'}>{p.periodo}</span>
              </div>
              <p className={`mt-3 text-sm ${featured ? 'text-white/80' : 'text-neutral-600'}`}>{p.dettaglio}</p>
              <p className="mt-3 text-sm">
                {p.posti} {p.posti === 1 ? 'collaboratore' : 'collaboratori'} oltre al titolare
              </p>
              <p className={`mt-1 text-sm ${featured ? 'text-white/80' : 'text-neutral-600'}`}>{p.ia}</p>
              <button
                type="button"
                onClick={() => scegliPiano(p.key)}
                disabled={pianoInCorso !== null}
                className={`premi mt-8 rounded-full px-5 py-3 text-sm font-bold shadow-sm disabled:opacity-50 ${
                  featured ? 'bg-white text-bordeaux-800 hover:bg-neutral-100' : 'bg-bordeaux-700 text-white hover:bg-bordeaux-800'
                }`}
              >
                {pianoInCorso === p.key ? 'Attendere...' : `Scegli ${p.nome.toLowerCase()}`}
              </button>
            </div>
          );
        })}
      </div>
      {errore && <p className="mt-6 text-center text-sm text-red-600">{errore}</p>}
      <p className="mx-auto mt-8 max-w-md text-center text-sm text-neutral-500">
        Hai già una chiave?{' '}
        <a href="/attiva" className="font-medium text-neutral-900 underline">Attivala qui</a>
        {' · '}
        <a href="/politica-rimborsi" className="underline">Politica rimborsi</a>
      </p>
    </section>
  );
}

/** Il primo sponsor è vero (lo studio per cui è nato Themis); resta in
 *  vista almeno 20 secondi, molto più delle card d'invito che si
 *  alternano al suo posto finché non c'è un secondo sponsor pagante da
 *  mostrare. Non è un carosello con controlli: è una card sola il cui
 *  contenuto cambia da solo, ogni tanto — senza pallini da cliccare. */
type SlideCarosello =
  | { tipo: 'sponsor'; nome: string; logo: string; indirizzo: string; mapsQuery: string; durataMs: number }
  | { tipo: 'invito'; durataMs: number };

const SLIDE_FUSSONE: SlideCarosello = {
  tipo: 'sponsor',
  nome: 'Studio Legale Fussone',
  logo: '/sponsors/fussone-logo.png',
  indirizzo: 'Via Babaurra 34, 93017 San Cataldo (CL)',
  mapsQuery: 'Via Babaurra 34, 93017 San Cataldo CL',
  durataMs: 22000,
};

const SLIDE_CAROSELLO: SlideCarosello[] = [
  SLIDE_FUSSONE,
  { tipo: 'invito', durataMs: 8000 },
  { tipo: 'invito', durataMs: 8000 },
];

function SponsorCarosello() {
  const [indice, setIndice] = useState(0);
  const slide = SLIDE_CAROSELLO[indice];

  useEffect(() => {
    const id = setTimeout(() => setIndice((i) => (i + 1) % SLIDE_CAROSELLO.length), slide.durataMs);
    return () => clearTimeout(id);
  }, [indice, slide.durataMs]);

  return (
    <section id="sponsor" className="bg-white px-6 pt-20 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <div key={indice} className="piano overflow-hidden rounded-[28px] bg-neutral-50 shadow-[0_24px_60px_-42px_rgba(0,0,0,.3)] ring-1 ring-black/[0.04]">
          {slide.tipo === 'sponsor' ? (
            <div className="grid sm:grid-cols-2">
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center sm:p-10">
                <Image src={slide.logo} alt={slide.nome} width={220} height={208} className="h-auto w-40 sm:w-48" />
                <div>
                  <div className="font-semibold text-neutral-900">{slide.nome}</div>
                  <div className="mt-1 text-sm text-neutral-500">{slide.indirizzo}</div>
                </div>
              </div>
              <div className="h-64 sm:h-auto sm:min-h-[280px]">
                <iframe
                  src={`https://www.google.com/maps?q=${encodeURIComponent(slide.mapsQuery)}&output=embed`}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Mappa: ${slide.nome}`}
                />
              </div>
            </div>
          ) : (
            <a
              href="/sponsor"
              className="flex h-64 flex-col items-center justify-center gap-3 p-8 text-center transition-colors hover:bg-neutral-100 sm:h-72"
            >
              <span className="text-2xl font-bold text-neutral-900">Vuoi essere il prossimo sponsor?</span>
              <span className="font-medium text-bordeaux-700 underline">Clicca qui</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/** Loghi sponsor nel footer: Fussone (fisso, il primo) più chi ha un
 *  logo tra gli sponsor paganti dal database. Chi non ha un logo non
 *  compare qui — resta comunque nel carosello sopra, come testo. */
function LoghiSponsorFooter() {
  const [lista, setLista] = useState<{ nome: string; url: string | null; logo_url: string | null }[]>([]);
  useEffect(() => {
    fetch('/api/sponsor')
      .then((r) => r.json())
      .then((b) => setLista(b.sponsor || []))
      .catch(() => setLista([]));
  }, []);

  const loghi = [
    { nome: 'Studio Legale Fussone', href: '#sponsor', logo: '/sponsors/fussone-logo.png' },
    // Fussone è già la prima voce, fissa: se è anche a database (lo è, come
    // sponsor fondatore) non va ripetuta qui.
    ...lista
      .filter((s) => s.logo_url && s.nome !== 'Studio Legale Fussone')
      .map((s) => ({ nome: s.nome, href: urlSicuro(s.url) ?? '#sponsor', logo: s.logo_url as string })),
  ];

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Sponsor</div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {loghi.map((s) => (
          <a
            key={s.nome}
            href={s.href}
            target={s.href.startsWith('http') ? '_blank' : undefined}
            rel={s.href.startsWith('http') ? 'noreferrer' : undefined}
            title={s.nome}
            className="opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- loghi da fonti esterne, fuori dai domini remoti di next/image */}
            <img src={s.logo} alt={s.nome} className="h-9 w-auto" />
          </a>
        ))}
      </div>
    </div>
  );
}

function SezioneSponsor() {
  const [lista, setLista] = useState<{ nome: string; url: string | null; piano: string }[]>([]);
  useEffect(() => {
    fetch('/api/sponsor')
      .then((r) => r.json())
      .then((b) => setLista(b.sponsor || []))
      .catch(() => setLista([]));
  }, []);
  return (
    <section className="bg-white px-6 pb-24 pt-12 lg:px-12">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bordeaux-700">Sponsor</p>
        <h2 className="mt-3 text-3xl font-extrabold text-neutral-900 sm:text-4xl">Chi sostiene Themis.</h2>
        <p className="mx-auto mt-4 max-w-xl text-neutral-500">
          Spazio a pagamento, visibile solo dopo l&rsquo;accredito. 150 €/mese, 400 €/3 mesi, 1.200 €/anno.
        </p>
        {lista.length === 0 ? (
          <p className="mt-8 text-sm text-neutral-500">Nessuno sponsor in vetrina in questo momento.</p>
        ) : (
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {lista.slice(0, 6).map((s) => {
              const url = urlSicuro(s.url);
              return (
                <li key={s.nome} className="rialzo rounded-2xl bg-neutral-50 px-4 py-6 ring-1 ring-black/[0.04]">
                  {url ? (
                    <a href={url} className="font-semibold text-neutral-900 hover:underline" target="_blank" rel="noreferrer">{s.nome}</a>
                  ) : (
                    <span className="font-semibold text-neutral-900">{s.nome}</span>
                  )}
                  <div className="mt-1 text-xs uppercase tracking-wide text-neutral-400">{s.piano}</div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-8 text-sm">
          <a href="/sponsor" className="text-bordeaux-700 underline">Diventa sponsor</a>
          {' · '}
          <a href="/studi" className="text-bordeaux-700 underline">Elenco studi</a>
        </p>
      </div>
    </section>
  );
}

function Faq() {
  const [aperta, setAperta] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-[#f5f5f7] px-6 py-24 lg:px-12 lg:py-32">
      <h2 className="text-center text-4xl font-bold tracking-[-.04em] text-neutral-900 sm:text-6xl">Domande frequenti</h2>
      <div className="mx-auto mt-10 max-w-3xl space-y-2">
        {FAQ.map((v, i) => {
          const open = aperta === i;
          return (
            <div key={v.d} className="overflow-hidden rounded-2xl bg-white shadow-[0_14px_35px_-30px_rgba(0,0,0,.28)] ring-1 ring-black/[0.04]">
              <button
                type="button"
                onClick={() => setAperta(open ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-lg font-medium text-neutral-900 transition hover:bg-neutral-50 sm:text-xl"
              >
                {v.d}
                <span className="text-3xl font-light leading-none text-neutral-400">{open ? '×' : '+'}</span>
              </button>
              {open && (
                <p className="border-t border-neutral-200 px-6 py-5 text-base leading-relaxed text-neutral-600 sm:text-lg">
                  {v.r}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const [email, setEmail] = useState('');

  function inizia(e: React.FormEvent) {
    e.preventDefault();
    const q = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : '';
    window.location.href = `/registrati${q}`;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-white text-neutral-900">
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="vetro mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/70 px-4 py-3 shadow-[0_12px_36px_-24px_rgba(0,0,0,.35)] lg:px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/icon.svg" alt="" width={32} height={32} className="rounded-[6px]" />
            <span className="text-xl font-black tracking-[-.04em] text-bordeaux-700 sm:text-2xl">THEMIS</span>
          </Link>
          <div className="flex items-center gap-3">
            <a href="#funzioni" className="hidden text-sm text-neutral-600 hover:underline sm:inline">Funzioni</a>
            <a href="#piani" className="hidden text-sm text-neutral-600 hover:underline sm:inline">Piani</a>
            <a href="/studi" className="hidden text-sm text-neutral-600 hover:text-neutral-900 md:inline">Studi</a>
            <a href="/portale" className="text-sm text-neutral-600 hover:underline">
              <span className="sm:hidden">Assistiti</span>
              <span className="hidden sm:inline">Accedi come assistito</span>
            </a>
            <Link href="/accedi" className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-bordeaux-800">
              Accedi
            </Link>
          </div>
        </div>
      </header>

      <section className="landing-hero relative overflow-hidden px-5 pb-20 pt-36 sm:pt-44 lg:pb-32">
        <div className="ambient-orb ambient-orb-one" aria-hidden="true" />
        <div className="ambient-orb ambient-orb-two" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-6xl text-center">
          <div className="entra mx-auto inline-flex items-center gap-2 rounded-full border border-bordeaux-200/70 bg-white/70 px-4 py-2 text-xs font-semibold text-bordeaux-800 shadow-sm backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400 respiro" /> Il gestionale pensato per lo studio legale
          </div>
          <h1 className="entra d1 mx-auto mt-7 max-w-5xl text-5xl font-bold leading-[.98] tracking-[-.055em] text-neutral-950 sm:text-7xl lg:text-[92px]">
            Il tuo studio.<br /><span className="hero-gradient-text">Finalmente, tutto insieme.</span>
          </h1>
          <p className="entra d2 mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-neutral-600 sm:text-2xl">Pratiche, clienti, scadenze e documenti. Con un assistente che conosce il fascicolo e cita sempre le fonti.</p>
          <form onSubmit={inizia} className="entra d3 mx-auto mt-9 flex w-full max-w-xl flex-col gap-2 rounded-[22px] bg-white/75 p-2 shadow-[0_22px_60px_-28px_rgba(69,18,36,.3)] ring-1 ring-black/[0.06] backdrop-blur-xl sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Indirizzo email"
              aria-label="Indirizzo email"
              className="min-h-12 flex-1 rounded-2xl border-0 bg-transparent px-4 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0"
            />
            <button
              type="submit"
              className="shine-button premi inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-bordeaux-700 px-7 text-base font-semibold text-white hover:bg-bordeaux-800"
            >
              Inizia
              <span aria-hidden>›</span>
            </button>
          </form>
          <p className="entra d3 mt-4 text-xs text-neutral-500">Configurazione guidata · Aggiornamenti inclusi · Disdici quando vuoi</p>
          <div className="mt-14 sm:mt-20"><HeroProductDemo /></div>
        </div>
      </section>

      <section id="chi-siamo" className="bg-[#f5f5f7] px-6 py-24 lg:px-12 lg:py-32">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-3">
          {BLOCCHI.map((b, i) => (
            <Reveal key={b.kicker} delay={i * 80} className="h-full rounded-[28px] bg-white p-7 shadow-[0_20px_50px_-36px_rgba(0,0,0,.28)] ring-1 ring-black/[0.04] sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bordeaux-700">{b.kicker}</p>
              <h2 className="mt-3 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">{b.titolo}</h2>
              <p className="mt-4 leading-relaxed text-neutral-600">{b.testo}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <RigaFunzione
        kicker="Pratiche e clienti"
        titolo="Il fascicolo, non la cartella."
        testo="Apri una pratica, vedi il cliente, lo stato, la controparte, il R.G. I sinistri hanno i campi della compagnia. Niente fogli sparsi."
      >
        <Schermo titolo="Themis — Pratiche">
          <div className="divide-y divide-neutral-100 p-2">
            {['Rossi Mario · R.G. 1135/2018', 'Bianchi S.r.l. · sinistro', 'Verdi Anna · lavoro'].map((r, i) => (
              <div key={r} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className={i === 0 ? 'font-semibold text-neutral-900' : 'text-neutral-500'}>{r}</span>
                <span className="text-xs text-neutral-400">{i === 0 ? 'Aperta' : i === 1 ? 'In attesa' : 'Chiusa'}</span>
              </div>
            ))}
          </div>
        </Schermo>
      </RigaFunzione>

      <RigaFunzione
        invertito
        alterna
        kicker="PEC"
        titolo="La posta certificata resta nel fascicolo."
        testo="La PEC si scarica da sola. Le non lette restano evidenti. Niente caselle sparse tra più account."
      >
        <Schermo titolo="Themis — PEC">
          <div className="divide-y divide-neutral-100">
            {[
              ['Tribunale di Caltanissetta', 'Fissazione udienza'],
              ['Generali Italia', 'Riscontro sinistro'],
              ['Avv. Di Vita', 'Trasmissione ricorso'],
            ].map(([a, b], i) => (
              <div key={a} className="flex items-center gap-3 px-5 py-3">
                <span className={`h-1.5 w-1.5 rounded-full ${i < 2 ? 'bg-bordeaux-700' : 'bg-transparent'}`} />
                <div>
                  <div className={`text-sm ${i < 2 ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}>{a}</div>
                  <div className="text-xs text-neutral-400">{b}</div>
                </div>
              </div>
            ))}
          </div>
        </Schermo>
      </RigaFunzione>

      <RigaFunzione
        kicker="Assistente"
        titolo="Chiedi al fascicolo. Non a un motore di ricerca."
        testo="Themis legge i documenti che scegli tu e risponde citando pagina e riga. Prepara una prima bozza. Dove manca un dato lascia un segnaposto: a firmare sei tu."
      >
        <Schermo titolo="Themis — Assistente">
          <div className="space-y-3 p-5">
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-bordeaux-700 px-4 py-3 text-sm text-white">
              Da quando decorre l&rsquo;invalidità del verbale?
            </div>
            <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
              Decorrenza dalla domanda amministrativa. Invalidità riconosciuta all&rsquo;80%.
            </div>
            <div className="text-xs text-neutral-400">Verbale INPS.pdf · pagina 2</div>
          </div>
        </Schermo>
      </RigaFunzione>

      <RigaFunzione
        invertito
        alterna
        kicker="Calendario"
        titolo="Udienze e scadenze, sempre visibili."
        testo="Un calendario solo per lo studio, condiviso tra titolare e collaboratori, anche su Google."
      >
        <Schermo titolo="Themis — Calendario">
          <div className="grid grid-cols-7 gap-2 p-6 text-center text-sm">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
              <span key={i} className="text-neutral-400">{d}</span>
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${i === 2 ? 'bg-bordeaux-700 font-bold text-white' : 'text-neutral-700'}`}
              >
                {9 + i}
              </span>
            ))}
          </div>
        </Schermo>
      </RigaFunzione>

      <section id="funzioni" className="bg-[#f5f5f7] px-6 py-24 lg:px-12 lg:py-32">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold tracking-[-.04em] text-neutral-900 sm:text-6xl">Tutto quello che c&rsquo;è dentro.</h2>
          <p className="mt-4 text-lg text-neutral-500">
            Non un pezzo alla volta. Lo studio intero, modulo per modulo.
          </p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULI.map((m, i) => (
            <Reveal key={m.titolo} delay={(i % 3) * 50}>
              <div className="rialzo h-full rounded-[24px] bg-white p-6 shadow-[0_18px_40px_-34px_rgba(0,0,0,.3)] ring-1 ring-black/[0.05]">
                <Icon nome={m.icona} className="h-6 w-6 text-bordeaux-700" />
                <h3 className="mt-4 text-lg font-bold text-neutral-900">{m.titolo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{m.testo}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-white px-6 py-24 lg:px-12 lg:py-32">
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bordeaux-700">Sempre in aggiornamento</p>
          <h2 className="mt-4 text-4xl font-bold tracking-[-.04em] text-neutral-900 sm:text-6xl">
            L&rsquo;app non si ferma il giorno del rilascio.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Correzioni, nuove funzioni, più chiarezza nel lavoro di ogni giorno.
            Chi usa Themis entra in un prodotto che continua a essere scritto —
            non in una versione chiusa da scaffale.
          </p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-3">
          {[
            { n: '01', t: 'Si usa in studio', d: 'Pratiche vere, PEC vere, scadenze vere.' },
            { n: '02', t: 'Si ascolta', d: 'Quello che manca diventa il prossimo pezzo.' },
            { n: '03', t: 'Si pubblica di nuovo', d: 'Aggiornamenti nell’abbonamento, senza un altro acquisto.' },
          ].map((s) => (
            <div key={s.n} className="rialzo rounded-[24px] bg-neutral-50 p-6 ring-1 ring-black/[0.04]">
              <div className="text-sm font-bold text-bordeaux-700">{s.n}</div>
              <div className="mt-2 text-lg font-bold text-neutral-900">{s.t}</div>
              <p className="mt-2 text-sm text-neutral-500">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="sicurezza" className="relative overflow-hidden bg-bordeaux-950 px-6 py-24 text-white lg:px-12 lg:py-32">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Icon nome="lucchetto" className="mx-auto h-10 w-10 text-gold-300" />
          <h2 className="mt-6 text-4xl font-bold tracking-[-.04em] text-white sm:text-6xl">
            Ogni documento è cifrato per il tuo studio soltanto.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/65 sm:text-xl">
            Ogni studio ha una propria chiave. La cifratura avviene prima che il file
            tocchi lo storage. Non si può spegnere.
          </p>
        </Reveal>
      </section>

      <VetrinaPiani />
      <SponsorCarosello />
      <SezioneSponsor />
      <Faq />

      <section className="bg-white px-6 py-24 text-center lg:py-32">
        <h2 className="mx-auto max-w-3xl text-4xl font-bold tracking-[-.04em] text-neutral-900 sm:text-6xl">Pronto per lo studio, in un solo posto?</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/registrati" className="shine-button premi rounded-full bg-bordeaux-700 px-8 py-3 text-lg font-semibold text-white hover:bg-bordeaux-800">
            Crea l&rsquo;account
          </Link>
          <Link href="/accedi" className="premi rounded-full border border-neutral-200 bg-neutral-50 px-8 py-3 text-lg font-semibold text-neutral-900 hover:bg-neutral-100">
            Accedi
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-6 py-12 text-sm text-neutral-500">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-black tracking-tight text-bordeaux-700">THEMIS</div>
            <p className="mt-2 max-w-sm">
              Gestione legale per studi. Sempre in aggiornamento.
            </p>
            <div className="mt-5">
              <LoghiSponsorFooter />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#chi-siamo" className="hover:underline">Chi siamo</a>
            <a href="#funzioni" className="hover:underline">Funzioni</a>
            <a href="#piani" className="hover:underline">Piani</a>
            <a href="/studi" className="hover:underline">Studi</a>
            <a href="/sponsor" className="hover:underline">Sponsor</a>
            <a href="#faq" className="hover:underline">FAQ</a>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="/condizioni" className="hover:underline">Condizioni</a>
            <a href="/politica-rimborsi" className="hover:underline">Rimborsi</a>
            <a href="/portale" className="hover:underline">Accedi come assistito</a>
            <a href="/accedi" className="hover:underline">Accedi</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
