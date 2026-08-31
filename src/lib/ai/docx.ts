import 'server-only';
import JSZip from 'jszip';

/**
 * Costruisce un .docx da testo semplice.
 *
 * Si scrive l'OOXML a mano invece di aggiungere una libreria: servono
 * cinque file dentro uno zip, e una dipendenza in più andrebbe mantenuta
 * per sempre in cambio di poco.
 *
 * Il documento esce senza carta intestata, e volutamente: la bozza è una
 * bozza. L'avvocato la rilegge, la corregge e la incolla nel proprio
 * modello — che è anche il momento in cui si accorge di quello che non va.
 * Un file già impaginato come definitivo inviterebbe a firmarlo così.
 */

export type Tipografia = {
  font: string;
  /** Corpo in punti. */
  corpo: number;
  /** Interlinea: 1 = singola, 1,5 = uno e mezzo. */
  interlinea: number;
};

export const TIPOGRAFIA_PREDEFINITA: Tipografia = {
  font: 'Times New Roman', corpo: 12, interlinea: 1.5,
};

function esc(testo: string): string {
  // I caratteri di controllo mandano Word in "file corrotto": si tolgono
  // per codice invece che con una regex, così non finiscono scritti nel
  // sorgente dove nessuno li vedrebbe.
  const pulito = [...testo].filter((c) => (c.codePointAt(0) ?? 32) >= 32).join('');
  return pulito
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Un rigo tutto in maiuscolo è un'intestazione di sezione (FATTO, DIRITTO,
 * P.Q.M.): si centra e si mette in grassetto. È un'euristica, ma nella
 * scrittura forense italiana è una convenzione abbastanza salda da reggere.
 */
function eIntestazione(riga: string): boolean {
  const pulita = riga.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return pulita.length >= 3 && pulita.length <= 60 && pulita === pulita.toUpperCase();
}

export async function docxDaTesto(testo: string, tipografia: Tipografia): Promise<Buffer> {
  const mezziPunti = Math.round(tipografia.corpo * 2);
  const righeInterlinea = Math.round(tipografia.interlinea * 240);

  const paragrafi = testo.split('\n').map((riga) => {
    const contenuto = riga.trim();
    const titolo = eIntestazione(contenuto);
    const pPr = '<w:pPr>'
      + `<w:spacing w:line="${righeInterlinea}" w:lineRule="auto" w:after="${titolo ? 240 : 120}"${titolo ? ' w:before="240"' : ''}/>`
      + `<w:jc w:val="${titolo ? 'center' : 'both'}"/>`
      + '</w:pPr>';
    const rPr = `<w:rPr><w:rFonts w:ascii="${esc(tipografia.font)}" w:hAnsi="${esc(tipografia.font)}"/>`
      + `<w:sz w:val="${mezziPunti}"/>${titolo ? '<w:b/>' : ''}</w:rPr>`;
    if (!contenuto) return `<w:p>${pPr}</w:p>`;
    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(contenuto)}</w:t></w:r></w:p>`;
  }).join('');

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragrafi}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1417" w:right="1134" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
</w:sectPr></w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="${esc(tipografia.font)}" w:hAnsi="${esc(tipografia.font)}"/>
<w:sz w:val="${mezziPunti}"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', document);
  zip.file('word/_rels/document.xml.rels', docRels);
  zip.file('word/styles.xml', styles);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
