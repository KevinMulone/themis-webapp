/**
 * Il riquadro bianco che racchiude ogni sezione: dati pratica, documenti,
 * PEC, incarichi. È già lo stesso ovunque nell'app (bordo neutro, angoli
 * arrotondati, ombra leggerissima) — qui si dà un nome a quella forma,
 * così non si riscrive la stessa stringa di classi in ogni file e un
 * domani, se cambia, cambia in un punto solo.
 */
export function Card({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mb-4 rounded-2xl bg-neutral-50 p-6 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

/** L'intestazione di una Card: titolo a sinistra, azione o stato a destra. */
export function CardHeader({ title, action, hint }: {
  title: string; action?: React.ReactNode; hint?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h2>
        {action}
      </div>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
