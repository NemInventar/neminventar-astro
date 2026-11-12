// R1–R21 (plan-teknik-v3.md §4): mindst én navngiven test pr. regel. Kør: npm run test:konto
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lavVerden, senesteKode, tokenAf, broOrdre, kodT, afkodT, KONTO, DESIGNER, PEBER, BRO_HEMMELIGHED, SECRETS, NOEGLE, REF, EJER } from './hjaelp.mjs';
import { nyKode, KODE_GRAENSE, hmacHex, sha256Hex } from '../src/krypto.js';
import { rensRetur, LOFT, PROD_ORIGINS } from '../src/regler.js';
import { filtrerOrdre } from '../src/bro.js';
import { RUTER, SIKKERHEDSHEADERE } from '../src/app.js';

const MIN = 60_000;
const DAG = 24 * 60 * MIN;

// ---------- R1 ----------
test('R1 koden er seks cifre fra getRandomValues uden modulo-skævhed', () => {
  // en værdi over grænsen kasseres; næste bruges
  const vaerdier = [KODE_GRAENSE, KODE_GRAENSE + 5, 4_123_456];
  assert.equal(nyKode(() => vaerdier.shift()), '123456');
  assert.equal(nyKode(() => 7), '000007');
  for (let i = 0; i < 500; i++) assert.match(nyKode(), /^\d{6}$/);
});

test('R1 koden gemmes kun som HMAC(peber, email:kode_id:kode) og kun i ni-konto', async () => {
  const v = lavVerden();
  await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok', formaal: 'log_ind' } });
  const kode = senesteKode(v, EJER);
  const [r] = [...v.db.s.koder.values()];
  assert.equal(r.kode_hmac, await hmacHex(PEBER, `${EJER}:${r.id}:${kode}`));
  assert.equal(r.peber_v, 1);
  assert.ok(!JSON.stringify([...v.db.s.koder.values()]).includes(kode));
});

test('R1 koden er engangs, log ind gælder 15 min og slet 10 min', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  const brugt = senesteKode(v, EJER);
  const igen = await v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: brugt } });
  assert.deepEqual(igen.json, { fejl: 'udloebet' });

  v.frem(16 * MIN);
  await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  const k15 = senesteKode(v, EJER);
  v.frem(15 * MIN + 1000);
  assert.deepEqual((await v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: k15 } })).json, { fejl: 'udloebet' });

  v.frem(16 * MIN);
  const ny = await v.logInd();
  await v.kald('POST', '/api/slet/kode', { cookie: ny.token });
  const k10 = senesteKode(v, EJER);
  v.frem(10 * MIN + 1000);
  const r = await v.kald('POST', '/api/slet', { cookie: ny.token, body: { kode: k10 } });
  assert.deepEqual(r.json, { fejl: 'udloebet' });
  assert.ok(token);
});

// ---------- R2 ----------
test('R2 fem forsøg pr. kode: det femte forkerte spærrer, og den rigtige virker ikke bagefter', async () => {
  const v = lavVerden();
  await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  const kode = senesteKode(v, EJER);
  const forkert = kode === '000000' ? '111111' : '000000';
  const svar = [];
  for (let i = 0; i < 5; i++) svar.push((await v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: forkert } })).json);
  assert.deepEqual(svar, [
    { fejl: 'forkert', tilbage: 4 }, { fejl: 'forkert', tilbage: 3 }, { fejl: 'forkert', tilbage: 2 },
    { fejl: 'forkert', tilbage: 1 }, { fejl: 'laast' },
  ]);
  assert.deepEqual((await v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode } })).json, { fejl: 'laast' });
});

test('R2 50 samtidige gæt på én kode: højst 5 vurderes', async () => {
  const v = lavVerden();
  await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  const kode = senesteKode(v, EJER);
  const gaet = Array.from({ length: 50 }, (_, i) => String((Number(kode) + 1 + i) % 1_000_000).padStart(6, '0'));
  const svar = await Promise.all(gaet.map((g) => v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: g } })));
  const [r] = [...v.db.s.koder.values()];
  assert.equal(r.forsoeg, 5);
  assert.equal(svar.filter((s) => s.json.fejl === 'forkert').length, 4);
  assert.equal(svar.filter((s) => s.json.fejl === 'laast').length, 46);
  assert.equal(svar.filter((s) => s.status === 200).length, 0);
});

// ---------- R3 ----------
test('R3 højst 3 koder pr. e-mail pr. 15 minutter', async () => {
  const v = lavVerden();
  for (let i = 0; i < 3; i++) assert.equal((await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } })).status, 200);
  const fjerde = await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  assert.equal(fjerde.status, 429);
  assert.deepEqual(fjerde.json, { fejl: 'loft' });
  assert.equal(v.mails.length, 3);
  v.frem(15 * MIN + 1000);
  assert.equal((await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } })).status, 200);
});

test('R3 20 forkerte koder pr. e-mail pr. kalenderdøgn i dansk tid lukker login til næste dag', async () => {
  const v = lavVerden({ start: Date.parse('2026-11-12T22:00:00Z') });   // 23:00 dansk tid
  let sidste;
  for (let kodeNr = 0; kodeNr < 4; kodeNr++) {
    assert.equal((await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } })).status, 200);
    const kode = senesteKode(v, EJER);
    const forkert = kode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) sidste = await v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: forkert } });
    v.frem(6 * MIN);
  }
  assert.equal(sidste.status, 429);
  assert.deepEqual(sidste.json, { fejl: 'doegn' });
  const lukket = await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  assert.deepEqual([lukket.status, lukket.json], [429, { fejl: 'doegn' }]);
  // En anden e-mail er ikke ramt
  assert.equal((await v.kald('POST', '/api/kode', { body: { email: 'anden@example.com', turnstile: 'tok' } })).status, 200);
  // 23:30 UTC = 00:30 dansk tid: nyt kalenderdøgn (i UTC er det stadig den 12.)
  v.saet(Date.parse('2026-11-12T23:30:00Z'));
  assert.equal((await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } })).status, 200);
});

test('R3 højst 10 koder pr. IP pr. time', async () => {
  const v = lavVerden();
  for (let i = 0; i < 10; i++) {
    assert.equal((await v.kald('POST', '/api/kode', { ip: '198.51.100.1', body: { email: `k${i}@example.com`, turnstile: 'tok' } })).status, 200);
  }
  const r = await v.kald('POST', '/api/kode', { ip: '198.51.100.1', body: { email: 'k10@example.com', turnstile: 'tok' } });
  assert.deepEqual([r.status, r.json], [429, { fejl: 'loft' }]);
  // en anden IP kan stadig
  assert.equal((await v.kald('POST', '/api/kode', { ip: '198.51.100.2', body: { email: 'k10@example.com', turnstile: 'tok' } })).status, 200);
  // et afvist kald tæller ikke: IP 1 har stadig 10, ikke 11
  const [n] = [...v.db.s.lofter.entries()].filter(([k]) => k.startsWith('ip:')).map(([, x]) => x.antal).sort((a, b) => b - a);
  assert.equal(n, 10);
});

test('R3 højst 150 koder i alt pr. døgn, alarm ved 75 (R19)', async () => {
  const v = lavVerden();
  for (let i = 0; i < 150; i++) {
    const r = await v.kald('POST', '/api/kode', { ip: `198.51.${Math.floor(i / 10)}.1`, body: { email: `n${i}@example.com`, turnstile: 'tok' } });
    assert.equal(r.status, 200, `kode ${i}`);
  }
  const r = await v.kald('POST', '/api/kode', { ip: '192.0.2.99', body: { email: 'n150@example.com', turnstile: 'tok' } });
  assert.deepEqual([r.status, r.json], [429, { fejl: 'loft' }]);
  const alarmer = v.alarmer.filter((a) => a.body.lines[0] === 'type: koder_doegn');
  assert.equal(alarmer.length, 1);
  assert.match(alarmer[0].body.lines[1], /75/);
});

// ---------- R4 ----------
test('R4 ved login ugyldiggøres alle åbne koder til e-mailen (også en slette-kode)', async () => {
  const v = lavVerden();
  const a = await v.logInd();
  await v.kald('POST', '/api/slet/kode', { cookie: a.token });
  const sletKode = senesteKode(v, EJER);
  v.frem(16 * MIN);
  await v.logInd();                                 // login fra en anden enhed
  const r = await v.kald('POST', '/api/slet', { cookie: a.token, body: { kode: sletKode } });
  assert.deepEqual(r.json, { fejl: 'udloebet' });
  assert.equal(v.db.s.kunder.size, 1);
});

// ---------- R5 ----------
test('R5 samme svar og samme regnevej, uanset om kontoen findes (kald tælles, ikke tid)', async () => {
  const v = lavVerden();
  await v.logInd(EJER);                             // EJER har en konto
  v.frem(DAG);
  const spor = async (fn) => {
    const db0 = v.db.kald.length; const g0 = v.graph.kald; const t0 = v.turnstile.kald; const b0 = v.bro.kald.length;
    const r = await fn();
    return { status: r.status, json: r.json, db: v.db.kald.slice(db0), graph: v.graph.kald - g0, turnstile: v.turnstile.kald - t0, bro: v.bro.kald.length - b0, cookie: r.setCookie.length };
  };
  const kendt = await spor(() => v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } }));
  const ukendt = await spor(() => v.kald('POST', '/api/kode', { body: { email: 'ingen.konto@example.com', turnstile: 'tok' } }));
  assert.deepEqual(kendt, ukendt);
  assert.deepEqual(kendt.json, { ok: true });

  const forkert = (e) => { const k = senesteKode(v, e); return k === '000000' ? '111111' : '000000'; };
  const tjekKendt = await spor(() => v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: forkert(EJER) } }));
  const tjekUkendt = await spor(() => v.kald('POST', '/api/kode/tjek', { body: { email: 'ingen.konto@example.com', kode: forkert('ingen.konto@example.com') } }));
  assert.deepEqual(tjekKendt, tjekUkendt);
  assert.deepEqual(tjekKendt.json, { fejl: 'forkert', tilbage: 4 });

  // uden en åben kode: også samme vej (HMAC'en regnes med et tilfældigt id)
  v.frem(DAG);
  const udenKendt = await spor(() => v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: '123456' } }));
  const udenUkendt = await spor(() => v.kald('POST', '/api/kode/tjek', { body: { email: 'ny.adresse@example.com', kode: '123456' } }));
  assert.deepEqual(udenKendt, udenUkendt);
  assert.deepEqual(udenKendt.json, { fejl: 'udloebet' });
  assert.deepEqual(udenKendt.db, ['kode_aktiv', 'kode_tjek', 'haendelse']);
});

// ---------- R6 ----------
test('R6 cookien: 32 bytes, præcis __Host-ni_konto; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000', async () => {
  const v = lavVerden();
  const { token, svar } = await v.logInd();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(svar.setCookie.length, 1);
  assert.equal(svar.setCookie[0], `__Host-ni_konto=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`);
  assert.doesNotMatch(svar.setCookie[0], /Domain=/i);
  // kun SHA-256 gemmes
  const [s] = [...v.db.s.sessioner.values()];
  assert.equal(s.token_sha256, await sha256Hex(token));
  assert.ok(!JSON.stringify([...v.db.s.sessioner.values()]).includes(token));
});

test('R6 session: 30 dage uden besøg logger ud, brug fornyer, højst 90 dage i alt', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  // brugt hver 29. dag: stadig logget ind, cookien fornyes
  for (let i = 0; i < 3; i++) {
    v.frem(29 * DAG);
    const r = await v.kald('GET', '/api/mig', { cookie: token });
    assert.equal(r.json.logget_ind, true, `dag ${(i + 1) * 29}`);
    assert.match(r.setCookie[0], /Max-Age=\d+$/);
  }
  // dag 87: den fornyede cookie må ikke række ud over dag 90
  const r87 = await v.kald('GET', '/api/mig', { cookie: token });
  assert.equal(r87.setCookie[0], `__Host-ni_konto=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${3 * 24 * 3600}`);
  v.frem(3 * DAG + 1000);                          // dag 90 + 1 sek.
  const efter = await v.kald('GET', '/api/mig', { cookie: token });
  assert.equal(efter.json.logget_ind, false);
  assert.equal(efter.setCookie[0], '__Host-ni_konto=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');

  const w = lavVerden();
  const b = await w.logInd();
  w.frem(30 * DAG + 1000);
  assert.equal((await w.kald('GET', '/api/mig', { cookie: b.token })).json.logget_ind, false);
});

test('R6 log ud lukker rækken på serveren (cookien virker ikke igen)', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  const ud = await v.kald('POST', '/api/log-ud', { cookie: token, body: {} });
  assert.deepEqual(ud.json, { ok: true });
  assert.equal(ud.setCookie[0], '__Host-ni_konto=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');
  assert.ok([...v.db.s.sessioner.values()][0].lukket);
  assert.deepEqual((await v.kald('GET', '/api/min-side', { cookie: token })).json, { fejl: 'login' });
});

// ---------- R7 ----------
test('R7 slet konto kræver en slette-kode i egen mail og sletter kunde, sessioner, koder og designs', async () => {
  const v = lavVerden();
  const a = await v.logInd();
  v.frem(16 * MIN);
  const b = await v.logInd();                       // to enheder
  await v.kald('POST', '/api/gem', { cookie: a.token, body: { produkt: 'hoejskab', t: kodT({ bredde: 60 }) } });
  const anden = await v.logInd('anden@example.com');
  await v.kald('POST', '/api/gem', { cookie: anden.token, body: { produkt: 'hoejskab', t: kodT({ bredde: 80 }) } });

  // uden kode sker der intet
  assert.deepEqual((await v.kald('POST', '/api/slet', { cookie: a.token, body: { kode: '123456' } })).json, { fejl: 'udloebet' });
  assert.equal((await v.kald('POST', '/api/slet/kode', { cookie: a.token, body: {} })).status, 200);
  const mail = v.mails.at(-1);
  assert.equal(mail.emne, 'Kode til at slette din konto hos Nem Inventar');
  assert.match(mail.tekst, /gælder i 10 minutter/);
  const kode = senesteKode(v, EJER);
  const r = await v.kald('POST', '/api/slet', { cookie: a.token, body: { kode } });
  assert.deepEqual(r.json, { ok: true });
  assert.equal(r.setCookie[0], '__Host-ni_konto=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');

  const kunder = [...v.db.s.kunder.values()].map((k) => k.email);
  assert.deepEqual(kunder, ['anden@example.com']);
  assert.ok([...v.db.s.sessioner.values()].every((s) => s.kunde_id !== a.kunde_id && s.token_sha256 !== undefined));
  assert.equal([...v.db.s.sessioner.values()].length, 1);
  assert.equal([...v.db.s.designs.values()].length, 1);
  assert.ok([...v.db.s.koder.values()].every((k) => k.email !== EJER));
  // alle enheder er logget ud
  assert.equal((await v.kald('GET', '/api/mig', { cookie: b.token })).json.logget_ind, false);
  // én mail om sletningen, med linjen om bestillinger (broen har en ordre til EJER)
  const slettet = v.mails.at(-1);
  assert.equal(slettet.emne, 'Din konto hos Nem Inventar er slettet');
  assert.match(slettet.tekst, /Dine bestillinger gemmer vi i fem år/);
});

// ---------- R8 ----------
test('R8 ændringer kræver application/json (ellers 415) og præcis Origin; Sec-Fetch-Site cross-site afvises', async () => {
  const v = lavVerden();
  const tekst = await v.kald('POST', '/api/kode', { type: 'text/plain', raa: JSON.stringify({ email: EJER }) });
  assert.deepEqual([tekst.status, tekst.json], [415, { fejl: 'type' }]);
  const form = await v.kald('POST', '/api/log-ud', { type: 'application/x-www-form-urlencoded', raa: 'alle=true' });
  assert.equal(form.status, 415);
  assert.equal((await v.kald('POST', '/api/kode', { origin: 'https://evil.example', body: { email: EJER } })).status, 403);
  assert.equal((await v.kald('POST', '/api/kode', { origin: 'https://www.neminventar.dk', body: { email: EJER } })).status, 403);
  assert.equal((await v.kald('POST', '/api/kode', { origin: 'http://konto.neminventar.dk', body: { email: EJER } })).status, 403);
  assert.equal((await v.kald('POST', '/api/kode', { origin: null, body: { email: EJER } })).status, 403);
  assert.equal((await v.kald('POST', '/api/kode', { sfs: 'cross-site', body: { email: EJER, turnstile: 'tok' } })).status, 403);
  // mangler Sec-Fetch-Site (Safari < 16.4): accepteres
  assert.equal((await v.kald('POST', '/api/kode', { sfs: null, body: { email: EJER, turnstile: 'tok' } })).status, 200);
  assert.equal((await v.kald('POST', '/api/kode', { type: 'application/json; charset=utf-8', body: { email: 'b@example.com', turnstile: 'tok' } })).status, 200);
  assert.equal(v.mails.length, 2);
});

// ---------- R9 ----------
test('R9 designerens origin må kun kalde mig og gem (CORS med credentials og præcis origin)', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  const mig = await v.kald('GET', '/api/mig', { origin: DESIGNER, cookie: token });
  assert.equal(mig.status, 200);
  assert.equal(mig.headers.get('access-control-allow-origin'), DESIGNER);
  assert.equal(mig.headers.get('access-control-allow-credentials'), 'true');
  assert.match(mig.headers.get('vary'), /Origin/);
  const gem = await v.kald('POST', '/api/gem', { origin: DESIGNER, cookie: token, body: { produkt: 'hoejskab', t: kodT({ bredde: 60 }) } });
  assert.equal(gem.status, 200);
  assert.equal(gem.headers.get('access-control-allow-origin'), DESIGNER);

  for (const [m, sti] of [['GET', '/api/min-side'], ['POST', '/api/kode'], ['POST', '/api/kode/tjek'], ['POST', '/api/slet'],
    ['POST', '/api/slet/kode'], ['POST', '/api/log-ud'], ['POST', '/api/design/slet'], ['POST', '/api/ordre'], ['POST', '/api/ikke-min']]) {
    const r = await v.kald(m, sti, { origin: DESIGNER, cookie: token, body: {} });
    assert.equal(r.status, 403, `${m} ${sti}`);
    assert.equal(r.headers.get('access-control-allow-origin'), null);
  }
  // preflight: kun mig og gem
  const pre = await v.kald('OPTIONS', '/api/gem', { origin: DESIGNER, headers: { 'access-control-request-method': 'POST' } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), DESIGNER);
  assert.equal(pre.headers.get('access-control-allow-credentials'), 'true');
  assert.equal(pre.headers.get('access-control-allow-methods'), 'POST');
  assert.equal((await v.kald('OPTIONS', '/api/min-side', { origin: DESIGNER })).status, 403);
  // ingen *.pages.dev, ni-apps eller localhost i produktion
  for (const o of ['https://ni-apps.pages.dev', 'https://abc.ni-konto.pages.dev', 'http://localhost:4321', 'https://designer.neminventar.dk.evil.example']) {
    const r = await v.kald('GET', '/api/mig', { origin: o, cookie: token });
    assert.equal(r.status, 403, o);
    assert.equal(r.headers.get('access-control-allow-origin'), null);
  }
});

// ---------- R10 ----------
test('R10 statusnøglen sendes i POST-body; et ordrenummer er ikke en nøgle og kræver login', async () => {
  const v = lavVerden();
  const r = await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } });
  assert.equal(r.json.visning, 'uden_login');
  const b0 = v.bro.kald.length;
  const ref = await v.kald('POST', '/api/ordre', { body: { noegle: REF } });
  assert.deepEqual([ref.status, ref.json], [200, { fejl: 'ukendt' }]);   // kontrakter §6: ukendt er et svar (200), ikke en HTTP-fejl
  assert.equal(v.bro.kald.length, b0, 'et ordrenummer sendes ikke til broen som nøgle');
  const udenLogin = await v.kald('POST', '/api/ordre-ref', { body: { ref: REF } });
  assert.deepEqual([udenLogin.status, udenLogin.json], [401, { fejl: 'login' }]);
  const { token } = await v.logInd();
  const med = await v.kald('POST', '/api/ordre-ref', { cookie: token, body: { ref: REF.toLowerCase() } });
  assert.equal(med.json.visning, 'med_login');
  assert.equal(med.json.ordre.adresse.gade, 'Rosenvej 14, 2. th.');
});

// ---------- R11 ----------
test('R11 et design renses for eget foto, og "gemt uden login" kommer uden billede og navn', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  const st = { bredde: 60, motiv: { b: 4, h: 3, z: 'gråtonegitter-fra-eget-foto' }, gammel: { b: 2, h: 2, data: 'ffff' }, farve: { korpus: 'eg' } };
  const r = await v.kald('POST', '/api/gem', { cookie: token, body: { produkt: 'hoejskab', t: kodT(st) } });
  assert.equal(r.status, 200);
  const [d] = [...v.db.s.designs.values()];
  assert.deepEqual(afkodT(d.tilstand), { bredde: 60, motiv: null, gammel: null, farve: { korpus: 'eg' } });
  assert.ok(!v.pris.kald.at(-1).search.includes(kodT(st)), 'prisen regnes på det rensede design');

  v.bro.gemtUdenLogin = [{ email: EJER, id: 77, produkt: 'hoejskab', titel: 'Højskab', dato: '2026-11-01', permalink: 'https://designer.neminventar.dk/designer?p=hoejskab', pris_oere: null, navn: 'Mit navn', billede: 'https://…/rum.jpg' }];
  const side = await v.kald('GET', '/api/min-side', { cookie: token });
  assert.deepEqual(side.json.gemt_uden_login, [{ id: 77, produkt: 'hoejskab', titel: 'Højskab', dato: '2026-11-01', permalink: 'https://designer.neminventar.dk/designer?p=hoejskab', pris_oere: null }]);
});

// ---------- R12 ----------
test('R12 kun betalte og annullerede ordrer vises; tilbageført beløb vises under betaling', async () => {
  const v = lavVerden();
  v.bro.ordrer = [broOrdre({ status: 'oprettet' })];
  assert.deepEqual((await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } })).json, { fejl: 'ukendt' });
  v.bro.ordrer = [broOrdre({ status: 'annulleret', betaling: { betalt_at: '2026-11-06T09:13:00.000Z', betalingsmiddel: 'mobilepay', refunderet_oere: 175000, refunderet_at: '2026-11-10T10:00:00.000Z' } })];
  const r = await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } });
  assert.equal(r.json.ordre.status, 'annulleret');
  assert.deepEqual(r.json.ordre.betaling, { betalt_at: '2026-11-06T09:13:00.000Z', betalingsmiddel: 'mobilepay', refunderet_oere: 175000, refunderet_at: '2026-11-10T10:00:00.000Z' });
  const { token } = await v.logInd();
  v.bro.ordrer.push(broOrdre({ ref: 'NI-0000000A', status: 'udloebet' }));
  const side = await v.kald('GET', '/api/min-side', { cookie: token });
  assert.deepEqual(side.json.ordrer.map((o) => o.status), ['annulleret']);
});

// ---------- R13 ----------
const FORVENTET_UDEN = {
  ref: 'NI-1A2B3C4D', bestilt: '2026-11-06T09:12:00.000Z', status: 'betalt', sprog: 'da', produkt: 'hoejskab',
  linjer: [{ tekst: 'Højskab', antal: 1, beloeb_oere: 1601250 }],
  levering: { form: 'baaret_ind', tekst: 'Samlet, båret ind' },
  total: { ex_oere: 1281000, moms_oere: 320250, inkl_oere: 1601250, valuta: 'DKK' },
  beskrivelse: { maal: 'Bredde 60', felter: [{ k: 'Dybde', v: '60' }] },
  forloeb: [{ trin: 'uge_bekraeftet', data: { aar: 2026, uge: 51, praecis: false, aftalt: { tekst: 'Uden sokkel' } }, tid: '2026-11-09T08:00:00.000Z' }],
  betaling: { betalt_at: '2026-11-06T09:13:00.000Z', betalingsmiddel: 'card', refunderet_oere: 0, refunderet_at: null },
  fortrydelsesret: false, uge_frist_at: '2026-11-09T22:59:59.000Z',
  adresse: { postnr: '2500', by: 'Valby' },
};

test('R13 kun hvidlistens felter: snapshot af visningen uden login og med login', async () => {
  assert.deepEqual(filtrerOrdre(broOrdre(), 'uden_login'), FORVENTET_UDEN);
  assert.deepEqual(filtrerOrdre(broOrdre(), 'med_login'), {
    ...FORVENTET_UDEN,
    adresse: { postnr: '2500', by: 'Valby', navn: 'Mette Holm', gade: 'Rosenvej 14, 2. th.' },
    besked: 'Ring før levering',
    permalink: 'https://designer.neminventar.dk/designer?p=hoejskab&t=eyJ9',
  });
  const v = lavVerden();
  const uden = await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } });
  assert.deepEqual(uden.json, { visning: 'uden_login', ordre: FORVENTET_UDEN });
  const tekst = JSON.stringify(uden.json);
  for (const forbudt of ['12345678', EJER, 'milot@', 'pi_123', 'cs_123', 'kontakt@', 'kundens_ja', 'sat_af', 'email_rettet', 'Rosenvej', 'Mette Holm', 'Ring før']) {
    assert.ok(!tekst.includes(forbudt), forbudt);
  }
});

// ---------- R14 ----------
test('R14 flagene: fra = 503 {fejl:"lukket"}, og mig fortæller designeren det', async () => {
  const v = lavVerden({ env: { KONTO_AKTIV: 'false', ORDRESTATUS_AKTIV: 'false' } });
  for (const [m, sti] of [['POST', '/api/kode'], ['POST', '/api/kode/tjek'], ['GET', '/api/min-side'], ['POST', '/api/gem'], ['POST', '/api/ordre'],
    ['POST', '/api/ordre-ref'], ['POST', '/api/slet'], ['POST', '/api/slet/kode'], ['POST', '/api/design/slet'], ['POST', '/api/design/navn'],
    ['POST', '/api/gemt-uden-login/skjul'], ['POST', '/api/ikke-min']]) {
    const r = await v.kald(m, sti, { body: { email: EJER, turnstile: 'tok', noegle: NOEGLE } });
    assert.deepEqual([r.status, r.json], [503, { fejl: 'lukket' }], `${m} ${sti}`);
  }
  assert.deepEqual((await v.kald('GET', '/api/mig')).json, { logget_ind: false, konto_aktiv: false, ordrestatus_aktiv: false });
  assert.equal((await v.kald('POST', '/api/log-ud', { body: {} })).status, 200);
  assert.equal(v.mails.length + v.db.kald.length + v.bro.kald.length, 0);

  // "true" er det eneste, der tænder
  const w = lavVerden({ env: { KONTO_AKTIV: 'TRUE', ORDRESTATUS_AKTIV: 'true' } });
  assert.equal((await w.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } })).status, 503);
  assert.equal((await w.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } })).status, 200);
});

// ---------- R15 ----------
test('R15 (ERP-siden) Workeren sender aldrig status-mails — kun konto-mails fra konto@ med svar til tilbud@', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } });
  await v.kald('POST', '/api/ikke-min', { cookie: token, body: { ref: REF } });
  await v.kald('POST', '/api/gem', { cookie: token, body: { produkt: 'hoejskab', t: kodT({ bredde: 60 }) } });
  assert.equal(v.mails.length, 1);
  for (const m of v.mails) {
    assert.equal(m.fra, 'konto@neminventar.dk');
    assert.equal(m.svarTil, 'tilbud@neminventar.dk');
    assert.equal(m.saveToSentItems, false);
  }
});

// ---------- R16 ----------
test('R16 kun Web Crypto og egne moduler: ingen afhængigheder i Workeren', () => {
  const mappe = fileURLToPath(new URL('../src/', import.meta.url));
  for (const f of readdirSync(mappe)) {
    const kilde = readFileSync(mappe + f, 'utf8');
    for (const m of kilde.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) assert.match(m[1], /^\.\/[a-z-]+\.js$/, `${f}: ${m[1]}`);
    assert.doesNotMatch(kilde, /Math\.random|require\(/, f);
  }
});

// ---------- R17 ----------
test('R17 logs indeholder aldrig cookie, kode, nøgle eller e-mail', async () => {
  const linjer = [];
  const gem = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  console.log = console.error = console.warn = console.info = (...a) => linjer.push(a.map(String).join(' '));
  let token; let kode;
  try {
    const w = lavVerden({ standardLog: true });
    ({ token } = await w.logInd());
    kode = senesteKode(w, EJER);
    await w.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: '999999' } });
    await w.kald('POST', '/api/ordre', { body: { noegle: NOEGLE }, cookie: token });
    await w.kald('GET', '/api/min-side', { cookie: token });
    w.graph.nede = true;
    await w.kald('POST', '/api/kode', { body: { email: 'graph@example.com', turnstile: 'tok' } });
    w.db.nede = true;
    await w.kald('GET', '/api/mig', { cookie: token });
    const hele = linjer.join('\n');
    assert.ok(linjer.length > 5);
    for (const hemmeligt of [token, kode, EJER, 'graph@example.com', NOEGLE, PEBER, BRO_HEMMELIGHED, ...Object.values(SECRETS), 'graph-token', 'ni_konto=']) {
      assert.ok(!hele.includes(hemmeligt), `loggen indeholder ${hemmeligt.slice(0, 6)}…`);
    }
    // hændelsesloggen har kun HMAC(e-mail) og dagshash af IP'en
    const h = JSON.stringify(w.db.s.haendelser);
    assert.ok(!h.includes(EJER) && !h.includes('203.0.113.7') && !h.includes(kode));
    assert.ok(w.db.s.haendelser.some((x) => x.type === 'login' && /^[0-9a-f]{64}$/.test(x.email_hmac) && /^[0-9a-f]{32}$/.test(x.ip_dag)));
  } finally {
    Object.assign(console, gem);
  }
});

// ---------- R18 ----------
test('R18 Cache-Control: private, no-store på alle svar, også fejl og preflight', async () => {
  const v = lavVerden();
  const svar = [
    await v.kald('GET', '/api/mig'),
    await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } }),
    await v.kald('POST', '/api/kode', { type: 'text/plain', raa: 'x' }),
    await v.kald('GET', '/api/findes-ikke'),
    await v.kald('PUT', '/api/kode'),
    await v.kald('OPTIONS', '/api/mig', { origin: DESIGNER }),
    await v.kald('GET', '/api/min-side'),
  ];
  for (const r of svar) {
    assert.equal(r.headers.get('cache-control'), 'private, no-store', String(r.status));
    assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
  }
  assert.deepEqual(svar.map((r) => r.status), [200, 200, 415, 404, 405, 204, 401]);
});

// Pages' _headers gælder ikke for Pages Functions: Workeren sætter selv sikkerhedsheaderne på /api/* (ét sted, lavSvar)
test('Sikkerhedsheadere på alle API-svar: HSTS, nosniff, CSP uden indhold og rammer, ingen referrer — også fejl, preflight og 500', async () => {
  const v = lavVerden();
  const FORVENTET = {
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'cache-control': 'private, no-store',
  };
  const { token } = await v.logInd();
  const svar = [
    await v.kald('GET', '/api/mig'),
    await v.kald('GET', '/api/mig', { origin: DESIGNER }),
    await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } }),
    await v.kald('POST', '/api/ordre', { body: { noegle: 'xxxxxxxxxxxxxxxxxxxxxx' } }),
    await v.kald('POST', '/api/kode/tjek', { body: { email: 'mette@eksempel.dk', kode: '000000' } }),
    await v.kald('GET', '/api/min-side', { cookie: token }),
    await v.kald('POST', '/api/kode', { type: 'text/plain', raa: 'x' }),
    await v.kald('POST', '/api/ordre', { origin: 'https://ond.example', body: { noegle: NOEGLE } }),
    await v.kald('GET', '/api/findes-ikke'),
    await v.kald('PUT', '/api/kode'),
    await v.kald('OPTIONS', '/api/gem', { origin: DESIGNER, headers: { 'access-control-request-method': 'POST' } }),
    await v.kald('GET', '/api/min-side'),
  ];
  for (const r of svar) for (const [h, val] of Object.entries(FORVENTET)) assert.equal(r.headers.get(h), val, `${h} på ${r.status}`);
  assert.deepEqual(svar.map((r) => r.status), [200, 200, 200, 200, 400, 200, 415, 403, 404, 405, 204, 401]);
  assert.deepEqual(Object.keys(SIKKERHEDSHEADERE).sort(), Object.keys(FORVENTET).filter((h) => h !== 'cache-control').sort());
  // en uventet fejl i en handler (500) får dem også
  const foer = RUTER['/api/mig'].h;
  RUTER['/api/mig'].h = () => { throw new TypeError('bum'); };
  try {
    const r = await v.kald('GET', '/api/mig');
    assert.deepEqual([r.status, r.json], [500, { fejl: 'fejl' }]);
    for (const [h, val] of Object.entries(FORVENTET)) assert.equal(r.headers.get(h), val, `${h} på 500`);
  } finally {
    RUTER['/api/mig'].h = foer;
  }
});

// ---------- R19 ----------
test('R19 alarmer: forkerte > 50/time, 429-byger, Graph-fejl (én pr. time) og hver kontosletning — uden e-mail', async () => {
  const v = lavVerden();
  // 51 forkerte koder i samme time fra 11 e-mails (5 pr. kode, dagsbudgettet pr. e-mail rammes ikke)
  for (let i = 0; i < 11; i++) {
    const email = `f${i}@example.com`;
    await v.kald('POST', '/api/kode', { ip: `198.51.100.${i}`, body: { email, turnstile: 'tok' } });
    const k = senesteKode(v, email);
    const forkert = k === '000000' ? '111111' : '000000';
    for (let j = 0; j < 5; j++) await v.kald('POST', '/api/kode/tjek', { body: { email, kode: forkert } });
  }
  assert.equal(v.alarmer.filter((a) => a.body.lines[0] === 'type: forkerte_time').length, 1);

  // 20 afviste kodeanmodninger i timen → én alarm
  for (let i = 0; i < 23; i++) await v.kald('POST', '/api/kode', { ip: '198.51.100.0', body: { email: 'f0@example.com', turnstile: 'tok' } });
  assert.equal(v.alarmer.filter((a) => a.body.lines[0] === 'type: byge').length, 1);

  // Graph nede: kunden får {fejl:'mail'}, og der kommer én alarm, selv om det sker flere gange
  v.graph.nede = true;
  for (let i = 0; i < 3; i++) {
    const r = await v.kald('POST', '/api/kode', { ip: `192.0.2.${i}`, body: { email: `g${i}@example.com`, turnstile: 'tok' } });
    assert.deepEqual([r.status, r.json], [503, { fejl: 'mail' }]);
  }
  assert.equal(v.alarmer.filter((a) => a.body.lines[0] === 'type: graph').length, 1);
  v.graph.nede = false;

  const { token } = await v.logInd('slet@example.com');
  await v.kald('POST', '/api/slet/kode', { cookie: token });
  await v.kald('POST', '/api/slet', { cookie: token, body: { kode: senesteKode(v, 'slet@example.com') } });
  assert.equal(v.alarmer.filter((a) => a.body.lines[0] === 'type: konto_slettet').length, 1);

  const alt = JSON.stringify(v.alarmer.map((a) => a.body));
  assert.ok(!/@example\.com/.test(alt));
  assert.ok(v.alarmer.every((a) => a.body.to_email === 'js@neminventar.dk' && /^ni-konto \(prod\): /.test(a.body.title)));
});

// ---------- R20 ----------
test('R20 døgn og time regnes i dansk tid (lofternes nøgler)', async () => {
  const v = lavVerden({ start: Date.parse('2026-11-12T23:30:00Z') });   // 00:30 den 13. i København
  await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  const noegler = [...v.db.s.lofter.keys()];
  assert.ok(noegler.includes('alle:2026-11-13'), noegler.join(', '));
  assert.ok(noegler.some((n) => /^ip:[0-9a-f]{32}:2026-11-13T00$/.test(n)), noegler.join(', '));
  // sommertid: 2027-06-30 22:30 UTC er 00:30 den 1. juli
  const w = lavVerden({ start: Date.parse('2027-06-30T22:30:00Z') });
  await w.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  assert.ok([...w.db.s.lofter.keys()].includes('alle:2027-07-01'));
});

// ---------- R21 ----------
test('R21 retur efter login kun til stier på konto- og designer-værten', async () => {
  const o = PROD_ORIGINS;
  assert.equal(rensRetur('/ordre/', o), 'https://konto.neminventar.dk/ordre/');
  assert.equal(rensRetur('/ordre/#AbCdEfGhIjKlMnOpQrStUv', o), 'https://konto.neminventar.dk/ordre/');
  assert.equal(rensRetur('https://designer.neminventar.dk/designer?p=hoejskab&t=abc', o), 'https://designer.neminventar.dk/designer?p=hoejskab&t=abc');
  for (const ond of ['https://evil.example/', '//evil.example/x', '/\\evil.example', 'javascript:alert(1)', 'http://konto.neminventar.dk/',
    'https://konto.neminventar.dk.evil.example/', 'https://neminventar.dk/', 'https://user:pw@konto.neminventar.dk/', 'data:text/html,x', '/a\nb', '']) {
    assert.equal(rensRetur(ond, o), null, ond);
  }
  const v = lavVerden();
  await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok', retur: 'https://designer.neminventar.dk/designer?p=hoejskab' } });
  const r = await v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: senesteKode(v, EJER) } });
  assert.deepEqual(r.json, { ok: true, retur: 'https://designer.neminventar.dk/designer?p=hoejskab', ny: true });
  v.frem(16 * MIN);
  await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok', retur: 'https://evil.example/' } });
  const r2 = await v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: senesteKode(v, EJER) } });
  assert.deepEqual(r2.json, { ok: true, retur: null, ny: false });
});

// Lofterne i Workeren og i SQL'en skal være de samme tal
test('R3 tallene i regler.js og konto/sql/002_funktioner.sql passer sammen', () => {
  const sql = readFileSync(fileURLToPath(new URL('../../sql/002_funktioner.sql', import.meta.url)), 'utf8');
  assert.match(sql, new RegExp(`if coalesce\\(v_n, 0\\) >= ${LOFT.forkerte_doegn} then`));
  assert.match(sql, new RegExp(`lofter.antal < ${LOFT.forkerte_doegn}\\b`));
  assert.match(sql, new RegExp(`if v_n >= ${LOFT.email_15min} then`));
  assert.match(sql, /oprettet > now\(\) - interval '15 minutes'/);
  assert.match(sql, new RegExp(`if v_ip > ${LOFT.ip_time} then`));
  assert.match(sql, new RegExp(`if v_alle > ${LOFT.alle_doegn} then`));
  assert.match(sql, new RegExp(`lofter.antal < ${LOFT.gem_doegn}\\b`));
  assert.match(sql, /forsoeg < 5/);
  assert.match(sql, /interval '10 minutes' else interval '15 minutes'/);
  assert.match(sql, /interval '90 days'/);
  assert.match(sql, /sidst_brugt > now\(\) - interval '30 days'/);
  assert.match(sql, /'Europe\/Copenhagen'/);
});

void KONTO;
