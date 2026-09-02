import { forwardRef } from 'react';

/**
 * Un campo di modulo: etichetta sopra, l'input sotto, l'aiuto (se c'è)
 * in fondo. È la stessa struttura ripetuta a mano in ogni form dell'app
 * — clienti, pratiche, incarichi, PEC — con margini quasi ma non sempre
 * identici. Qui la struttura è una sola, e chi la usa non decide più
 * quanto spazio lasciare fra l'etichetta e il campo.
 *
 * Non sostituisce campi con logica propria (menù a tendina con ricerca,
 * caselle multiple): per quelli si compone Field.Label + Field.Hint
 * intorno al proprio controllo, invece di reinventare lo stile.
 */
export const Field = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & {
  label: string; hint?: string; error?: string; full?: boolean;
}>(function Field({ label, hint, error, full = false, className = '', ...props }, ref) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <FieldLabel required={props.required}>{label}</FieldLabel>
      <input
        ref={ref}
        className={`w-full rounded-lg border bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white ${
          error ? 'border-red-400' : 'border-transparent'
        } ${className}`.trim()}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
});

export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-xs font-medium text-neutral-600">
      {children}{required && ' *'}
    </label>
  );
}

/** Il testo d'aiuto sotto un campo — "aggiungi nome completo dell'assistito". */
export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-neutral-400">{children}</p>;
}
