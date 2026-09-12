import assert from 'node:assert/strict';
import test from 'node:test';
import { calcolaDanno, demoltiplicatoreEta, incrementoSofferenza } from '../src/lib/tabelleMilano.ts';
import {
  calcolaMacropermanente,
  calcolaMicropermanente,
  ITT_GIORNALIERO_CIRCOLAZIONE,
  VALORE_PRIMO_PUNTO,
} from '../src/lib/dannoCircolazione.ts';
import { calcolaCompensi, trovaScaglione, TABELLE } from '../src/lib/parametriForensi.ts';
import { calcolaScadenza } from '../src/lib/scadenzeLegali.ts';

function vicino(actual: number, expected: number, epsilon = 0.001) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} non è vicino a ${expected}`);
}

test('Milano 2024 applica sofferenza, età, temporaneo e personalizzazione solo al permanente', () => {
  assert.equal(incrementoSofferenza(1), 25);
  assert.equal(incrementoSofferenza(34), 50);
  assert.equal(demoltiplicatoreEta(41), 0.8);

  const risultato = calcolaDanno({
    eta: 41,
    puntiInvalidita: 10,
    ittGiorni: 2,
    itpTranche: [{ percentuale: 50, giorni: 4 }],
    speseMediche: 100,
    personalizzazionePct: 20,
  });
  vicino(risultato.dannoPermanente, 10 * 2612.4 * 1.26 * 0.8);
  vicino(risultato.dannoTemporaneoTotale, (2 * 115) + (4 * 115 * 0.5));
  vicino(risultato.personalizzazioneImporto, risultato.dannoPermanente * 0.2);
});

test('art. 139 usa i valori 2026 e il coefficiente legale del nono punto', () => {
  const risultato = calcolaMicropermanente({
    eta: 50,
    puntiInvalidita: 9,
    ittGiorni: 1,
    itpTranche: [],
    speseMediche: 0,
    personalizzazionePct: 0,
  });
  vicino(risultato.dannoPermanente, VALORE_PRIMO_PUNTO * 2.3 * 9 * 0.8);
  vicino(risultato.dannoTemporaneoTotale, ITT_GIORNALIERO_CIRCOLAZIONE);
  assert.throws(() => calcolaMicropermanente({
    eta: 30, puntiInvalidita: 10, ittGiorni: 0, itpTranche: [], speseMediche: 0, personalizzazionePct: 0,
  }), /Fuori scala/);
});

test('TUN art. 138 usa coefficienti biologico, età e morale separati', () => {
  const risultato = calcolaMacropermanente({
    eta: 1,
    puntiInvalidita: 10,
    tipoMorale: 'minimo',
    ittGiorni: 0,
    itpTranche: [],
    incrementoMoraleTemporaneaPct: 0,
    speseMediche: 0,
    personalizzazionePct: 0,
  });
  vicino(risultato.dannoBiologicoPermanente, VALORE_PRIMO_PUNTO * 2.75773);
  vicino(risultato.dannoMoralePermanente, risultato.dannoBiologicoPermanente * 0.21);
  vicino(risultato.totalePermanente, risultato.dannoBiologicoPermanente * 1.21);
});

test('parametri forensi rispettano confini di scaglione e ordine IVA/CPA', () => {
  const tabella = TABELLE.find((riga) => riga.id === 'tribunale_ordinario');
  assert.ok(tabella);
  assert.deepEqual(trovaScaglione(5200, tabella.scaglioni), { indice: 1, oltreTetto: false });
  assert.deepEqual(trovaScaglione(5200.01, tabella.scaglioni), { indice: 2, oltreTetto: false });

  const risultato = calcolaCompensi({
    tabella,
    valore: 5200,
    fasiSelezionate: [true, true, true, true],
    variazionePct: 0,
    includiRimborsoForfettario: true,
    includiCpa: true,
    includiIva: true,
  });
  assert.equal(risultato.compensoBase, 2552);
  vicino(risultato.rimborsoForfettario, 382.8);
  vicino(risultato.cpa, 117.392);
  vicino(risultato.iva, 671.48224);
  vicino(risultato.totaleFattura, 3723.67424);
});

test('la sospensione feriale aggiunge 31 giorni solo quando il termine attraversa agosto', () => {
  const senzaAgosto = calcolaScadenza(new Date(2026, 5, 1), 10, true);
  assert.deepEqual(
    [senzaAgosto.getFullYear(), senzaAgosto.getMonth(), senzaAgosto.getDate()],
    [2026, 5, 11],
  );

  const conAgosto = calcolaScadenza(new Date(2026, 6, 15), 40, true);
  assert.deepEqual(
    [conAgosto.getFullYear(), conAgosto.getMonth(), conAgosto.getDate()],
    [2026, 8, 24],
  );

  const sostanziale = calcolaScadenza(new Date(2026, 6, 15), 40, false);
  assert.deepEqual(
    [sostanziale.getFullYear(), sostanziale.getMonth(), sostanziale.getDate()],
    [2026, 7, 24],
  );
});
