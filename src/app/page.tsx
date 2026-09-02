'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

/**
 * Fa comparire il suo contenuto quando entra nello schermo — mai prima,
 * mai due volte. È l'unico modo in cui questa pagina si muove: niente
 * rimbalzi, niente rotazioni, solo la stessa dissolvenza-verso-l'alto
 * usata nel resto dell'app (vedi .entra in globals.css), qui innescata
 * dallo scorrimento invece che dal caricamento.
 */
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
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
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

const FUNZIONI: { icona: NomeIcona; tono: string; titolo: string; testo: string }[] = [
  { icona: 'pratiche', tono: 'bg-red-50 text-red-600', titolo: 'Gestione pratiche', testo: 'Organizza e monitora tutte le tue pratiche.' },
  { icona: 'calendario', tono: 'bg-blue-50 text-blue-600', titolo: 'Calendario integrato', testo: 'Pianifica udienze, scadenze e appuntamenti.' },
  { icona: 'genera', tono: 'bg-green-50 text-green-600', titolo: 'Generazione atti', testo: 'Crea atti e documenti in pochi clic.' },
  { icona: 'scudo', tono: 'bg-gold-100 text-gold-700', titolo: 'Sicuro e affidabile', testo: 'I tuoi dati sono protetti e sempre al sicuro.' },
];

/** Gli stessi tre piani, con lo stesso prezzo, di /attiva — nessuna cifra propria qui. */
const PIANI = [
  { key: 'monthly', nome: 'Mensile', prezzo: '100€', periodo: '/mese', dettaglio: 'Fatturazione mensile, disdici quando vuoi.', posti: 1 },
  { key: 'semestrale', nome: 'Semestrale', prezzo: '500€', periodo: '/6 mesi', dettaglio: 'Un mese omaggio rispetto al mensile.', posti: 3 },
  { key: 'annuale', nome: 'Annuale', prezzo: '1.100€', periodo: '/anno', dettaglio: 'Include le future funzionalità AI.', posti: 5 },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Sfondo della sola sezione d'apertura: due aloni appena percettibili,
          bordeaux e oro, che sfumano nel bianco. Non un colore di sfondo,
          un suggerimento. */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 50% at 15% 0%, rgba(107,29,57,.06), transparent), radial-gradient(50% 45% at 100% 15%, rgba(201,147,42,.08), transparent)',
          }}
        />

        <header className="flex items-center justify-between px-6 py-6 lg:px-12">
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900">Themis</span>
          <Link
            href="/accedi"
            className="premi rounded-full px-4 py-2 text-[13.5px] font-medium text-neutral-800 hover:bg-neutral-100"
          >
            Accedi
          </Link>
        </header>

        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-8 text-center lg:pt-16">
          <Reveal>
            <Image src="/icon.svg" alt="" width={84} height={84} className="rounded-[22px] shadow-[0_20px_50px_-20px_rgba(107,29,57,.45)]" />
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mt-8 text-[64px] font-light leading-[1.05] tracking-tight text-bordeaux-800 sm:text-[80px]">
              Themis
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-5 flex items-center gap-3 text-gold-500">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold-300" />
              <span className="h-1.5 w-1.5 rotate-45 bg-gold-500" />
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-gold-300" />
            </div>
          </Reveal>

          <Reveal delay={220}>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-neutral-500">
              Gestione pratiche legali, calendario e generazione atti per studi legali.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/accedi"
                className="premi flex items-center gap-2 rounded-full bg-bordeaux-700 px-6 py-3 text-[14.5px] font-medium text-white hover:bg-bordeaux-800"
              >
                Accedi
                <Icon nome="freccia" className="h-4 w-4" />
              </Link>
              <Link
                href="/registrati"
                className="premi rounded-full bg-neutral-100 px-6 py-3 text-[14.5px] font-medium text-neutral-800 hover:bg-neutral-200"
              >
                Registra il tuo studio
              </Link>
            </div>
          </Reveal>

          <div className="mt-20 grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            {FUNZIONI.map((f, i) => (
              <Reveal key={f.titolo} delay={380 + i * 70}>
                <div className="rialzo h-full rounded-2xl bg-neutral-50 p-6 text-left">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.tono}`}>
                    <Icon nome={f.icona} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[14.5px] font-semibold tracking-tight text-neutral-900">{f.titolo}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">{f.testo}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={700}>
            <p className="mt-10 flex items-center gap-2 text-[12.5px] text-neutral-400">
              <Icon nome="lucchetto" className="h-3.5 w-3.5" />
              Sicurezza e privacy al primo posto.
              <a href="#sicurezza" className="font-medium text-bordeaux-700 hover:underline">Scopri di più →</a>
            </p>
          </Reveal>
        </section>
      </div>

      {/* ------------------------------------------------------------
          Le tre vetrine. Ogni sezione racconta una sola cosa, con un
          esempio disegnato invece che una foto — non abbiamo scatti
          del prodotto da mostrare, e un'imitazione approssimativa
          sarebbe peggio di un disegno onesto.
          ------------------------------------------------------------ */}
      <VetrinaThemis />
      <VetrinaPec />
      <VetrinaCalendario />
      <VetrinaPiani />

      <section id="sicurezza" className="border-t border-neutral-200/70 bg-neutral-50 px-6 py-24 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bordeaux-700/[0.08] text-bordeaux-700 mx-auto">
              <Icon nome="lucchetto" className="h-6 w-6" />
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 text-[34px] font-semibold tracking-tight text-neutral-900 sm:text-[42px]">
              Ogni documento è cifrato per il tuo studio soltanto.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-neutral-500">
              Ogni studio ha una propria chiave di cifratura: nessun altro studio, per quanto
              in buona fede, può leggere un fascicolo che non è il suo. La cifratura avviene
              prima che il documento tocchi lo storage, e non può essere disattivata.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-24 lg:px-12">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-7 text-center">
          <h2 className="text-[34px] font-semibold tracking-tight text-neutral-900 sm:text-[42px]">
            Porta il tuo studio su Themis.
          </h2>
          <p className="max-w-md text-[16px] leading-relaxed text-neutral-500">
            Pratiche, PEC, calendario e un assistente che conosce i tuoi fascicoli — in un unico posto.
          </p>
          <Link
            href="/registrati"
            className="premi rounded-full bg-bordeaux-700 px-7 py-3.5 text-[15px] font-medium text-white hover:bg-bordeaux-800"
          >
            Registra il tuo studio
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-neutral-200/70 px-6 py-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-[12.5px] text-neutral-400 sm:flex-row">
          <span>© {new Date().getFullYear()} Themis</span>
          <Link href="/politica-rimborsi" className="hover:text-neutral-600">Politica di rimborso</Link>
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

/** La chat con l'assistente, e le tre cose che sa fare davvero — le stesse tre della pagina Themis in app. */
function VetrinaThemis() {
  return (
    <section className="border-t border-neutral-200/70 px-6 py-24 lg:px-12">
      <div className="mx-auto grid max-w-5xl items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-bordeaux-700/[0.08] px-3 py-1 text-[12.5px] font-medium text-bordeaux-700">
            <Icon nome="themis" className="h-3.5 w-3.5" />
            Assistente dello studio
          </span>
          <h2 className="mt-5 text-[34px] font-semibold leading-[1.15] tracking-tight text-neutral-900 sm:text-[40px]">
            Chiedi al fascicolo, non a un motore di ricerca.
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-neutral-500">
            Themis legge i documenti che scegli tu, risponde citando pagina e riga, e prepara
            una prima bozza di atti — diffide, ricorsi, memorie — nello stile dello studio.
            Dove servirebbe un precedente giurisprudenziale lascia un segnaposto, non
            se lo inventa: la responsabilità di ciò che si firma resta dell&rsquo;avvocato.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="rialzo rounded-2xl bg-neutral-50 p-6">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-bordeaux-700 px-4 py-2.5 text-[13.5px] text-white">
              Da quando decorre l&rsquo;invalidità riconosciuta nel verbale?
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-neutral-700">
              Il verbale riconosce l&rsquo;80% di invalidità civile, con decorrenza dalla
              data della domanda amministrativa.
            </p>
            <div className="mt-3 border-l-2 border-neutral-200 pl-3 text-[12px] italic text-neutral-400">
              Verbale INPS aggravamento.pdf, pagina 2
            </div>
          </div>
        </Reveal>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
        {CAPACITA_THEMIS.map((c, i) => (
          <Reveal key={c.titolo} delay={i * 80}>
            <div className="rialzo h-full rounded-2xl bg-neutral-50 p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bordeaux-700/[0.08] text-bordeaux-700">
                <Icon nome={c.icona} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[14.5px] font-semibold tracking-tight text-neutral-900">{c.titolo}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">{c.testo}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** La casella PEC: due righe, quella non letta in grassetto. */
function VetrinaPec() {
  return (
    <section className="border-t border-neutral-200/70 bg-neutral-50 px-6 py-24 lg:px-12">
      <div className="mx-auto grid max-w-5xl items-center gap-14 lg:grid-cols-2">
        <Reveal delay={120} className="order-2 lg:order-1">
          <div className="rialzo rounded-2xl bg-white p-2">
            {[
              { chi: 'Tribunale di Caltanissetta', ogg: 'Fissazione udienza — R.G. 1135/2018', letta: false },
              { chi: 'Generali Italia S.p.A.', ogg: 'Riscontro sinistro n. I20202600051011', letta: false },
              { chi: 'Avv. Luisa Di Vita', ogg: 'Trasmissione ricorso art. 35-bis', letta: true },
            ].map((m) => (
              <div key={m.chi} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3.5 last:border-0">
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${m.letta ? 'bg-transparent' : 'bg-bordeaux-700'}`} />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[13px] ${m.letta ? 'font-normal text-neutral-500' : 'font-semibold text-neutral-900'}`}>
                    {m.chi}
                  </div>
                  <div className="truncate text-[12px] text-neutral-400">{m.ogg}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="order-1 lg:order-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-neutral-200/70 px-3 py-1 text-[12.5px] font-medium text-neutral-700">
            <Icon nome="pec" className="h-3.5 w-3.5" />
            Posta certificata
          </span>
          <h2 className="mt-5 text-[34px] font-semibold leading-[1.15] tracking-tight text-neutral-900 sm:text-[40px]">
            Le PEC arrivano dentro Themis, non solo nella tua casella.
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-neutral-500">
            Ricevute e inviate in tempo reale, non lette in evidenza, e le scadenze
            che contengono — un&rsquo;udienza, un termine — proposte per il calendario
            appena arrivano.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/** Il calendario: una settimana, tre pallini colorati per tipo di impegno. */
function VetrinaCalendario() {
  const giorni = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const impegno: Record<number, string> = { 1: 'bg-bordeaux-700', 3: 'bg-gold-500', 4: 'bg-bordeaux-700' };
  return (
    <section className="border-t border-neutral-200/70 px-6 py-24 lg:px-12">
      <div className="mx-auto grid max-w-5xl items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-[12.5px] font-medium text-neutral-700">
            <Icon nome="calendario" className="h-3.5 w-3.5" />
            Calendario condiviso
          </span>
          <h2 className="mt-5 text-[34px] font-semibold leading-[1.15] tracking-tight text-neutral-900 sm:text-[40px]">
            Un calendario solo, visibile a tutto lo studio.
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-neutral-500">
            Nessuna agenda personale nascosta: udienze, termini e appuntamenti sono
            di chiunque abbia accesso allo studio, con il nome dell&rsquo;assistito
            sempre a fianco della voce.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="rialzo rounded-2xl bg-neutral-50 p-7">
            <div className="grid grid-cols-7 gap-2 text-center">
              {giorni.map((g, i) => (
                <span key={i} className="text-[11px] font-medium text-neutral-400">{g}</span>
              ))}
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 pt-1">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] ${
                      i === 2 ? 'bg-bordeaux-700 font-semibold text-white' : 'text-neutral-700'
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

/**
 * I tre piani, con lo stesso avvio di pagamento già in /attiva: nessuna
 * pagina intermedia, si sceglie qui e si arriva dritti al pagamento
 * Stripe. Non serve essere già registrati — la chiave arriva via email
 * subito dopo, da incollare al primo accesso.
 */
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
    <section id="piani" className="border-t border-neutral-200/70 bg-neutral-50 px-6 py-24 lg:px-12">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-[34px] font-semibold tracking-tight text-neutral-900 sm:text-[42px]">
          Un piano per ogni studio.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-neutral-500">
          Più lungo è l&rsquo;impegno, più posti per i collaboratori sono inclusi, oltre al titolare.
        </p>
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {PIANI.map((p, i) => (
          <Reveal key={p.key} delay={i * 80}>
            <div className={`rialzo flex h-full flex-col rounded-2xl p-7 ${p.key === 'annuale' ? 'bg-bordeaux-700 text-white' : 'bg-white'}`}>
              <div className={`text-[13px] font-medium ${p.key === 'annuale' ? 'text-white/70' : 'text-neutral-500'}`}>{p.nome}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-[32px] font-semibold tracking-tight">{p.prezzo}</span>
                <span className={p.key === 'annuale' ? 'text-white/70' : 'text-neutral-400'}>{p.periodo}</span>
              </div>
              <p className={`mt-3 text-[13.5px] leading-relaxed ${p.key === 'annuale' ? 'text-white/80' : 'text-neutral-500'}`}>
                {p.dettaglio}
              </p>
              <p className={`mt-4 text-[13px] ${p.key === 'annuale' ? 'text-white/80' : 'text-neutral-600'}`}>
                {p.posti} {p.posti === 1 ? 'collaboratore' : 'collaboratori'} oltre al titolare
              </p>
              <button
                type="button" onClick={() => scegliPiano(p.key)} disabled={pianoInCorso !== null}
                className={`premi mt-6 rounded-full px-5 py-2.5 text-[14px] font-medium disabled:opacity-50 ${
                  p.key === 'annuale' ? 'bg-white text-bordeaux-700 hover:bg-white/90' : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                }`}
              >
                {pianoInCorso === p.key ? 'Attendere...' : `Scegli ${p.nome.toLowerCase()}`}
              </button>
            </div>
          </Reveal>
        ))}
      </div>

      {errore && <p className="mt-6 text-center text-sm text-red-600">{errore}</p>}

      <p className="mx-auto mt-8 max-w-md text-center text-[13px] text-neutral-400">
        Hai già una chiave di attivazione?{' '}
        <a href="/attiva" className="font-medium text-bordeaux-700 hover:underline">Attivala qui</a>.
      </p>
    </section>
  );
}
