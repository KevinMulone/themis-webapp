import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIMITE_FILE_BYTES, MB, SOGLIA_ALLARME, SOGLIA_AVVISO, SOGLIA_STOP, formattaMB, messaggioFileTroppoGrande,
} from '../src/lib/spazioCostanti.ts';

test('le dimensioni si scrivono in MB o GB, con la virgola', () => {
  assert.equal(formattaMB(0), '0,0 MB');
  assert.equal(formattaMB(5.5 * MB), '5,5 MB');
  assert.equal(formattaMB(250 * MB), '250 MB');
  assert.equal(formattaMB(1024 * MB), '1,00 GB');
});

test('le soglie sono in ordine e sotto il 100%', () => {
  assert.ok(SOGLIA_AVVISO < SOGLIA_ALLARME && SOGLIA_ALLARME < SOGLIA_STOP && SOGLIA_STOP < 1);
});

test('il limite di un file sta sotto quello di Vercel (4,5 MB) e il messaggio dice cosa fare', () => {
  assert.ok(LIMITE_FILE_BYTES <= 4.5 * MB);
  const m = messaggioFileTroppoGrande(6 * MB);
  assert.match(m, /6,0 MB/);
  assert.match(m, /comprimi il PDF/);
});
