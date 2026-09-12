import RegistratiClient from './RegistratiClient';
import { identitaLegale } from '@/lib/legal';

export const dynamic = 'force-dynamic';

export default function RegistratiPage() {
  return <RegistratiClient registrazioneAbilitata={identitaLegale().completa} />;
}
