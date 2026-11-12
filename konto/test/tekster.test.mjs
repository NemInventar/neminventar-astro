// Tekstkataloget (konto/tekster/*.json): ordret fra Fable runde 3 d1–d4, samme nøgler på dansk og engelsk, ingen
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
  'varer.levering',
]);

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

test('ordret som i Fable runde 3 d1–d4', { skip: FABLE ? false : 'fable-runde3.md findes ikke ved siden af repoet' }, () => {
  const { d13, d4 } = fableTabeller(readFileSync(FABLE, 'utf8'));
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
  // Alt i kataloget, der ikke er TODO, stammer fra Fable
  for (const [sp, k, v] of alle()) {
    if (v.includes('TODO-TEKST') || (sp === 'en' && k === 'noscript')) continue;
    assert.ok(d13.has(k) || d4.has(k), `${sp}:${k} findes ikke i Fable`);
  }
});
