'use client';

import { createContext, useContext } from 'react';
import type { ContestoStudioClient } from './tipi';

const Contesto = createContext<ContestoStudioClient | null>(null);

/**
 * Rende disponibile alle pagine client lo studio di appartenenza, risolto
 * una sola volta dal layout (Server Component).
 *
 * Non è solo comodità: prima di questo, ogni gestore di ogni pagina client
 * chiamava `supabase.auth.getUser()` per conto suo — una chiamata di rete
 * a Supabase ogni volta, solo per riscoprire un dato che il server aveva
 * già. Qui il valore arriva serializzato con la pagina, a costo zero.
 */
export function StudioProvider({
  valore,
  children,
}: {
  valore: ContestoStudioClient;
  children: React.ReactNode;
}) {
  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useStudio(): ContestoStudioClient {
  const valore = useContext(Contesto);
  if (!valore) {
    throw new Error('useStudio va usato dentro <StudioProvider> (layout dell\'area studio)');
  }
  return valore;
}
