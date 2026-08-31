import { redirect } from 'next/navigation';
import { contestoStudio } from '@/lib/studio/contesto';
import CollaboratoriClient from './CollaboratoriClient';

export default async function CollaboratoriPage() {
  // Il controllo vero sta qui e nelle route API, non nel menu: nascondere
  // una voce non impedisce a nessuno di digitare l'indirizzo.
  const contesto = await contestoStudio();
  if (!contesto || contesto.ruolo !== 'titolare') redirect('/dashboard');

  return <CollaboratoriClient />;
}
