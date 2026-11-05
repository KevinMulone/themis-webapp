export const TIPI_PRATICA: [string, string][] = [
  ['atp_invalidita', 'ATP invalidità/handicap'],
  ['sinistro', 'Sinistro'],
  ['ricorso_inps', 'Ricorso amministrativo INPS'],
  ['causa_civile', 'Causa civile'],
  ['successione', 'Successione'],
  ['lavoro', 'Diritto del lavoro'],
  ['penale', 'Penale'],
  ['immigrazione', 'Immigrazione/protezione internazionale'],
  ['sovraindebitamento', 'Sovraindebitamento'],
  ['mediazione_condominiale', 'Mediazione condominiale'],
  ['altro', 'Altro'],
];

export const STATI_PRATICA: [string, string][] = [
  ['aperta', 'Aperta'],
  ['in_corso', 'In corso'],
  ['sospesa', 'Sospesa'],
  ['chiusa_vinta', 'Chiusa - vinta'],
  ['chiusa_persa', 'Chiusa - persa'],
  ['chiusa_transatta', 'Chiusa - transatta'],
  ['archiviata', 'Archiviata'],
];

export const TIPI_SINISTRO: [string, string][] = [
  ['stradale', 'Stradale'],
  ['domestico', 'Domestico'],
  ['lavoro', 'Lavoro'],
  ['altro', 'Altro'],
];

export const STATI_NEGOZIAZIONE: [string, string][] = [
  ['non_avviata', 'Non avviata'],
  ['negoziazione_assistita', 'Negoziazione assistita'],
  ['trattativa_diretta', 'Trattativa diretta'],
  ['contenzioso', 'Contenzioso'],
  ['definito', 'Definito'],
];

export const TIPI_EVENTO: [string, string][] = [
  ['udienza', 'Udienza'],
  ['scadenza', 'Scadenza'],
  ['appuntamento', 'Appuntamento'],
  ['termine_processuale', 'Termine processuale'],
  ['ferie', 'Ferie'],
  ['altro', 'Altro'],
];

export const TIPI_SOGGETTO: [string, string][] = [
  ['persona_fisica', 'Persona fisica'],
  ['persona_giuridica', 'Persona giuridica'],
];

// Di chi è il numero di telefono del cliente (vuoto = del cliente stesso).
export const TELEFONO_DI: [string, string][] = [
  ['madre', 'Madre'],
  ['padre', 'Padre'],
  ['figlio', 'Figlio'],
  ['figlia', 'Figlia'],
  ['coniuge', 'Coniuge / convivente'],
  ['fratello', 'Fratello'],
  ['sorella', 'Sorella'],
  ['altro_familiare', 'Altro familiare'],
  ['tutore', 'Tutore / amministratore di sostegno'],
  ['caregiver', 'Badante / caregiver'],
  ['altro', 'Altra persona'],
];

export const METODI_PAGAMENTO: [string, string][] = [
  ['contanti', 'Contanti'],
  ['carta', 'Carta'],
  ['bonifico', 'Bonifico'],
  ['gratuito_patrocinio', 'Gratuito patrocinio'],
];

export function labelFromOptions(options: [string, string][], value: string | null | undefined): string {
  const found = options.find(([v]) => v === value);
  return found ? found[1] : value || '';
}

export function clientLabel(c: { tipo_soggetto?: string; ragione_sociale?: string | null; nome?: string | null; cognome?: string | null } | null | undefined): string {
  if (!c) return '';
  if (c.tipo_soggetto === 'persona_giuridica') return c.ragione_sociale || '';
  return `${c.cognome || ''} ${c.nome || ''}`.trim();
}

export function formatDateIt(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
