import LogoutButton from '@/components/LogoutButton';
import BrandHero from '@/components/BrandHero';

export default async function AccountSospesoPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const scaduto = motivo === 'scaduto';
  const rimosso = motivo === 'collaboratore_rimosso';

  return (
    <div className="pagina-auth">
      <div className="scheda-auth entra text-center">
        <BrandHero titolo="Themis" />
        <p className="mb-1 text-lg font-semibold tracking-tight text-neutral-900">
          {rimosso ? 'Accesso revocato' : scaduto ? 'Abbonamento scaduto' : 'Account sospeso'}
        </p>
        <p className="mb-6 text-sm text-neutral-600">
          {rimosso
            ? 'Non fai più parte di questo studio. Se pensi si tratti di un errore, contatta il titolare dello studio. Per assistenza tecnica: '
            : scaduto
              ? "L'abbonamento del tuo studio è scaduto. Contatta l'amministratore al "
              : "Il tuo account è stato sospeso. Contatta l'amministratore al "}
          <a href="tel:+393286205581" className="text-bordeaux-700 hover:underline">328 620 5581</a>
          {rimosso ? '.' : scaduto ? ' per rinnovarlo.' : ' per riattivarlo.'}
        </p>
        <div className="flex justify-center">
          <LogoutButton className="premi rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-black" />
        </div>
      </div>
    </div>
  );
}
