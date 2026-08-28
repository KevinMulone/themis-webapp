import AccediClient from './AccediClient';

// Evita la generazione statica in build: le variabili NEXT_PUBLIC_* di
// Supabase si sono rivelate a volte non disponibili durante la fase di
// export statico su Vercel. Questo export ha effetto solo in un file NON
// marcato 'use client' — per questo il contenuto vero è in AccediClient.
export const dynamic = 'force-dynamic';

export default function AccediPage() {
  return <AccediClient />;
}
