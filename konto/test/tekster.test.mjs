// Tekstkataloget (konto/tekster/*.json): ordret fra Fable runde 3 d1–d4 og runde 4, samme nøgler på dansk og engelsk, ingen
// forbudte ord (kernens ordvagt = forbudslisten fra scripts/lint-web-copy.py + kontrakter §0), og TODO-TEKST kun dér,
// hvor Fable mangler en tekst (konto/tekster/mangler.json). Ligger Fable-filen ved siden af (ni-apps-worktree'et),
// sammenlignes hver tekst med Fables tabel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ordvagt } from '../vendor/webordre/ordvagt.mjs';

const MAPPE = fileURLToPath(new URL('../tekster/', import.meta.url));
const laes = (f) => JSON.parse(readFileSync(path.join(MAPPE, f), 'utf8'));
const DA = laes('da.json');
const EN = laes('en.json');
const ORDRE = laes('ordre.da.json');
const MANGLER = laes('mangler.json').mangler;

// Fable: best.kunDansk findes kun på engelsk ("(ingen)" på dansk)
const TOM_PAA_DANSK = new Set(['best.kunDansk']);
// Ordvagten er skrevet til dansk fri tekst; "quote" er det rigtige engelske ord for "tilbud" i Fables egne tekster
const ORDVAGT_UNDTAGET = new Map([['en:login.noteLead', 'quote'], ['en:best.tomHjaelp', 'quote']]);

const alle = () => [
  ...Object.entries(DA).map(([k, v]) => ['da', k, v]),
  ...Object.entries(EN).map(([k, v]) => ['en', k, v]),
  ...Object.entries(ORDRE).map(([k, v]) => ['da', k, v]),
];
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('samme nøgler på dansk og engelsk (log ind og Min side)', () => {
  assert.deepEqual(Object.keys(DA).sort(), Object.keys(EN).sort());
});

test('ordresidens tekster er kun danske (Fable d4) og skygger ikke for andre nøgler', () => {
  for (const k of Object.keys(ORDRE)) assert.ok(!Object.hasOwn(DA, k), `${k} står to steder`);
});

test('hver tekst er en ikke-tom streng med de samme pladsholdere på begge sprog', () => {
  for (const [sp, k, v] of alle()) {
    assert.equal(typeof v, 'string', `${sp}:${k}`);
    if (!(sp === 'da' && TOM_PAA_DANSK.has(k))) assert.ok(v.trim().length > 0, `${sp}:${k} er tom`);
    assert.equal(v, v.trim(), `${sp}:${k} har mellemrum i enden`);
  }
  for (const k of Object.keys(DA)) {
    if (TOM_PAA_DANSK.has(k) || /TODO-TEKST/.test(DA[k] + EN[k])) continue;
    assert.deepEqual(vars(DA[k]), vars(EN[k]), `pladsholdere i ${k}`);
  }
});

test('TODO-TEKST kun dér, hvor Fable mangler teksten (mangler.json), og i formen TODO-TEKST:<nøgle>', () => {
  const todo = new Set();
  for (const [sp, k, v] of alle()) {
    if (!v.includes('TODO-TEKST')) continue;
    assert.equal(v, `TODO-TEKST:${k}`, `${sp}:${k}`);
    assert.ok(Object.hasOwn(MANGLER, `${sp}:${k}`), `${sp}:${k} er TODO, men står ikke i mangler.json`);
    todo.add(`${sp}:${k}`);
  }
  for (const k of Object.keys(MANGLER)) assert.ok(todo.has(k), `${k} står i mangler.json, men har fået tekst — fjern den fra listen`);
});

// Den egentlige port: hver manglende tekst er en fejl, indtil Fable har skrevet den. Meldes som TODO her (så suiten
// kan køre grønt under udviklingen); `npm run test:konto-udgiv` fejler hårdt, så længe én er tilbage.
for (const [noegle, hvorfor] of Object.entries(MANGLER)) {
  test(`mangler tekst fra Fable: ${noegle}`, { todo: hvorfor }, () => {
    const [sp, k] = noegle.split(/:(.*)/s);
    const v = (sp === 'en' ? EN : { ...DA, ...ORDRE })[k];
    assert.ok(!String(v).includes('TODO-TEKST'), `${noegle}: ${v}`);
  });
}

test('forbudslisten: intet produktionssted, mærkenavn, mål i mm, internt ord eller transport/told (kontrakter §0)', () => {
  for (const [sp, k, v] of alle()) {
    if (v.includes('TODO-TEKST')) continue;
    const fund = ordvagt(v);
    if (fund && ORDVAGT_UNDTAGET.get(`${sp}:${k}`) === fund.ord.toLowerCase()) continue;
    assert.equal(fund, null, `${sp}:${k}: "${fund?.ord}" (${fund?.grund})`);
  }
});

test('kunden ser kun tilbud@ og vores ene telefonnummer; "leverer", aldrig "Forventet"', () => {
  for (const [sp, k, v] of alle()) {
    assert.ok(!/kontakt@|konto@|js@/.test(v), `${sp}:${k}`);
    for (const tlf of v.match(/\+45[\d ]+\d/g) ?? []) assert.equal(tlf, '+45 42 42 26 84', `${sp}:${k}`);
    assert.ok(!/Forventet|Expected delivery/i.test(v), `${sp}:${k}`);
  }
});

// ---------- ordret mod Fable runde 3 ----------
const FABLE = [
  process.env.FABLE_RUNDE3,
  path.resolve(fileURLToPath(new URL('../../', import.meta.url)), '../ni-apps-minside/docs/superpowers/specs/2026-11-12-min-side/fable-runde3.md'),
  'C:/dev/ni-apps-minside/docs/superpowers/specs/2026-11-12-min-side/fable-runde3.md',
].find((f) => f && existsSync(f));

// d4-nøgler, siden ikke slår op i kataloget: kernen (vendor/webordre/tilstand.mjs) skriver dem ordret og har egne tests,
// og varer.levering er ordrens egen linje fra broen (linjer[].tekst).
const KERNEN_SKRIVER = new Set([
  'forloeb.betalt', 'forloeb.uge', 'forloeb.dag', 'forloeb.leveret', 'forloeb.afhentKlar', 'forloeb.hentet',
  'forloeb.ugeVenter', 'forloeb.dagVenter', 'forloeb.afhentVenter', 'forloeb.leveretVenter',
  'bet.betalt', 'bet.refunderet', 'vilkaar.fortrydNej', 'vilkaar.fortrydJa', 'vilkaar.fortrydDato', 'vilkaar.reklamation',
]);

// Fable port 3 (kvalitetsporten 12-11-2026, C:\tmp\kundelogin\fable-port3.md): tekster i fundenes "Præcis rettelse".
// nr = fundets nummer. "Try again" står ikke i port 3 (Fable skrev kun den danske "Prøv igen"); den er Fables egen engelske
// formulering fra side.nede/nede/side.fejl ("Try again in a moment") — testen holder, at den står dér.
const PORT3 = new Map([
  ['da:best.bestiltMobil', { nr: 16, fable: 'Bestilt 7. november 2026', vars: { dato: '7. november 2026' } }],
  ['en:best.bestiltMobil', { nr: 16, fable: 'Ordered 7 November 2026', vars: { dato: '7 November 2026' } }],
  ['da:design.gemtMobil', { nr: 16, fable: 'Gemt 2. november 2026', vars: { dato: '2. november 2026' } }],
  ['en:design.gemtMobil', { nr: 16, fable: 'Saved 2 November 2026', vars: { dato: '2 November 2026' } }],
  ['da:design.prisMobil', { nr: 16, fable: 'Pris da du gemte: 21.487,50 kr.', vars: { pris: '21.487,50 kr.' } }],
  ['en:design.prisMobil', { nr: 16, fable: 'Price when you saved: DKK 21,487.50', vars: { pris: 'DKK 21,487.50' } }],
  ['da:side.proevIgen', { nr: 24, fable: 'Prøv igen', vars: {} }],
  ['en:side.proevIgen', { nr: 24, fraEgenEngelsk: 'side.nede' }],
]);
const PORT3_FIL = [process.env.FABLE_PORT3, 'C:/tmp/kundelogin/fable-port3.md'].find((f) => f && existsSync(f));

test('Fable port 3: de nye tekster står i fundene (eller i Fables egen engelske tekst)', () => {
  const port3 = PORT3_FIL ? readFileSync(PORT3_FIL, 'utf8') : null;
  for (const [noegle, p] of PORT3) {
    const [sp, k] = noegle.split(':');
    const v = (sp === 'en' ? EN : DA)[k];
    assert.equal(typeof v, 'string', `${noegle} mangler`);
    if (p.fraEgenEngelsk) { assert.ok(EN[p.fraEgenEngelsk].includes(v), `${noegle}: "${v}" står ikke i en:${p.fraEgenEngelsk}`); continue; }
    // pladsholderen udfyldt med Fables eksempel = Fables tekst
    const udfyldt = v.replace(/\{(\w+)\}/g, (m, n) => p.vars[n] ?? m);
    assert.equal(udfyldt, p.fable, `${noegle} (port 3 nr. ${p.nr})`);
    if (port3) assert.ok(port3.includes(p.fable), `${noegle}: "${p.fable}" står ikke i fable-port3.md`);
  }
});

function fableTabeller(md) {
  const ud = { d13: new Map(), d4: new Map() };
  let afsnit = null;
  for (const linje of md.split(/\r?\n/)) {
    if (/^### d[123]\./.test(linje)) afsnit = 'd13';
    else if (/^### d4\./.test(linje)) afsnit = 'd4';
    else if (/^### /.test(linje)) afsnit = null;
    if (!afsnit || !linje.startsWith('| `')) continue;
    const celler = linje.slice(1, -1).split(' | ').map((c) => c.trim());
    const k = /^`([^`]+)`/.exec(celler[0])?.[1];
    if (!k) continue;
    ud[afsnit].set(k, afsnit === 'd13' ? { da: celler[1], en: celler[2] } : { da: celler[1] });
  }
  return ud;
}
const norm = (s) => (s === '(ingen)' ? '' : s.replace(/\{[^}]*\}/g, '{}').trim());

// Fable runde 4 (tillæg til runde 3): tabellerne har kolonnerne Nøgle · Dansk · English · Hvor (eller kun Dansk / kun
// English). "en:noscript" er den engelske noscript. Nøgler, kataloget ikke har (kernens ordre.status.*, designerens d.gem.*),
// skrives andre steder og prøves dér.
const FABLE4 = [
  process.env.FABLE_RUNDE4,
  path.resolve(fileURLToPath(new URL('../../', import.meta.url)), '../ni-apps-minside/docs/superpowers/specs/2026-11-12-min-side/fable-runde4.md'),
  'C:/dev/ni-apps-minside/docs/superpowers/specs/2026-11-12-min-side/fable-runde4.md',
].find((f) => f && existsSync(f));

function fable4Tabeller(md) {
  const ud = new Map();   // nøgle → { da?, en? }
  let kol = null;
  for (const linje of md.split(/\r?\n/)) {
    if (!linje.startsWith('|')) { kol = null; continue; }
    const celler = linje.slice(1, -1).split(' | ').map((c) => c.trim());
    if (celler[0] === 'Nøgle') { kol = celler; continue; }
    if (!kol || !celler[0].startsWith('`')) continue;
    let k = /^`([^`]+)`/.exec(celler[0])?.[1];
    if (!k) continue;
    const r = {};
    kol.forEach((navn, i) => {
      const v = celler[i];
      if (navn === 'Dansk') r.da = v;
      if (navn === 'English' && v !== '(kun dansk)') r.en = v;
    });
    if (k.startsWith('en:')) k = k.slice(3);
    ud.set(k, { ...(ud.get(k) ?? {}), ...r });
  }
  return ud;
}

test('ordret som i Fable runde 4 (de tekster, runde 3 manglede)', { skip: FABLE4 ? false : 'fable-runde4.md findes ikke ved siden af repoet' }, () => {
  const f4 = fable4Tabeller(readFileSync(FABLE4, 'utf8'));
  assert.ok(f4.size >= 18, `fandt ${f4.size} rækker`);
  let i = 0;
  for (const [k, f] of f4) {
    const da = Object.hasOwn(ORDRE, k) ? ORDRE[k] : Object.hasOwn(DA, k) ? DA[k] : null;
    if (f.da != null && da != null) { assert.equal(norm(da), norm(f.da), `da:${k}`); i++; }
    if (f.en != null && Object.hasOwn(EN, k)) { assert.equal(norm(EN[k]), norm(f.en), `en:${k}`); i++; }
  }
  assert.ok(i >= 21, `${i} tekster sammenlignet`);
});

test('ordret som i Fable runde 3 d1–d4', { skip: FABLE ? false : 'fable-runde3.md findes ikke ved siden af repoet' }, () => {
  const { d13, d4 } = fableTabeller(readFileSync(FABLE, 'utf8'));
  const f4 = FABLE4 ? fable4Tabeller(readFileSync(FABLE4, 'utf8')) : new Map();
  assert.ok(d13.size >= 90 && d4.size >= 55, `fandt ${d13.size} + ${d4.size} rækker`);
  for (const [k, f] of d13) {
    assert.ok(Object.hasOwn(DA, k), `d1–d3 ${k} mangler i da.json`);
    assert.equal(norm(DA[k]), norm(f.da), `da:${k}`);
    assert.equal(norm(EN[k]), norm(f.en), `en:${k}`);
  }
  for (const [k, f] of d4) {
    const v = Object.hasOwn(ORDRE, k) ? ORDRE[k] : Object.hasOwn(DA, k) ? DA[k] : null;
    if (v === null) { assert.ok(KERNEN_SKRIVER.has(k), `d4 ${k} hverken i kataloget eller skrevet af kernen`); continue; }
    assert.equal(norm(v), norm(f.da), `d4 ${k}`);
  }
  // Alt i kataloget, der ikke er TODO, stammer fra Fable (runde 3 eller runde 4)
  for (const [sp, k, v] of alle()) {
    if (v.includes('TODO-TEKST')) continue;
    const i4 = f4.has(k) && f4.get(k)[sp] != null;
    if (sp === 'en' && k === 'noscript') { assert.ok(i4 || !FABLE4, 'en:noscript findes ikke i Fable runde 4'); continue; }
    if (PORT3.has(`${sp}:${k}`)) continue;   // prøvet i testen ovenfor
    assert.ok(d13.has(k) || d4.has(k) || i4 || !FABLE4, `${sp}:${k} findes ikke i Fable`);
  }
});
