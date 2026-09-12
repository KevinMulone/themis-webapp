import assert from 'node:assert/strict';
import test from 'node:test';
import { percorsoFunzioneDisabilitata } from '../src/lib/featureFlags.ts';

test('WhatsApp e Deposito sono chiusi per impostazione predefinita, pagine e API comprese', () => {
  const whatsappPrima = process.env.THEMIS_ENABLE_WHATSAPP;
  const depositoPrima = process.env.THEMIS_ENABLE_DEPOSITO;
  delete process.env.THEMIS_ENABLE_WHATSAPP;
  delete process.env.THEMIS_ENABLE_DEPOSITO;
  try {
    assert.equal(percorsoFunzioneDisabilitata('/whatsapp'), 'whatsapp');
    assert.equal(percorsoFunzioneDisabilitata('/api/whatsapp/webhook'), 'whatsapp');
    assert.equal(percorsoFunzioneDisabilitata('/api/themis/whatsapp-scadenze'), 'whatsapp');
    assert.equal(percorsoFunzioneDisabilitata('/deposito'), 'deposito');
    assert.equal(percorsoFunzioneDisabilitata('/api/pratiche/abc/pacchetto-deposito'), 'deposito');
    assert.equal(percorsoFunzioneDisabilitata('/api/themis/domanda'), null);
  } finally {
    if (whatsappPrima === undefined) delete process.env.THEMIS_ENABLE_WHATSAPP;
    else process.env.THEMIS_ENABLE_WHATSAPP = whatsappPrima;
    if (depositoPrima === undefined) delete process.env.THEMIS_ENABLE_DEPOSITO;
    else process.env.THEMIS_ENABLE_DEPOSITO = depositoPrima;
  }
});

test('i feature flag riaprono soltanto la funzione richiesta', () => {
  const whatsappPrima = process.env.THEMIS_ENABLE_WHATSAPP;
  const depositoPrima = process.env.THEMIS_ENABLE_DEPOSITO;
  process.env.THEMIS_ENABLE_WHATSAPP = 'true';
  delete process.env.THEMIS_ENABLE_DEPOSITO;
  try {
    assert.equal(percorsoFunzioneDisabilitata('/api/whatsapp/webhook'), null);
    assert.equal(percorsoFunzioneDisabilitata('/deposito'), 'deposito');
  } finally {
    if (whatsappPrima === undefined) delete process.env.THEMIS_ENABLE_WHATSAPP;
    else process.env.THEMIS_ENABLE_WHATSAPP = whatsappPrima;
    if (depositoPrima === undefined) delete process.env.THEMIS_ENABLE_DEPOSITO;
    else process.env.THEMIS_ENABLE_DEPOSITO = depositoPrima;
  }
});
