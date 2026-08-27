import JSZip from 'jszip';

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Estrae i placeholder {{...}} da un .docx, includendo anche quelli che
 * Word ha spezzato su più tag <w:t> (cosa che fa spessissimo): per questo si
 * ripulisce prima ogni tag XML dal testo di ciascun paragrafo, non si cerca
 * il pattern nell'XML grezzo. */
export async function discoverPlaceholders(docxBuffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const parts = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
    'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'];
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const part of parts) {
    const file = zip.file(part);
    if (!file) continue;
    const xml = await file.async('string');
    // Un paragrafo <w:p>...</w:p> può spezzare {{chiave}} su più <w:t>: si
    // concatena il testo di ogni paragrafo prima di cercare il pattern.
    const paragraphs = xml.split(/<\/w:p>/);
    for (const para of paragraphs) {
      const texts = [...para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
      const joined = texts.join('');
      for (const match of joined.matchAll(PLACEHOLDER_PATTERN)) {
        const key = match[1];
        if (!seen.has(key)) {
          seen.add(key);
          ordered.push(key);
        }
      }
    }
  }
  return ordered;
}
