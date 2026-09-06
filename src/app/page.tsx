'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

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
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, []);

  return (
    <div
      ref={rif}
      className={`transition-[opacity,transform,filter] duration-[1100ms] ease-[cubic-bezier(.16,1,.3,1)] ${
        visibile ? 'translate-y-0 opacity-100 blur-none' : 'translate-y-8 opacity-0 blur-sm'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Chrome({ children, titolo }: { children: ReactNode; titolo: string }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_40px_80px_-40px_rgba(29,29,31,.35)]">
      <div className="flex items-center gap-2 border-b border-black/[0.05] bg-neutral-50/90 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[11px] font-medium tracking-tight text-neutral-400">{titolo}</span>
      </div>
      {children}
    </div>
  );
}

function RotatingWord() {
  const parole = ['pratiche', 'PEC', 'udienze', 'atti', 'fascicoli'];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % parole.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-block min-w-[8.5rem] text-left text-bordeaux-700">
      {parole.map((p, idx) => (
        <span
          key={p}
          className={`absolute inset-x-0 transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)] ${
            idx === i ? 'translate-y-0 opacity-100 blur-none' : 'translate-y-3 opacity-0 blur-sm'
          }`}
        >
          {p}
        </span>
      ))}
      <span className="invisible">{parole[0]}</span>
    </span>
  );
}

const SLIDES = [
  {
    kicker: 'Dashboard',
    titolo: 'La giornata dello studio, in un colpo d’occhio.',
    testo: 'Scadenze, PEC non lette e incarichi aperti — senza aprire cinque programmi.',
    mock: 'dash',
  },
  {
    kicker: 'Assistente',
    titolo: 'Chiedi al fascicolo. Risponde con la pagina.',
    testo: 'Themis legge solo i documenti che scegli tu. Niente precedenti inventati.',
    mock: 'ai',
  },
  {
    kicker: 'PEC',
    titolo: 'La posta certificata entra nel fascicolo.',
    testo: 'Non lette in evidenza. I termini proposti sul calendario, appena arrivano.',
    mock: 'pec',
  },
  {
    kicker: 'Calendario',
    titolo: 'Udienze visibili a tutto lo studio.',
    testo: 'Un’agenda sola. Il nome dell’assistito accanto a ogni voce.',
    mock: 'cal',
  },
] as const;

function MockSlide({ tipo }: { tipo: (typeof SLIDES)[number]['mock'] }) {
  if (tipo === 'ai') {
    return (
      <div className="space-y-3 p-5">
        <div className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-[13px] text-white">
          Da quando decorre l’invalidità del verbale?
        </div>
        <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-neutral-50 px-4 py-2.5 text-[13px] text-neutral-700">
          Decorrenza dalla domanda amministrativa. Invalidità riconosciuta all’80%.
        </div>
        <div className="text-[11px] text-neutral-400">Verbale INPS.pdf · p. 2</div>
      </div>
    );
  }
  if (tipo === 'pec') {
    return (
      <div className="divide-y divide-black/[0.04] p-2">
        {[
          ['Tribunale di Caltanissetta', 'Fissazione udienza'],
          ['Generali Italia', 'Riscontro sinistro'],
          ['Avv. Di Vita', 'Trasmissione ricorso'],
        ].map(([a, b], i) => (
          <div key={a} className="flex items-center gap-3 px-4 py-3">
            <span className={`h-1.5 w-1.5 rounded-full ${i < 2 ? 'bg-bordeaux-700' : 'bg-transparent'}`} />
            <div className="min-w-0">
              <div className={`truncate text-[13px] ${i < 2 ? 'font-semibold' : 'text-neutral-500'}`}>{a}</div>
              <div className="truncate text-[12px] text-neutral-400">{b}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (tipo === 'cal') {
    const g = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
    return (
      <div className="p-6">
        <div className="grid grid-cols-7 gap-2 text-center">
          {g.map((d, i) => <span key={i} className="text-[10px] text-neutral-400">{d}</span>)}
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] ${i === 2 ? 'bg-neutral-900 text-white' : ''}`}>{9 + i}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3 p-5">
      {[['12', 'Pratiche'], ['3', 'Udienze'], ['7', 'PEC']].map(([n, l]) => (
        <div key={l} className="rounded-2xl bg-neutral-50 p-4">
          <div className="text-[22px] font-semibold tracking-tight">{n}</div>
          <div className="text-[11px] text-neutral-500">{l}</div>
        </div>
      ))}
    </div>
  );
}

function ProductSlides() {
  const [attiva, setAttiva] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAttiva((n) => (n + 1) % SLIDES.length), 5200);
    return () => clearInterval(t);
  }, []);
  const s = SLIDES[attiva];
  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <p className="text-[13px] font-medium text-bordeaux-700">{s.kicker}</p>
          <h2 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-tight sm:text-[44px]">
            {s.titolo}
          </h2>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-neutral-500">{s.testo}</p>
          <div className="mt-8 flex gap-2">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.kicker}
                type="button"
                aria-label={slide.kicker}
                onClick={() => setAttiva(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === attiva ? 'w-8 bg-neutral-900' : 'w-3 bg-neutral-300 hover:bg-neutral-400'}`}
              />
            ))}
          </div>
        </div>
        <div className="fluttua">
          <Chrome titolo={`Themis — ${s.kicker}`}>
            <div className="min-h-[220px] bg-white">
              <MockSlide tipo={s.mock} />
            </div>
          </Chrome>
        </div>
      </div>
    </div>
  );
}

const FUNZIONI: { icona: NomeIcona; titolo: string; testo: string }[] = [
  { icona: 'pratiche', titolo: 'Gestione pratiche', testo: 'Fascicoli, scadenze e stato in un unico posto.' },
  { icona: 'calendario', titolo: 'Calendario dello studio', testo: 'Udienze e termini visibili a tutti i collaboratori.' },
  { icona: 'genera', titolo: 'Generazione atti', testo: 'Prime stesure nello stile del tuo studio.' },
  { icona: 'scudo', titolo: 'Cifratura per studio', testo: 'Ogni documento è leggibile solo dal tuo studio.' },
];

const PIANI = [
  { key: 'monthly', nome: 'Mensile', pubblico: 'Per piccoli studi', prezzo: '100€', periodo: '/mese', dettaglio: 'Fatturazione mensile, disdici quando vuoi.', posti: 1 },
  { key: 'semestrale', nome: 'Semestrale', pubblico: 'Per studi in crescita', prezzo: '500€', periodo: '/6 mesi', dettaglio: 'Un mese omaggio rispetto al mensile.', posti: 3 },
  { key: 'annuale', nome: 'Annuale', pubblico: 'Per studi strutturati', prezzo: '1.100€', periodo: '/anno', dettaglio: 'Include le future funzionalità AI.', posti: 5 },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f7] text-neutral-900">
      <header className="vetro sticky top-0 z-40 border-b border-black/[0.06]">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/icon.svg" alt="" width={22} height={22} className="rounded-[6px]" />
            <span className="text-[13px] font-semibold tracking-tight">Themis</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[12.5px] text-neutral-600 sm:flex">
            <a href="#prodotto" className="hover:text-neutral-900">Prodotto</a>
            <a href="#piani" className="hover:text-neutral-900">Piani</a>
            <a href="#sicurezza" className="hover:text-neutral-900">Sicurezza</a>
          </nav>
          <Link
            href="/accedi"
            className="premi rounded-full bg-neutral-900 px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-black"
          >
            Accedi
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 55% at 50% -10%, rgba(107,29,57,.10), transparent 58%), radial-gradient(40% 40% at 90% 10%, rgba(201,147,42,.10), transparent 50%)',
          }}
        />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-10 pt-16 text-center sm:pt-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/70 px-3 py-1 text-[12px] font-medium text-neutral-600 shadow-sm backdrop-blur">
              Per studi legali
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-tight text-neutral-900 sm:text-[72px]">
              Lo studio.
              <br />
              Le tue <RotatingWord />.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-neutral-500 sm:text-[21px]">
              Un’unica app per fascicoli, posta certificata, calendario
              e un assistente che legge solo ciò che gli dai tu.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/registrati"
                className="premi rounded-full bg-bordeaux-700 px-6 py-3 text-[15px] font-medium text-white shadow-[0_10px_24px_-12px_rgba(107,29,57,.7)] hover:bg-bordeaux-800"
              >
                Inizia ora
              </Link>
              <Link
                href="/accedi"
                className="premi rounded-full bg-white/80 px-6 py-3 text-[15px] font-medium text-neutral-800 ring-1 ring-black/[0.06] hover:bg-white"
              >
                Accedi
              </Link>
            </div>
          </Reveal>
        </div>

        <div className="relative mx-auto max-w-[100vw] overflow-hidden pb-8 pt-4">
          <div className="nastro flex w-max gap-10 px-8 text-[13px] font-medium text-neutral-400">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ['Pratiche', 'PEC', 'Calendario', 'Themis AI', 'Deposito', 'Parcelle', 'WhatsApp', 'Collaboratori', 'Cifratura'].map((v) => (
                <span key={`${k}-${v}`} className="flex items-center gap-10">
                  {v}
                  <span className="h-1 w-1 rounded-full bg-neutral-300" />
                </span>
              )),
            )}
          </div>
        </div>
      </section>

      <section id="prodotto" className="px-6 py-20 lg:px-12">
        <ProductSlides />
      </section>

      <section className="px-6 py-8 lg:px-12">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FUNZIONI.map((f, i) => (
            <Reveal key={f.titolo} delay={i * 60}>
              <div className="h-full rounded-[24px] bg-white p-6 ring-1 ring-black/[0.04]">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-50 text-bordeaux-700">
                  <Icon nome={f.icona} className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{f.titolo}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500">{f.testo}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <VetrinaThemis />
      <VetrinaPec />
      <VetrinaCalendario />
      <VetrinaPiani />

      <section id="sicurezza" className="px-6 py-24 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-bordeaux-700 ring-1 ring-black/[0.05]">
              <Icon nome="lucchetto" className="h-6 w-6" />
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 text-[34px] font-semibold tracking-tight sm:text-[48px]">
              Ogni documento è cifrato per il tuo studio soltanto.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-neutral-500">
              Ogni studio ha una propria chiave di cifratura. La cifratura avviene
              prima che il documento tocchi lo storage, e non può essere disattivata.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-6 pb-24 lg:px-12">
        <Reveal className="mx-auto max-w-4xl overflow-hidden rounded-[32px] bg-neutral-900 px-8 py-16 text-center text-white sm:px-16">
          <h2 className="text-[34px] font-semibold tracking-tight sm:text-[48px]">
            Porta il tuo studio su Themis.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-white/60">
            Pratiche, PEC, calendario e un assistente che conosce i tuoi fascicoli.
          </p>
          <Link
            href="/registrati"
            className="premi mt-8 inline-flex rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-neutral-900 hover:bg-neutral-100"
          >
            Registra il tuo studio
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-black/[0.06] px-6 py-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-[12px] text-neutral-400 sm:flex-row">
          <span>© {new Date().getFullYear()} Themis</span>
          <span className="flex gap-6">
            <Link href="/privacy" className="hover:text-neutral-600">Informativa privacy</Link>
            <Link href="/politica-rimborsi" className="hover:text-neutral-600">Politica di rimborso</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

const CAPACITA_THEMIS: { icona: NomeIcona; titolo: string; testo: string }[] = [
  { icona: 'documento', titolo: 'Analisi del fascicolo', testo: 'Legge i documenti della pratica che scegli tu: PDF, Word e testo.' },
  { icona: 'matita', titolo: 'Risposte con citazione', testo: 'Risponde solo su ciò che trova negli atti, indicando documento e pagina.' },
  { icona: 'genera', titolo: 'Bozze di atti', testo: 'Prima stesura di diffide, ricorsi e memorie, nello stile dello studio.' },
];

function VetrinaThemis() {
  return (
    <section className="px-6 py-24 lg:px-12">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-bordeaux-700">
            <Icon nome="themis" className="h-3.5 w-3.5" />
            Assistente dello studio
          </span>
          <h2 className="mt-4 text-[36px] font-semibold leading-[1.12] tracking-tight sm:text-[48px]">
            Chiedi al fascicolo, non a un motore di ricerca.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-neutral-500">
            Themis legge i documenti che scegli tu, risponde citando pagina e riga, e prepara
            una prima bozza di atti. Dove servirebbe un precedente lascia un segnaposto:
            la responsabilità di ciò che si firma resta dell&rsquo;avvocato.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <Chrome titolo="Themis — Assistente">
            <div className="space-y-4 bg-white p-6">
              <div className="ml-auto max-w-[88%] rounded-[20px] rounded-br-md bg-neutral-900 px-4 py-3 text-[14px] leading-relaxed text-white">
                Da quando decorre l&rsquo;invalidità riconosciuta nel verbale?
              </div>
              <div className="max-w-[92%] rounded-[20px] rounded-bl-md bg-neutral-50 px-4 py-3 text-[14px] leading-relaxed text-neutral-700">
                Il verbale riconosce l&rsquo;80% di invalidità civile, con decorrenza dalla
                data della domanda amministrativa.
              </div>
              <div className="text-[12px] text-neutral-400">
                Verbale INPS aggravamento.pdf · pagina 2
              </div>
            </div>
          </Chrome>
        </Reveal>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-3">
        {CAPACITA_THEMIS.map((c, i) => (
          <Reveal key={c.titolo} delay={i * 70}>
            <div className="h-full rounded-[24px] bg-white p-6 ring-1 ring-black/[0.04]">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-50 text-bordeaux-700">
                <Icon nome={c.icona} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{c.titolo}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500">{c.testo}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function VetrinaPec() {
  return (
    <section className="px-6 py-8 lg:px-12">
      <div className="mx-auto grid max-w-6xl items-center gap-16 overflow-hidden rounded-[32px] bg-white px-8 py-16 ring-1 ring-black/[0.04] lg:grid-cols-2 lg:px-14">
        <Reveal delay={80} className="order-2 lg:order-1">
          <div className="overflow-hidden rounded-[22px] bg-neutral-50 ring-1 ring-black/[0.04]">
            {[
              { chi: 'Tribunale di Caltanissetta', ogg: 'Fissazione udienza — R.G. 1135/2018', letta: false },
              { chi: 'Generali Italia S.p.A.', ogg: 'Riscontro sinistro n. I20202600051011', letta: false },
              { chi: 'Avv. Luisa Di Vita', ogg: 'Trasmissione ricorso art. 35-bis', letta: true },
            ].map((m) => (
              <div key={m.chi} className="flex items-center gap-3 border-b border-black/[0.04] px-5 py-4 last:border-0">
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${m.letta ? 'bg-transparent' : 'bg-bordeaux-700'}`} />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[14px] ${m.letta ? 'font-normal text-neutral-500' : 'font-semibold text-neutral-900'}`}>
                    {m.chi}
                  </div>
                  <div className="truncate text-[12.5px] text-neutral-400">{m.ogg}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="order-1 lg:order-2">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-500">
            <Icon nome="pec" className="h-3.5 w-3.5" />
            Posta certificata
          </span>
          <h2 className="mt-4 text-[36px] font-semibold leading-[1.12] tracking-tight sm:text-[44px]">
            Le PEC arrivano dentro Themis.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-neutral-500">
            Ricevute e inviate in tempo reale, non lette in evidenza, e le scadenze
            proposte per il calendario appena arrivano.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function VetrinaCalendario() {
  const giorni = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const impegno: Record<number, string> = { 1: 'bg-bordeaux-700', 3: 'bg-gold-500', 4: 'bg-bordeaux-700' };
  return (
    <section className="px-6 py-24 lg:px-12">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-500">
            <Icon nome="calendario" className="h-3.5 w-3.5" />
            Calendario condiviso
          </span>
          <h2 className="mt-4 text-[36px] font-semibold leading-[1.12] tracking-tight sm:text-[44px]">
            Un calendario solo, visibile a tutto lo studio.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-neutral-500">
            Udienze, termini e appuntamenti di chiunque abbia accesso allo studio,
            con il nome dell&rsquo;assistito sempre a fianco della voce.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-[28px] bg-white p-8 ring-1 ring-black/[0.04]">
            <div className="grid grid-cols-7 gap-2 text-center">
              {giorni.map((g, i) => (
                <span key={i} className="text-[11px] font-medium text-neutral-400">{g}</span>
              ))}
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 pt-1">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-[14px] ${
                      i === 2 ? 'bg-neutral-900 font-medium text-white' : 'text-neutral-700'
                    }`}
                  >
                    {9 + i}
                  </span>
                  {impegno[i] && <span className={`h-1.5 w-1.5 rounded-full ${impegno[i]}`} />}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
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
    <section id="piani" className="px-6 py-16 lg:px-12">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-[36px] font-semibold tracking-tight sm:text-[48px]">
          Un piano per ogni studio.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed text-neutral-500">
          Più lungo è l&rsquo;impegno, più posti per i collaboratori sono inclusi, oltre al titolare.
        </p>
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
        {PIANI.map((p, i) => {
          const featured = p.key === 'annuale';
          return (
            <Reveal key={p.key} delay={i * 70}>
              <div className={`flex h-full flex-col rounded-[28px] p-7 ${
                featured
                  ? 'bg-neutral-900 text-white shadow-[0_30px_60px_-36px_rgba(0,0,0,.55)]'
                  : 'bg-white ring-1 ring-black/[0.04]'
              }`}>
                <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  featured ? 'bg-white/10 text-white' : 'bg-neutral-50 text-neutral-600'
                }`}>
                  {p.pubblico}
                </span>
                <div className={`mt-4 text-[13px] ${featured ? 'text-white/55' : 'text-neutral-500'}`}>{p.nome}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[40px] font-semibold tracking-tight">{p.prezzo}</span>
                  <span className={featured ? 'text-white/50' : 'text-neutral-400'}>{p.periodo}</span>
                </div>
                <p className={`mt-3 text-[14px] leading-relaxed ${featured ? 'text-white/70' : 'text-neutral-500'}`}>
                  {p.dettaglio}
                </p>
                <p className={`mt-4 text-[13px] ${featured ? 'text-white/70' : 'text-neutral-600'}`}>
                  {p.posti} {p.posti === 1 ? 'collaboratore' : 'collaboratori'} oltre al titolare
                </p>
                <button
                  type="button" onClick={() => scegliPiano(p.key)} disabled={pianoInCorso !== null}
                  className={`premi mt-auto rounded-full px-5 py-3 text-[14px] font-medium disabled:opacity-50 ${
                    featured ? 'mt-8 bg-white text-neutral-900 hover:bg-neutral-100' : 'mt-8 bg-neutral-900 text-white hover:bg-black'
                  }`}
                >
                  {pianoInCorso === p.key ? 'Attendere...' : `Scegli ${p.nome.toLowerCase()}`}
                </button>
              </div>
            </Reveal>
          );
        })}
      </div>

      {errore && <p className="mt-6 text-center text-sm text-red-600">{errore}</p>}

      <p className="mx-auto mt-8 max-w-md text-center text-[13px] text-neutral-400">
        Hai già una chiave di attivazione?{' '}
        <a href="/attiva" className="font-medium text-neutral-800 hover:underline">Attivala qui</a>.
      </p>
    </section>
  );
}
