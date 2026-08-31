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
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <BrandHero />
        <p className="mb-1 font-semibold text-red-700">
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
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
