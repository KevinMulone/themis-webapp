import { LIMITE_FILE_BYTES, messaggioFileTroppoGrande } from '@/lib/spazioCostanti';

/** Sopra questa dimensione una foto viene rimpicciolita prima di caricarla. */
const FOTO_DA_COMPRIMERE = 700 * 1024;
const LATO_MASSIMO = 2200;
const QUALITA = 0.82;

/**
 * Prepara un file prima di mandarlo a Themis: le foto (jpg, png, webp) del telefono, che pesano 3-8 MB,
 * si rimpiccioliscono a una dimensione ancora ben leggibile (lato lungo 2200 px, jpeg); gli altri file,
 * PDF compresi, si lasciano com'erano. Se il risultato supera il massimo consentito si dà un errore chiaro.
 * Se la compressione non riesce (formato non leggibile dal browser) si tiene l'originale.
 */
export async function preparaFile(file: File): Promise<{ file: File } | { errore: string }> {
  let pronto = file;
  if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size > FOTO_DA_COMPRIMERE) {
    try {
      const immagine = await createImageBitmap(file);
      const scala = Math.min(1, LATO_MASSIMO / Math.max(immagine.width, immagine.height));
      const tela = document.createElement('canvas');
      tela.width = Math.round(immagine.width * scala);
      tela.height = Math.round(immagine.height * scala);
      const contesto = tela.getContext('2d');
      if (contesto) {
        contesto.fillStyle = '#fff'; // il jpeg non ha trasparenza: lo sfondo di un png trasparente diventa bianco
        contesto.fillRect(0, 0, tela.width, tela.height);
        contesto.drawImage(immagine, 0, 0, tela.width, tela.height);
        const blob: Blob | null = await new Promise((ok) => tela.toBlob(ok, 'image/jpeg', QUALITA));
        if (blob && blob.size < file.size) {
          pronto = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
        }
      }
    } catch {
      // formato non leggibile dal browser: si lascia l'originale
    }
  }
  if (pronto.size > LIMITE_FILE_BYTES) return { errore: messaggioFileTroppoGrande(pronto.size) };
  return { file: pronto };
}
