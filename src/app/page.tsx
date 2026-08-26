import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-100 px-4 text-center">
      <h1 className="text-4xl font-bold text-neutral-900">Themis</h1>
      <p className="max-w-md text-neutral-600">Gestione pratiche legali, calendario e generazione atti per studi legali.</p>
      <div className="flex gap-3">
        <Link href="/accedi" className="rounded-md bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-900">
          Accedi
        </Link>
        <Link href="/registrati" className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
          Registra il tuo studio
        </Link>
      </div>
    </div>
  );
}
