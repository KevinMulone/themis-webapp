import 'server-only';
import JSZip from 'jszip';

/**
 * Estrae il testo leggibile da un .docx.
 *
 * Stessa tecnica di src/lib/discoverPlaceholders.ts: si concatena il testo
 * dei tag <w:t> paragrafo per paragrafo, perché Word spezza abitualmente
 * una singola parola su più tag e cercare nell'XML grezzo darebbe testo a
 * pezzi.
 *
 * I PDF non passano di qui: si mandano al modello così come sono, perché
 * l'API li legge nativamente e conserva l'impaginazione — utile quando poi
 * si vuole citare la pagina.
 */
export async function testoDaDocx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const parti = [
    'word/document.xml',
    'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
    'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
  ];

  const righe: string[] = [];
  for (const parte of parti) {
    const file = zip.file(parte);
    if (!file) continue;
    const xml = await file.async('string');
    for (const paragrafo of xml.split(/<\/w:p>/)) {
      const testo = [...paragrafo.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((m) => m[1])
        .join('')
        .trim();
      if (testo) righe.push(testo);
    }
  }
  return righe.join('\n');
}

export function estensione(nomeFile: string): string {
  const punto = nomeFile.lastIndexOf('.');
  return punto === -1 ? '' : nomeFile.slice(punto + 1).toLowerCase();
}

/** I formati che sappiamo dare in pasto al modello. */
export function formatoSupportato(nomeFile: string): boolean {
  return ['pdf', 'docx', 'txt', 'md'].includes(estensione(nomeFile));
}
