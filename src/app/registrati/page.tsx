import RegistratiClient from './RegistratiClient';

export const dynamic = 'force-dynamic';

// Registrazioni aperte anche senza i dati legali completi (LEGAL_ENTITY_*,
// PRIVACY_CONTACT_EMAIL): scelta del titolare del 29.10.2026.
export default function RegistratiPage() {
  return <RegistratiClient registrazioneAbilitata />;
}
