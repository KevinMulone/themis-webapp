/**
 * Le etichette di stato — "In attesa", "Esaurito", "Da verificare",
 * "Attivo". Prima ogni pagina sceglieva a memoria una coppia
 * sfondo/testo (bg-gold-100 text-gold-700, bg-green-100 text-green-700...)
 * e a volte le invertiva per sbaglio (testo chiaro su sfondo chiaro).
 * Qui i cinque significati sono fissi, e il colore segue il significato,
 * non il gusto del momento.
 */
type Tono = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

const TONI: Record<Tono, string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-gold-100 text-gold-700',
  danger: 'bg-red-50 text-red-700',
  brand: 'bg-bordeaux-700/[0.08] text-bordeaux-700',
};

export function Badge({ tono = 'neutral', className = '', children, ...props }: {
  tono?: Tono;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${TONI[tono]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
