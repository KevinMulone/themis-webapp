/**
 * Le icone dell'interfaccia, disegnate a mano come SVG.
 *
 * Non si aggiunge una libreria di icone per due ragioni: sono una
 * ventina in tutto, e una dipendenza in più va poi mantenuta per sempre.
 * Sono tutte sullo stesso tratto (1.6) e sulla stessa griglia (24×24),
 * che è ciò che le fa sembrare una famiglia invece che un insieme.
 *
 * Il colore lo eredita dal testo (`currentColor`): un'icona non decide
 * mai il proprio colore, lo prende dal contesto in cui è messa.
 */

export type NomeIcona =
  | 'dashboard' | 'clienti' | 'pratiche' | 'themis' | 'incarichi' | 'calendario'
  | 'pec' | 'genera' | 'calcolo' | 'parcelle' | 'patrocinio' | 'attivita'
  | 'collaboratori' | 'impostazioni' | 'esci' | 'piu' | 'freccia' | 'invio'
  | 'documento' | 'orologio' | 'abbonamento'
  | 'lucchetto' | 'scudo' | 'utente' | 'puntini';

const TRACCIATI: Record<NomeIcona, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  clienti: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 11.5a3 3 0 0 0 0-6" />
      <path d="M18 20c0-2.5-1-4.2-2.5-5.1" />
    </>
  ),
  pratiche: (
    <>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M8.5 13h7M8.5 17h4" />
    </>
  ),
  themis: (
    <>
      <path d="M12 3v18" />
      <path d="M6 7h12" />
      <path d="M6 7 3 13h6L6 7Z" />
      <path d="M18 7l-3 6h6l-3-6Z" />
      <path d="M8 21h8" />
    </>
  ),
  incarichi: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M9 11l2 2 4-4" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  pec: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.8 7 7.3 5.4a1.5 1.5 0 0 0 1.8 0L20.2 7" />
    </>
  ),
  genera: (
    <>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  calcolo: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
    </>
  ),
  parcelle: (
    <>
      <path d="M5 3h14v18l-2.3-1.6L14.4 21l-2.4-1.6L9.6 21l-2.3-1.6L5 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  patrocinio: (
    <>
      <path d="M12 3v18" />
      <path d="M5 7h14" />
      <path d="M8 21h8" />
      <path d="M5 7l-2 5h4l-2-5Z" />
      <path d="M19 7l-2 5h4l-2-5Z" />
    </>
  ),
  attivita: (
    <>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </>
  ),
  collaboratori: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M2.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M15.5 19.5c0-2 .8-3.4 2-4.2" />
    </>
  ),
  impostazioni: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </>
  ),
  esci: (
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l-4 4 4 4M6 12h11" />
    </>
  ),
  piu: <path d="M12 5v14M5 12h14" />,
  freccia: <path d="m9 6 6 6-6 6" />,
  invio: (
    <>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3 14.5 21l-4-8-8-4L21 3Z" />
    </>
  ),
  documento: (
    <>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
    </>
  ),
  orologio: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  abbonamento: (
    <>
      <path d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8L6.7 20l1-6L3.4 9.9 9.4 9 12 3.5Z" />
    </>
  ),
  lucchetto: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  scudo: (
    <>
      <path d="M12 3l7.5 3v6c0 4.5-3 8-7.5 9.5C7.5 20 4.5 16.5 4.5 12V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  utente: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </>
  ),
  puntini: (
    <>
      <circle cx="12" cy="5" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="12" cy="19" r="1.2" />
    </>
  ),
};

export function Icon({ nome, className = 'h-5 w-5' }: { nome: NomeIcona; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {TRACCIATI[nome]}
    </svg>
  );
}
