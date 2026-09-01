'use client';

/**
 * Solo percentuali: le cifre in denaro non escono dal server (vedi
 * creditoPubblico in lib/ai/credito.ts). Qui non c'è nulla da nascondere,
 * perché non c'è nulla da mostrare.
 */
export type Credito = { usatoPct: number; residuoPct: number; esaurito: boolean };

export default function CreditoBarra({ credito }: { credito: Credito | null }) {
  if (!credito) return null;

  const usato = Math.max(0, Math.min(100, credito.usatoPct));
  const critico = usato >= 90;
  const attenzione = usato >= 70 && !critico;

  const barra = critico ? 'bg-red-500' : attenzione ? 'bg-gold-500' : 'bg-bordeaux-600';
  const testo = critico ? 'text-red-600' : attenzione ? 'text-gold-700' : 'text-neutral-500';

  return (
    <div className="min-w-40">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={`text-xs font-medium ${testo}`}>Themis disponibile</span>
        <span className={`text-xs font-semibold ${testo}`}>{credito.residuoPct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full transition-all ${barra}`}
          style={{ width: `${usato}%` }}
        />
      </div>
      {critico && (
        <p className="mt-1 text-[11px] text-red-600">
          {credito.esaurito ? 'Esaurito fino al mese prossimo.' : 'Quasi esaurito per questo mese.'}
        </p>
      )}
    </div>
  );
}
