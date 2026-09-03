'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Documento = {
  id: string; jidMittente: string; nomeFile: string; ricevutoIl: string;
  clienteId: string | null; matterId: string | null; clienteNome: string | null;
  nomeWhatsapp: string | null; praticaLabel: string | null;
};

function dataIt(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Il reparto fascicoli: tutti i documenti, le foto e i video ricevuti su
 * WhatsApp, raggruppati per assistito — cioè per chi li ha mandati, non
 * per conversazione. Uno stesso cliente che scrive più volte compare una
 * volta sola, con tutti i suoi allegati sotto.
 */
export default function ReparttoFascicoliPage() {
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [caricato, setCaricato] = useState(false);

  const carica = useCallback(async () => {
    const res = await fetch('/api/whatsapp/documenti');
    setCaricato(true);
    if (!res.ok) return;
    const body = await res.json();
    setDocumenti(body.documenti || []);
  }, []);

  useEffect(() => { carica(); }, [carica]);

  // Raggruppati per cliente quando c'è, altrimenti per numero — così un
  // documento non ancora collegato ha comunque un posto dove stare,
  // invece di sparire dalla vista.
  const gruppi = useMemo(() => {
    const mappa = new Map<string, { titolo: string; documenti: Documento[] }>();
    for (const d of documenti) {
      const chiave = d.clienteId || d.jidMittente;
      const titolo = d.clienteNome || d.nomeWhatsapp || d.jidMittente.split('@')[0];
      if (!mappa.has(chiave)) mappa.set(chiave, { titolo, documenti: [] });
      mappa.get(chiave)!.documenti.push(d);
    }
    return [...mappa.values()].sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));
  }, [documenti]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Reparto fascicoli</h1>
        <button type="button" onClick={carica} className="premi text-xs text-neutral-500 hover:text-neutral-700">
          Aggiorna
        </button>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Documenti, foto e video ricevuti su WhatsApp, raggruppati per assistito.
      </p>

      {!caricato ? null : gruppi.length === 0 ? (
        <div className="rounded-2xl bg-neutral-50 p-5">
          <p className="text-sm text-neutral-500">Ancora nessun documento ricevuto su WhatsApp.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {gruppi.map((g) => (
            <div key={g.titolo} className="rounded-2xl bg-neutral-50 p-5">
              <p className="mb-2 font-semibold text-neutral-900">{g.titolo}</p>
              <ul className="space-y-1.5">
                {g.documenti.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2.5 text-sm">
                    <a
                      href={`/api/whatsapp/messaggi/${d.id}/documento`}
                      className="premi text-bordeaux-700 underline decoration-dotted hover:text-bordeaux-800"
                    >
                      📄 {d.nomeFile}
                    </a>
                    <span className="text-xs text-neutral-400">{dataIt(d.ricevutoIl)}</span>
                    {d.praticaLabel ? (
                      <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] text-gold-700">
                        agganciato: {d.praticaLabel}
                      </span>
                    ) : !d.clienteId ? (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                        non ancora collegato
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
