import BrandHero from '@/components/BrandHero';

export default function PoliticaRimborsiPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <BrandHero />
      <h1 className="mb-6 text-center text-2xl font-display font-semibold text-neutral-900">
        Politica di rimborso
      </h1>

      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-8 text-sm leading-relaxed text-neutral-700 shadow-sm">
        <p>
          Themis è un servizio destinato a professionisti (studi legali e avvocati) che lo utilizzano per
          l&apos;esercizio della propria attività. I clienti di Themis non sono quindi &quot;consumatori&quot; ai sensi
          del Codice del Consumo, e il diritto di recesso di 14 giorni previsto per gli acquisti a distanza dei
          consumatori privati non si applica automaticamente a questo rapporto.
        </p>
        <p>
          Nonostante ciò, offriamo volontariamente la seguente garanzia di rimborso.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Finestra di 4 giorni</h2>
        <p>
          Chi sottoscrive per la prima volta un abbonamento a pagamento può richiedere il rimborso integrale del
          primo pagamento entro <strong>4 giorni di calendario</strong> dalla data della prima attivazione, senza
          dover fornire alcuna motivazione.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Come richiederlo</h2>
        <p>
          La richiesta si effettua dal proprio account, in <strong>Impostazioni → Abbonamento</strong>, tramite il
          pulsante &quot;Chiedi il rimborso&quot; — visibile solo entro la finestra dei 4 giorni e solo una volta.
          Riceveremo la richiesta e ti contatteremo per completare il rimborso.
        </p>
        <p>
          <strong>L&apos;invio della richiesta sospende immediatamente l&apos;accesso all&apos;account</strong>: da
          quel momento non è più possibile utilizzare Themis, in attesa che il rimborso venga elaborato. Per
          tornare a usare il servizio sarà necessario sottoscrivere un nuovo abbonamento.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Cosa non è coperto</h2>
        <p>
          La garanzia riguarda esclusivamente il primo pagamento del primo abbonamento sottoscritto. Non si
          applica ai rinnovi successivi (mensili, semestrali o annuali), né a eventuali cambi di piano o nuovi
          abbonamenti sottoscritti in seguito. Trascorsi i 4 giorni, o se la richiesta è già stata inviata in
          precedenza, non è più possibile richiedere il rimborso tramite questa procedura.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Disdetta in qualsiasi momento</h2>
        <p>
          Al di fuori di questa garanzia, resta sempre possibile disdire l&apos;abbonamento in qualunque momento
          dal portale di gestione (raggiungibile dalla stessa sezione Impostazioni): la disdetta evita ulteriori
          rinnovi, ma non comporta il rimborso del periodo già pagato e in corso.
        </p>
      </div>
    </div>
  );
}
