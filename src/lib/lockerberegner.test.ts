// node --test src/lib/lockerberegner.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beregn, laesValg, skrivValg, designerUrl, vaegBreddeCm, opstilling, rund100, type Data } from './lockerberegner.ts';

const data: Data = {
  rum: {
    elev: { b: 30, h: 40, d: 40, raekker: 3, soejler: 6 },
    standard: { b: 30, h: 50, d: 45, raekker: 2, soejler: 6 },
    hoej: { b: 30, h: 90, d: 50, raekker: 2, soejler: 6 },
    personale: { b: 40, h: 90, d: 50, raekker: 2, soejler: 4 },
  },
  vaeg: { 'standard/kryds': { tyk: 0.018, plade: 2.44, fuge: 0.002 }, 'elev/kryds': { tyk: 0.018, plade: 2.44, fuge: 0.002 } },
  priser: { 'standard/kryds/noegle': { inkl: 2875, ex: 2300 }, 'elev/kryds/kode': { inkl: 2800, ex: 2240 } },
};
const decode = (url: string) => JSON.parse(Buffer.from(url.split('&t=')[1], 'base64url').toString('utf8'));

test('antal rum rundes op, så søjlerne fyldes', () => {
  const r = beregn({ brugere: 24, rum: 'elev', mat: 'kryds', laas: 'kode' }, data)!;
  assert.equal(r.soejler, 8); assert.equal(r.raekker, 3); assert.equal(r.antalRum, 24);
  const s = beregn({ brugere: 25, rum: 'elev', mat: 'kryds', laas: 'kode' }, data)!;
  assert.equal(s.soejler, 9); assert.equal(s.antalRum, 27);
  assert.equal(opstilling(8, 3), '8 søjler i 3 rækker');
  assert.equal(opstilling(1, 2), '1 søjle i 2 rækker');
});

test('prisen er pris pr. rum × antal rum', () => {
  const r = beregn({ brugere: 25, rum: 'standard', mat: 'kryds', laas: 'noegle' }, data)!;
  assert.equal(r.antalRum, 26);
  assert.equal(r.inkl, 2875 * 26); assert.equal(r.ex, 2300 * 26);
  assert.equal(beregn({ brugere: 10, rum: 'hoej', mat: 'birk', laas: 'kode' }, data), null);
  assert.equal(rund100(74750), 74800);
});

test('linket koder den rigtige tilstand', () => {
  const r = beregn({ brugere: 24, rum: 'elev', mat: 'kryds', laas: 'kode' }, data)!;
  const url = designerUrl(r.tilstand);
  assert.match(url, /^https:\/\/designer\.neminventar\.dk\/designer\.html\?p=locker&t=/);
  assert.deepEqual(decode(url), { soejler: 8, raekker: 3, b: 30, h: 40, d: 40, mat: 'kryds', laas: 'kode', haengsel: 'institution' });
});

test('væglængden følger designerens formel (elementer højst én plade lange)', () => {
  // 8 søjler à 30 cm: kmax = ⌊(2,44 − 0,018) ÷ 0,30⌋ = 8 → ét element: 240 + 1,8 = 241,8 cm
  assert.equal(vaegBreddeCm(8, 30, data.vaeg['standard/kryds']), 242);
  // 9 søjler: to elementer: 270 + 3,6 + 0,2 = 273,8 cm
  assert.equal(vaegBreddeCm(9, 30, data.vaeg['standard/kryds']), 274);
  assert.equal(beregn({ brugere: 18, rum: 'standard', mat: 'kryds', laas: 'noegle' }, data)!.elementer, 2);
});

test('adressen: valgene læses og skrives, ukendt falder tilbage til standarden', () => {
  const v = laesValg('?brugere=40&rum=elev&mat=birk&laas=kode');
  assert.deepEqual(v, { brugere: 40, rum: 'elev', mat: 'birk', laas: 'kode' });
  assert.deepEqual(laesValg(skrivValg(v)), v);
  assert.deepEqual(laesValg('?brugere=-3&rum=x&mat=y&laas=z'), { brugere: 24, rum: 'standard', mat: 'kryds', laas: 'noegle' });
  assert.equal(laesValg('?brugere=999999').brugere, 5000);
});
