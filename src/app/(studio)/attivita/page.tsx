import { redirect } from 'next/navigation';
import { contestoStudio } from '@/lib/studio/contesto';
import AttivitaClient from './AttivitaClient';

export default async function AttivitaPage() {
  // Riservata al titolare: è la vista d'insieme su cosa fanno i
  // collaboratori. Il controllo sta qui, non solo nel menu.
  const contesto = await contestoStudio();
  if (!contesto || contesto.ruolo !== 'titolare') redirect('/dashboard');

  return <AttivitaClient />;
}
