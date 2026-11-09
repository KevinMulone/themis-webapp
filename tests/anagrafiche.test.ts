import assert from 'node:assert/strict';
import test from 'node:test';
import {
  codiceFiscaleValido, erroreCodiceFiscale, normalizzaCodiceFiscale, partitaIvaValida, trovaPossibiliDuplicati, validaAnagrafica,
} from '../src/lib/anagrafiche.ts';

test('valida codice fiscale e partita IVA con le cifre di controllo', () => {
  assert.equal(codiceFiscaleValido('RSSMRA85T10A562S'), true);
  assert.equal(codiceFiscaleValido('RSSMRA85T10A562X'), false);
  assert.equal(codiceFiscaleValido('rssmra85t10a562g'), false);
  assert.equal(partitaIvaValida('00743110157'), true);
  assert.equal(partitaIvaValida('00743110158'), false);
});

test('segnala contatti errati e dati obbligatori', () => {
  const errori = validaAnagrafica({ tipo_soggetto: 'persona_fisica', email: 'non-email', pec: 'pec' });
  assert.deepEqual(errori.map((e) => e.campo), ['nome', 'cognome', 'email', 'pec']);
});

test('individua duplicati per identificativo, contatto o denominazione', () => {
  const esistenti = [{ id: '1', nome: 'Mario', cognome: 'Rossi', codice_fiscale: 'RSSMRA85T10A562S' }];
  assert.equal(trovaPossibiliDuplicati({ nome: 'Mario', cognome: 'Rossi' }, esistenti).length, 1);
  assert.equal(trovaPossibiliDuplicati({ id: '1', codice_fiscale: 'RSSMRA85T10A562S' }, esistenti).length, 0);
});

test('corregge lo scambio O/0 nel codice fiscale, ma solo se poi è valido', () => {
  // codici inventati: nessun dato di clienti reali nei test
  assert.equal(normalizzaCodiceFiscale('vrdgnn80a02h5010'), 'VRDGNN80A02H501O');
  assert.equal(codiceFiscaleValido('VRDGNN80A02H501O'), true);
  // errore diverso da O/0: resta com'è, e il controllo lo segnala
  assert.equal(normalizzaCodiceFiscale('VRDGNN80A02H501X'), 'VRDGNN80A02H501X');
  assert.equal(codiceFiscaleValido('VRDGNN80A02H501X'), false);
});

test('il messaggio dice quale lettera di controllo era attesa', () => {
  assert.match(erroreCodiceFiscale('VRDGNN80A02H501X'), /dovrebbe essere O/);
  assert.match(erroreCodiceFiscale('123'), /16 caratteri/);
});

test('condomini ed enti: codice fiscale di 11 cifre, anche senza partita IVA', () => {
  assert.equal(codiceFiscaleValido('00743110157'), true);
  assert.equal(codiceFiscaleValido('00743110158'), false);
  const ok = validaAnagrafica({ tipo_soggetto: 'persona_giuridica', ragione_sociale: 'Condominio Prova', codice_fiscale: '00743110157' });
  assert.deepEqual(ok, []);
  const ko = validaAnagrafica({ tipo_soggetto: 'persona_giuridica', ragione_sociale: 'Condominio Prova', codice_fiscale: '00743110158' });
  assert.deepEqual(ko.map((e) => e.campo), ['codice_fiscale']);
});
