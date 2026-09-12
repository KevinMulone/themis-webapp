import assert from 'node:assert/strict';
import test from 'node:test';
import { classificaEvento } from '../src/lib/calendario/classifica.ts';

test('classifica solo eventi con indizi giuridici chiari', () => {
  assert.equal(classificaEvento('Udienza di discussione'), 'udienza');
  assert.equal(classificaEvento('Deposito memoria 183'), 'termine_processuale');
  assert.equal(classificaEvento('Appuntamento con il cliente'), 'appuntamento');
  assert.equal(classificaEvento('Pranzo'), 'altro');
});
