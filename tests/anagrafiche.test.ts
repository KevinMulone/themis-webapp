import assert from 'node:assert/strict';
import test from 'node:test';
import {
  codiceFiscaleValido, partitaIvaValida, trovaPossibiliDuplicati, validaAnagrafica,
} from '../src/lib/anagrafiche.ts';

test('valida codice fiscale e partita IVA con le cifre di controllo', () => {
  assert.equal(codiceFiscaleValido('RSSMRA85T10A562G'), true);
  assert.equal(codiceFiscaleValido('RSSMRA85T10A562X'), false);
  assert.equal(partitaIvaValida('00743110157'), true);
  assert.equal(partitaIvaValida('00743110158'), false);
});

test('segnala contatti errati e dati obbligatori', () => {
  const errori = validaAnagrafica({ tipo_soggetto: 'persona_fisica', email: 'non-email', pec: 'pec' });
  assert.deepEqual(errori.map((e) => e.campo), ['nome', 'cognome', 'email', 'pec']);
});

test('individua duplicati per identificativo, contatto o denominazione', () => {
  const esistenti = [{ id: '1', nome: 'Mario', cognome: 'Rossi', codice_fiscale: 'RSSMRA85T10A562G' }];
  assert.equal(trovaPossibiliDuplicati({ nome: 'Mario', cognome: 'Rossi' }, esistenti).length, 1);
  assert.equal(trovaPossibiliDuplicati({ id: '1', codice_fiscale: 'RSSMRA85T10A562G' }, esistenti).length, 0);
});
