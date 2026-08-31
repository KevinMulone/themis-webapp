export type StatoIncarico = 'da_fare' | 'in_corso' | 'completato' | 'annullato';
export type PrioritaIncarico = 'bassa' | 'normale' | 'alta' | 'urgente';

export const STATI_INCARICO: [StatoIncarico, string][] = [
  ['da_fare', 'Da fare'],
  ['in_corso', 'In corso'],
  ['completato', 'Completato'],
  ['annullato', 'Annullato'],
];

export const PRIORITA_INCARICO: [PrioritaIncarico, string][] = [
  ['bassa', 'Bassa'],
  ['normale', 'Normale'],
  ['alta', 'Alta'],
  ['urgente', 'Urgente'],
];

export const STILE_PRIORITA: Record<string, string> = {
  bassa: 'bg-neutral-100 text-neutral-500',
  normale: 'bg-neutral-100 text-neutral-600',
  alta: 'bg-gold-100 text-gold-700',
  urgente: 'bg-red-100 text-red-700',
};

export const STILE_STATO_INCARICO: Record<string, string> = {
  da_fare: 'bg-neutral-100 text-neutral-600',
  in_corso: 'bg-bordeaux-50 text-bordeaux-700',
  completato: 'bg-green-100 text-green-700',
  annullato: 'bg-neutral-100 text-neutral-400',
};

/** Gli stati che contano come "lavoro ancora aperto". */
export const STATI_APERTI: StatoIncarico[] = ['da_fare', 'in_corso'];

export const LABEL_AZIONE_STORICO: Record<string, string> = {
  creato: 'ha creato l’incarico',
  assegnato: 'ha assegnato l’incarico a',
  preso_in_carico: 'ha preso in carico l’incarico',
  passato: 'ha passato l’incarico a',
  completato: 'ha completato l’incarico',
  riaperto: 'ha riaperto l’incarico',
  annullato: 'ha annullato l’incarico',
  modificato: 'ha modificato l’incarico',
};

/** Testo in italiano corrente per una riga di storico. */
export function frasStorico(riga: {
  azione: string; attore_nome: string | null; a_utente_nome: string | null;
}): string {
  const chi = riga.attore_nome || 'Qualcuno';
  const verbo = LABEL_AZIONE_STORICO[riga.azione] || riga.azione;
  const destinatario = (riga.azione === 'assegnato' || riga.azione === 'passato')
    ? ` ${riga.a_utente_nome || '—'}`
    : '';
  return `${chi} ${verbo}${destinatario}`;
}

export function scadenzaLabel(scadenza: string | null, oggiIso: string): string | null {
  if (!scadenza) return null;
  const giorni = Math.round((new Date(scadenza).getTime() - new Date(oggiIso).getTime()) / 86400000);
  if (giorni < 0) return `scaduto da ${Math.abs(giorni)}gg`;
  if (giorni === 0) return 'oggi';
  if (giorni === 1) return 'domani';
  return `tra ${giorni}gg`;
}
