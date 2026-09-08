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

/** Toni pastello sul palette dello studio (bordeaux/oro/neutri): stessa
 *  idea del mosaico, ma leggibile su fondo chiaro invece che su nero. */
const POSTER: { titolo: string; sotto: string; tono: string }[] = [
  { titolo: 'Pratiche', sotto: 'Fascicoli e stati', tono: 'from-bordeaux-100 to-bordeaux-50' },
  { titolo: 'Clienti', sotto: 'Anagrafe dello studio', tono: 'from-neutral-200 to-neutral-100' },
  { titolo: 'PEC', sotto: 'Posta certificata', tono: 'from-gold-100 to-gold-50' },
  { titolo: 'Themis AI', sotto: 'Domande al fascicolo', tono: 'from-bordeaux-200 to-bordeaux-100' },
  { titolo: 'Calendario', sotto: 'Udienze e termini', tono: 'from-neutral-100 to-white' },
  { titolo: 'WhatsApp', sotto: 'Chat dello studio', tono: 'from-gold-100 to-neutral-50' },
  { titolo: 'Atti', sotto: 'Prime stesure', tono: 'from-gold-200 to-gold-100' },
  { titolo: 'Deposito', sotto: 'Pacchetto telematico', tono: 'from-neutral-200 to-white' },
  { titolo: 'Parcelle', sotto: 'Parametri forensi', tono: 'from-bordeaux-100 to-neutral-50' },
  { titolo: 'Patrocinio', sotto: 'Spese dello Stato', tono: 'from-bordeaux-200 to-neutral-100' },
  { titolo: 'Sinistri', sotto: 'Dati compagnia', tono: 'from-gold-100 to-bordeaux-50' },
  { titolo: 'Collaboratori', sotto: 'Un solo studio', tono: 'from-neutral-100 to-neutral-50' },
  { titolo: 'Cifratura', sotto: 'Chiave per studio', tono: 'from-gold-200 to-neutral-50' },
  { titolo: 'Registri', sotto: 'Giustizia civile', tono: 'from-neutral-200 to-bordeaux-50' },
  { titolo: 'Danno', sotto: 'Tabelle ufficiali', tono: 'from-bordeaux-100 to-white' },
  { titolo: 'Incarichi', sotto: 'Cosa resta da fare', tono: 'from-gold-100 to-white' },
];

const MODULI: { icona: NomeIcona; titolo: string; testo: string }[] = [
  { icona: 'pratiche', titolo: 'Gestione pratiche', testo: 'Fascicoli, R.G., stato, controparte e assegnazione in un elenco solo.' },
  { icona: 'clienti', titolo: 'Anagrafe clienti', testo: 'Persone e società, archivio, ricerca per nome, CF, pec e città.' },
  { icona: 'pec', titolo: 'PEC in studio', testo: 'Casella collegata, non lette in evidenza, ricevute e termini proposti.' },
  { icona: 'whatsapp', titolo: 'WhatsApp dello studio', testo: 'Chat, documenti in arrivo e collegamento al fascicolo giusto.' },
  { icona: 'calendario', titolo: 'Calendario unico', testo: 'Udienze e scadenze visibili a titolare e collaboratori, anche su Google.' },
  { icona: 'themis', titolo: 'Assistente Themis', testo: 'Domande al fascicolo con citazione della pagina. Bozze da rileggere sempre.' },
  { icona: 'genera', titolo: 'Generazione atti', testo: 'Modelli dello studio compilati con i dati già in pratica.' },
  { icona: 'invio', titolo: 'Deposito telematico', testo: 'Pacchetto pronto, lista di controllo, ricarica dei file firmati.' },
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
    testo: 'Clienti, pratiche, PEC, WhatsApp, calendario, atti, deposito, parcelle e patrocinio stanno nello stesso spazio. Ogni documento è cifrato per il tuo studio. L’assistente legge solo ciò che gli dai tu.',
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
  { d: 'Cosa copre oggi?', r: 'Clienti, pratiche (compresi i sinistri), PEC, WhatsApp, calendario, assistente sul fascicolo, generazione atti, deposito, parcelle, danno biologico, patrocinio, collaboratori e registri di giustizia civile.' },
  { d: 'L’app resterà ferma dopo l’acquisto?', r: 'No. Themis è pensata per aggiornarsi di continuo: correzioni, nuove funzioni, più chiarezza. L’abbonamento include gli aggiornamenti.' },
  { d: 'Themis inventa sentenze o norme?', r: 'No. Dove manca un dato scrive [DA COMPLETARE]. Le bozze vanno sempre rilette prima di usarle.' },
  { d: 'I documenti sono al sicuro?', r: 'Ogni studio ha una propria chiave di cifratura. La cifratura avviene prima dello storage e non si può disattivare.' },
  { d: 'Posso disdire?', r: 'Sì, sul piano mensile quando vuoi. C’è anche una garanzia di rimborso entro 4 giorni: leggi la politica rimborsi.' },
  { d: 'Serve già un account per iniziare?', r: 'Puoi registrarti e attivare con una chiave, oppure scegliere un piano da questa pagina. Dopo il pagamento la chiave arriva via email.' },
  { d: 'Funziona per uno studio con collaboratori?', r: 'Sì. Il titolare invita i collaboratori. I posti inclusi dipendono dal piano (1, 3 o 5 oltre al titolare).' },
  { d: 'L’assistente Themis (IA) è incluso in tutti i piani?', r: 'No. Il piano mensile non lo include. Il semestrale ha un limite di utilizzo mensile. L’annuale ha il margine più ampio e include anche uno spazio sponsor gratuito in home.' },
];

function Mosaico() {
  const fila = [...POSTER, ...POSTER];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -inset-8 rotate-[-8deg] scale-110 opacity-70">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {fila.map((p, i) => (
            <div
              key={`${p.titolo}-${i}`}
              className={`aspect-[2/3] rounded-sm bg-gradient-to-br ${p.tono} p-3 shadow-sm ring-1 ring-black/[0.04]`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{p.sotto}</div>
              <div className="mt-2 text-[17px] font-bold leading-tight text-neutral-800">{p.titolo}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/60 to-[#f5f5f7]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#f5f5f7] to-transparent" />
    </div>
  );
}

function RigaFunzione({
  kicker, titolo, testo, invertito, alterna, children,
}: {
  kicker: string; titolo: string; testo: string; invertito?: boolean; alterna?: boolean; children: ReactNode;
}) {
  return (
    <section className={`border-t border-neutral-200 px-6 py-16 lg:px-12 lg:py-24 ${alterna ? 'bg-neutral-50' : 'bg-white'}`}>
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <Reveal className={invertito ? 'lg:order-2' : ''}>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bordeaux-700">{kicker}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">{titolo}</h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">{testo}</p>
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
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_30px_80px_-40px_rgba(0,0,0,.3)] ring-1 ring-black/[0.06]">
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
    <section id="piani" className="border-t border-neutral-200 bg-neutral-50 px-6 py-20 lg:px-12">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-extrabold text-neutral-900 sm:text-5xl">Un piano per ogni studio.</h2>
        <p className="mt-4 text-lg text-neutral-500">
          Più lungo è l&rsquo;impegno, più posti per i collaboratori sono inclusi, oltre al titolare.
        </p>
      </Reveal>
      <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
        {PIANI.map((p) => {
          const featured = p.key === 'annuale';
          return (
            <div
              key={p.key}
              className={`flex flex-col rounded-xl p-7 ${featured ? 'bg-bordeaux-700 text-white' : 'bg-white text-neutral-900 ring-1 ring-black/[0.06]'}`}
            >
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
                className={`mt-8 rounded px-5 py-3 text-sm font-bold disabled:opacity-50 ${
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
    <section id="sponsor" className="border-t border-neutral-200 bg-white px-6 pt-16 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <div key={indice} className="piano overflow-hidden rounded-2xl bg-neutral-50 ring-1 ring-black/[0.04]">
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
    ...lista
      .filter((s) => s.logo_url)
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
    <section className="bg-white px-6 pb-16 pt-10 lg:px-12">
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
                <li key={s.nome} className="rounded-md bg-neutral-50 px-4 py-6 ring-1 ring-black/[0.04]">
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
        <a href="/sponsor" className="mt-8 inline-block text-sm text-bordeaux-700 underline">Diventa sponsor</a>
      </div>
    </section>
  );
}

function Faq() {
  const [aperta, setAperta] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-neutral-200 bg-white px-6 py-20 lg:px-12">
      <h2 className="text-center text-3xl font-extrabold text-neutral-900 sm:text-5xl">Domande frequenti</h2>
      <div className="mx-auto mt-10 max-w-3xl space-y-2">
        {FAQ.map((v, i) => {
          const open = aperta === i;
          return (
            <div key={v.d} className="rounded-lg bg-neutral-50 ring-1 ring-black/[0.04]">
              <button
                type="button"
                onClick={() => setAperta(open ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-lg text-neutral-900 sm:text-2xl"
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
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/icon.svg" alt="" width={32} height={32} className="rounded-[6px]" />
            <span className="text-2xl font-black tracking-tight text-bordeaux-700 sm:text-3xl">THEMIS</span>
          </Link>
          <div className="flex items-center gap-3">
            <a href="#funzioni" className="hidden text-sm text-neutral-600 hover:underline sm:inline">Funzioni</a>
            <a href="#piani" className="hidden text-sm text-neutral-600 hover:underline sm:inline">Piani</a>
            <a href="/studi" className="text-sm text-neutral-600 hover:underline">Studi</a>
            <a href="/portale" className="hidden text-sm text-neutral-600 hover:underline sm:inline">Accedi come assistito</a>
            <Link
              href="/accedi"
              className="rounded bg-bordeaux-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-bordeaux-800"
            >
              Accedi
            </Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-[92vh] overflow-hidden">
        <Mosaico />
        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-4xl flex-col items-center justify-center px-6 pb-20 pt-28 text-center">
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-neutral-900 sm:text-6xl lg:text-7xl">
            Lo studio legale,
            <br />
            in un solo posto.
          </h1>
          <p className="mt-5 text-xl font-medium text-neutral-800 sm:text-2xl">
            Pratiche, PEC, calendario e un assistente sul fascicolo.
          </p>
          <p className="mt-3 max-w-xl text-base text-neutral-600 sm:text-lg">
            Un&rsquo;app di gestione legale completa. Sempre in aggiornamento.
            Inizia oggi — disdici quando vuoi.
          </p>
          <p className="mt-8 text-base text-neutral-800 sm:text-lg">
            Pronto a entrare? Inserisci l&rsquo;email e crea l&rsquo;account dello studio.
          </p>
          <form onSubmit={inizia} className="mt-4 flex w-full max-w-xl flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Indirizzo email"
              className="min-h-14 flex-1 rounded-sm border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-bordeaux-400"
            />
            <button
              type="submit"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-sm bg-bordeaux-700 px-7 text-xl font-semibold text-white hover:bg-bordeaux-800"
            >
              Inizia
              <span aria-hidden>›</span>
            </button>
          </form>
        </div>
      </section>

      <section id="chi-siamo" className="border-t border-neutral-200 bg-[#f5f5f7] px-6 py-20 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-3">
          {BLOCCHI.map((b, i) => (
            <Reveal key={b.kicker} delay={i * 80}>
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
        kicker="PEC e WhatsApp"
        titolo="La posta e le chat restano nel fascicolo."
        testo="La PEC si scarica da sola. Le non lette restano evidenti. WhatsApp dello studio riceve documenti e li collega al cliente. Niente caselle e telefoni sparsi."
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
        kicker="Calendario e deposito"
        titolo="Udienze visibili. Pacchetto pronto per il deposito."
        testo="Un calendario solo per lo studio, anche su Google. Il deposito prepara i file, controlla cosa manca e accetta i documenti già firmati."
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

      <section id="funzioni" className="border-t border-neutral-200 bg-[#f5f5f7] px-6 py-20 lg:px-12">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold text-neutral-900 sm:text-5xl">Tutto quello che c&rsquo;è dentro.</h2>
          <p className="mt-4 text-lg text-neutral-500">
            Non un pezzo alla volta. Lo studio intero, modulo per modulo.
          </p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULI.map((m, i) => (
            <Reveal key={m.titolo} delay={(i % 3) * 50}>
              <div className="h-full rounded-md bg-white p-6 ring-1 ring-black/[0.06]">
                <Icon nome={m.icona} className="h-6 w-6 text-bordeaux-700" />
                <h3 className="mt-4 text-lg font-bold text-neutral-900">{m.titolo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{m.testo}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-white px-6 py-20 lg:px-12">
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bordeaux-700">Sempre in aggiornamento</p>
          <h2 className="mt-3 text-3xl font-extrabold text-neutral-900 sm:text-5xl">
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
            <div key={s.n} className="rounded-md bg-neutral-50 p-6 ring-1 ring-black/[0.04]">
              <div className="text-sm font-bold text-bordeaux-700">{s.n}</div>
              <div className="mt-2 text-lg font-bold text-neutral-900">{s.t}</div>
              <p className="mt-2 text-sm text-neutral-500">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="sicurezza" className="border-t border-neutral-200 bg-[#f5f5f7] px-6 py-20 lg:px-12">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Icon nome="lucchetto" className="mx-auto h-10 w-10 text-bordeaux-700" />
          <h2 className="mt-6 text-3xl font-extrabold text-neutral-900 sm:text-5xl">
            Ogni documento è cifrato per il tuo studio soltanto.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Ogni studio ha una propria chiave. La cifratura avviene prima che il file
            tocchi lo storage. Non si può spegnere.
          </p>
        </Reveal>
      </section>

      <VetrinaPiani />
      <SponsorCarosello />
      <SezioneSponsor />
      <Faq />

      <section className="border-t border-neutral-200 bg-[#f5f5f7] px-6 py-20 text-center">
        <h2 className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">Pronto per lo studio, in un solo posto?</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/registrati" className="rounded bg-bordeaux-700 px-8 py-3 text-lg font-semibold text-white hover:bg-bordeaux-800">
            Crea l&rsquo;account
          </Link>
          <Link href="/accedi" className="rounded border border-neutral-300 px-8 py-3 text-lg font-semibold text-neutral-900 hover:bg-neutral-100">
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
            <a href="/politica-rimborsi" className="hover:underline">Rimborsi</a>
            <a href="/portale" className="hover:underline">Accedi come assistito</a>
            <a href="/accedi" className="hover:underline">Accedi</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
