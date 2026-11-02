export function whatsappAbilitato(): boolean {
  return process.env.THEMIS_ENABLE_WHATSAPP === 'true';
}

// La PEC scarica in Themis gli originali di ogni messaggio: con lo storico
// di una casella intera ha riempito lo spazio del piano gratuito di
// Supabase (novembre 2026). Spenta finché non la si riaccende apposta.
export function pecAbilitata(): boolean {
  return process.env.THEMIS_ENABLE_PEC === 'true';
}

export function depositoAbilitato(): boolean {
  return process.env.THEMIS_ENABLE_DEPOSITO === 'true';
}

export function percorsoFunzioneDisabilitata(pathname: string): 'whatsapp' | 'pec' | 'deposito' | null {
  if (!whatsappAbilitato() && (
    pathname === '/whatsapp'
    || pathname.startsWith('/whatsapp/')
    || pathname === '/api/whatsapp'
    || pathname.startsWith('/api/whatsapp/')
    || pathname === '/api/themis/whatsapp'
    || pathname.startsWith('/api/themis/whatsapp-')
  )) return 'whatsapp';

  if (!pecAbilitata() && (
    pathname === '/pec'
    || pathname.startsWith('/pec/')
    || pathname === '/api/pec'
    || pathname.startsWith('/api/pec/')
    || pathname === '/api/themis/pec'
    || pathname === '/api/themis/scadenze'
  )) return 'pec';

  if (!depositoAbilitato() && (
    pathname === '/deposito'
    || pathname.startsWith('/deposito/')
    || /^\/api\/pratiche\/[^/]+\/pacchetto-deposito\/?$/.test(pathname)
  )) return 'deposito';

  return null;
}
