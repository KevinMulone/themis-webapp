'use client';

export type Credito = {
  usatoMillesimi: number;
  totaleMillesimi: number;
  residuoMillesimi: number;
  esaurito: boolean;
};

function importo(millesimi: number): string {
  return `${(millesimi / 1000).toFixed(2).replace('.', ',')} $`;
}

/**
 * Il credito del mese, in percentuale.
 *
 * La percentuale sta davanti e la cifra dietro, e non è un dettaglio di
 * gusto: «12,40 $ di 30,00 $» richiede un calcolo, «41% usato» no. Chi
 * guarda vuole sapere quanto gli resta, non fare una divisione.
 */
export default function CreditoBarra({ credito }: { credito: Credito | null }) {
  if (!credito || credito.totaleMillesimi <= 0) return null;

  const usatoPct = Math.min(100, Math.round((credito.usatoMillesimi / credito.totaleMillesimi) * 100));
  const critico = usatoPct >= 90;
  const attenzione = usatoPct >= 70 && !critico;

  const colore = critico ? 'bg-red-500' : attenzione ? 'bg-gold-500' : 'bg-bordeaux-600';
  const testo = critico ? 'text-red-600' : attenzione ? 'text-gold-700' : 'text-neutral-500';

  return (
    <div className="min-w-40">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={`text-xs font-medium ${testo}`}>
          {usatoPct}% del credito mensile
        </span>
        <span className="text-xs text-neutral-400">
          restano {importo(credito.residuoMillesimi)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full rounded-full transition-all ${colore}`} style={{ width: `${usatoPct}%` }} />
      </div>
    </div>
  );
}
