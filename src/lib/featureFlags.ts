export function whatsappAbilitato(): boolean {
  return process.env.THEMIS_ENABLE_WHATSAPP === 'true';
}

export function depositoAbilitato(): boolean {
  return process.env.THEMIS_ENABLE_DEPOSITO === 'true';
}

export function percorsoFunzioneDisabilitata(pathname: string): 'whatsapp' | 'deposito' | null {
  if (!whatsappAbilitato() && (
    pathname === '/whatsapp'
    || pathname.startsWith('/whatsapp/')
    || pathname === '/api/whatsapp'
    || pathname.startsWith('/api/whatsapp/')
    || pathname === '/api/themis/whatsapp'
    || pathname.startsWith('/api/themis/whatsapp-')
  )) return 'whatsapp';

  if (!depositoAbilitato() && (
    pathname === '/deposito'
    || pathname.startsWith('/deposito/')
    || /^\/api\/pratiche\/[^/]+\/pacchetto-deposito\/?$/.test(pathname)
  )) return 'deposito';

  return null;
}
