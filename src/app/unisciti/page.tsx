import { Suspense } from 'react';
import UniscitiClient from './UniscitiClient';

// Server Component sottile: il "dynamic" qui sotto viene ignorato da Next
// se dichiarato in un file 'use client', ed è il motivo per cui le pagine
// pubbliche di questo progetto sono tutte divise così.
export const dynamic = 'force-dynamic';

export default function UniscitiPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Caricamento...</div>}>
      <UniscitiClient />
    </Suspense>
  );
}
