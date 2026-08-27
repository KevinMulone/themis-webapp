import LogoutButton from '@/components/LogoutButton';

export default async function AccountSospesoPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const scaduto = motivo === 'scaduto';

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-900">Themis</h1>
        <p className="mb-1 mt-4 font-semibold text-red-700">
          {scaduto ? 'Abbonamento scaduto' : 'Account sospeso'}
        </p>
        <p className="mb-6 text-sm text-neutral-600">
          {scaduto
            ? "L'abbonamento del tuo studio è scaduto. Contatta l'amministratore per rinnovarlo."
            : 'Il tuo account è stato sospeso. Contatta l\'amministratore per riattivarlo.'}
        </p>
        <div className="flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
