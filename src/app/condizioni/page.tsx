import BrandHero from '@/components/BrandHero';
import { identitaLegale } from '@/lib/legal';

export default function CondizioniPage() {
  const identita = identitaLegale();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <BrandHero />
      <h1 className="mb-2 text-center font-display text-2xl font-semibold text-neutral-900">Condizioni del servizio</h1>
      <p className="mb-6 text-center text-xs text-neutral-500">Versione del 12 settembre 2026</p>
      <div className="space-y-5 rounded-xl bg-neutral-50 p-8 text-sm leading-relaxed text-neutral-700">
        {!identita.completa && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            Documento in attesa dei dati identificativi del fornitore. Le nuove registrazioni sono sospese.
          </p>
        )}
        <section>
          <h2 className="font-semibold text-neutral-900">Fornitore e oggetto</h2>
          <p className="mt-2">
            {identita.completa ? `${identita.denominazione}, P. IVA ${identita.partitaIva}, con sede in ${identita.sede},` : 'Il fornitore di Themis'}
            {' '}mette a disposizione un software gestionale per studi legali. Themis supporta l’attività professionale,
            ma non sostituisce il controllo, le decisioni, la firma o la responsabilità dell’avvocato.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-neutral-900">Account e sicurezza</h2>
          <p className="mt-2">Lo studio è responsabile della correttezza dei dati inseriti, della custodia delle credenziali e dell’assegnazione degli accessi ai collaboratori. Deve comunicare tempestivamente accessi sospetti o non autorizzati.</p>
        </section>
        <section>
          <h2 className="font-semibold text-neutral-900">Funzioni professionali e intelligenza artificiale</h2>
          <p className="mt-2">Calcoli, scadenze, bozze e risposte generate sono strumenti di supporto e devono essere verificati dal professionista prima dell’uso. L’utente sceglie quali documenti sottoporre all’assistente.</p>
        </section>
        <section>
          <h2 className="font-semibold text-neutral-900">Piani, rinnovo e cessazione</h2>
          <p className="mt-2">Prezzo, durata, rinnovo e limiti del piano sono mostrati prima del pagamento. Disdetta e richieste di rimborso seguono le condizioni presentate al momento dell’acquisto e la politica rimborsi pubblicata sul sito.</p>
        </section>
        <section>
          <h2 className="font-semibold text-neutral-900">Dati alla cessazione</h2>
          <p className="mt-2">Prima della cessazione lo studio può richiedere l’esportazione dei propri dati. Cancellazione, restituzione e tempi di conservazione sono disciplinati dall’informativa privacy e dall’accordo sul trattamento dei dati applicabile al rapporto.</p>
        </section>
        <section>
          <h2 className="font-semibold text-neutral-900">Contatti</h2>
          <p className="mt-2">{identita.completa ? <a className="underline" href={`mailto:${identita.emailPrivacy}`}>{identita.emailPrivacy}</a> : 'I contatti saranno pubblicati prima della riapertura delle registrazioni.'}</p>
        </section>
      </div>
    </div>
  );
}
