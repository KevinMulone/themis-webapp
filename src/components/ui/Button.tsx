import { forwardRef } from 'react';

/**
 * Il bottone unico dell'app.
 *
 * Prima di questo file, ogni pagina scriveva la propria stringa di classi
 * per un bottone bordeaux — 41 varianti quasi identiche, ognuna con
 * margini leggermente diversi (px-4 py-2, px-3 py-1.5, px-5 py-2.5...).
 * Nessuna era sbagliata da sola, ma sommate rendevano l'app incoerente
 * senza che si capisse subito perché. Da qui in avanti chi scrive un
 * bottone sceglie fra cinque intenti (variant) e due misure (size),
 * non inventa margini.
 */

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
type Size = 'sm' | 'md';

const VARIANTI: Record<Variant, string> = {
  // L'azione principale della schermata: una sola per vista, di regola.
  primary: 'bg-bordeaux-700 text-white hover:bg-bordeaux-800 disabled:opacity-40',
  // Azioni alternative o di annullamento, accanto a una primaria.
  secondary: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-40',
  // Eliminazioni e altre azioni che non si possono disfare.
  danger: 'bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40',
  // Azioni minori dentro una lista o una barra, senza bordo.
  ghost: 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40',
  // Si comporta come testo cliccabile, non come un pulsante: per azioni
  // secondarissime ("Annulla", "Torna a modificare").
  link: 'text-bordeaux-700 hover:underline disabled:opacity-40',
};

const MISURE: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-[12.5px]',
  md: 'px-5 py-2 text-[13.5px]',
};

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: Size;
}>(function Button({ variant = 'primary', size = 'md', className = '', ...props }, ref) {
  const base = variant === 'link'
    ? 'font-medium tracking-tight disabled:cursor-not-allowed'
    : 'premi rounded-full font-medium tracking-tight disabled:cursor-not-allowed';
  const misura = variant === 'link' ? '' : MISURE[size];
  return (
    <button
      ref={ref}
      className={`${base} ${misura} ${VARIANTI[variant]} ${className}`.trim()}
      {...props}
    />
  );
});
