// R21 (plan-teknik-v3 §4, review nr. 46): retur efter log ind kun til en sti på konto- eller designer-værten.
// Designerlinket fra Min side (Fable c4): designet + gemt pris og dato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sikkerRetur, loginAdresse, designerLink } from '../src/lib/adresser.mjs';

const KONTO = 'https://konto.neminventar.dk';

test('R21: retur til konto-stier og designer-værten', () => {
  assert.equal(sikkerRetur('/min-side/', KONTO), '/min-side/');
  assert.equal(sikkerRetur('/ordre/?ref=NI-1D078A14', KONTO), '/ordre/?ref=NI-1D078A14');
  assert.equal(sikkerRetur(`${KONTO}/ordre/#hemmelig`, KONTO), '/ordre/', 'fragmentet fjernes');
  assert.equal(sikkerRetur('https://designer.neminventar.dk/designer.html?p=locker#x', KONTO), 'https://designer.neminventar.dk/designer.html?p=locker');
});

test('R21: alt andet afvises', () => {
  for (const x of [
    'https://evil.example/', '//evil.example/min-side/', '/\\evil.example', 'javascript:alert(1)', 'data:text/html,x',
    'https://konto.neminventar.dk.evil.example/', 'https://user:pw@konto.neminventar.dk/', 'http://designer.neminventar.dk/',
    'https://neminventar.dk/', '/min-side/\n', '', null, 42, 'x'.repeat(2001),
  ]) {
    assert.equal(sikkerRetur(x, KONTO), null, String(x).slice(0, 60));
  }
});

test('log ind-adressen bærer retur og "logget ud" som query', () => {
  assert.equal(loginAdresse('/min-side/'), `/?retur=${encodeURIComponent('/min-side/')}`);
  assert.equal(loginAdresse('/en/min-side/', { sprog: 'en', udloebet: true }), `/en/?retur=${encodeURIComponent('/en/min-side/')}&udloebet=1`);
  assert.equal(loginAdresse(null), '/');
});

test('Åbn i designeren: designet + gemt pris og dato; kopiér link: kun designet', () => {
  const d = 'https://designer.neminventar.dk/designer.html';
  const u = new URL(designerLink(d, { produkt: 'hoejskab', t: 'eyJiIjoxODB9', prisOere: 2148750, dato: '2026-11-02' }));
  assert.equal(u.searchParams.get('p'), 'hoejskab');
  assert.equal(u.searchParams.get('t'), 'eyJiIjoxODB9');
  assert.equal(u.searchParams.get('gemt_pris'), '2148750');
  assert.equal(u.searchParams.get('gemt_dato'), '2026-11-02');
  const k = new URL(designerLink(d, { produkt: 'hoejskab', t: 'eyJiIjoxODB9', medGemt: false, sprog: 'en' }));
  assert.equal(k.searchParams.has('gemt_pris'), false);
  assert.equal(k.searchParams.get('lang'), 'en');
  assert.equal(designerLink(d, { permalink: 'https://evil.example/?p=x' }), null, 'et fremmed permalink bliver ikke et link');
  assert.equal(designerLink(d, { produkt: 'hoejskab', t: null }), null);
});
