// Konto-API'et (kontrakter.md §6) ud over reglerne: Turnstile, Graph, broen, nede-adfærd (plan §8), designs,
// staging-hvidlisten, Pages-videresenderen og wrangler-filerne. Kør: npm run test:konto
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lavVerden, senesteKode, broOrdre, kodT, KONTO, DESIGNER, NOEGLE, NOEGLE_ERSTATTET, REF, EJER, BRO_HEMMELIGHED } from './hjaelp.mjs';
import { broSignatur } from '../src/bro.js';
import { b64url, fraB64url } from '../src/krypto.js';
import { onRequest } from '../../functions/api/[[sti]].js';
import { prisUdenLevering } from '../src/pris.js';

const MIN = 60_000;
const fil = (sti) => readFileSync(fileURLToPath(new URL(sti, import.meta.url)), 'utf8');

// ---------- Turnstile (S10) ----------
test('Turnstile fejler lukket: mangler nøgle, netværksfejl, forkert handling, forkert vært eller success=false', async () => {
  const tilfaelde = [
    ['ingen hemmelighed', (v) => { v.env.TURNSTILE_SECRET = ''; }],
    ['netværksfejl', (v) => { v.turnstile.svar = 'nede'; }],
    ['forkert handling', (v) => { v.turnstile.svar = { success: true, action: 'andet', hostname: 'konto.neminventar.dk' }; }],
    ['forkert vært', (v) => { v.turnstile.svar = { success: true, action: 'konto-kode', hostname: 'designer.neminventar.dk' }; }],
    ['success false', (v) => { v.turnstile.svar = { success: false, action: 'konto-kode', hostname: 'konto.neminventar.dk' }; }],
    ['intet token', (v, b) => { delete b.turnstile; }],
  ];
  for (const [navn, ret] of tilfaelde) {
    const v = lavVerden();
    const body = { email: EJER, turnstile: 'tok', formaal: 'log_ind' };
    ret(v, body);
    const r = await v.kald('POST', '/api/kode', { body });
    assert.deepEqual([r.status, r.json], [403, { fejl: 'robot' }], navn);
    assert.ok(!v.db.kald.includes('kode_opret'), navn);
    assert.equal(v.mails.length, 0, navn);
  }
  const v = lavVerden();
  await v.kald('POST', '/api/kode', { ip: '198.51.100.9', body: { email: EJER, turnstile: 'tok-123' } });
  assert.equal(v.turnstile.sidste.get('secret'), 'turnstile-hemmelighed-test');
  assert.equal(v.turnstile.sidste.get('response'), 'tok-123');
  assert.equal(v.turnstile.sidste.get('remoteip'), '198.51.100.9');
});

test('Tidsangreb: også en robot-afvisning går samme vej for kendt og ukendt e-mail', async () => {
  const v = lavVerden();
  await v.logInd();
  v.turnstile.svar = { success: false };
  const spor = async (email) => {
    const d0 = v.db.kald.length; const t0 = v.turnstile.kald;
    const r = await v.kald('POST', '/api/kode', { body: { email, turnstile: 'tok' } });
    return { status: r.status, json: r.json, db: v.db.kald.slice(d0), t: v.turnstile.kald - t0 };
  };
  assert.deepEqual(await spor(EJER), await spor('ukendt@example.com'));
});

// ---------- mail fra konto@ (S2, fable d6) ----------
test('Login-koden: fable d6 nr. 1 ordret, fra konto@, svar til tilbud@, ikke gemt i Sendt', async () => {
  const v = lavVerden();
  await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  const kode = senesteKode(v, EJER);
  const k = `${kode.slice(0, 3)} ${kode.slice(3)}`;
  const m = v.mails[0];
  assert.equal(m.emne, `${k} er din kode til Nem Inventar`);
  assert.equal(m.tekst, `Hej\n\nDin kode er ${k}\n\nSkriv den på siden, hvor du bad om den. Koden gælder i 15 minutter og kan bruges én gang.\n\nHar du ikke bedt om en kode, kan du se bort fra mailen. Ingen kan logge ind uden den. Vi beder dig aldrig om koden på telefon eller mail.\n\nVenlig hilsen\nNem Inventar\ntilbud@neminventar.dk · +45 42 42 26 84`);
  assert.equal(m.til, EJER);
  assert.equal(m.fra, 'konto@neminventar.dk');
  assert.equal(m.svarTil, 'tilbud@neminventar.dk');
  assert.equal(m.saveToSentItems, false);
  assert.equal(v.graph.sidste.url, 'https://graph.microsoft.com/v1.0/users/konto%40neminventar.dk/sendMail');
  assert.equal(v.graph.sidste.headers.get('authorization'), 'Bearer graph-token');
  assert.equal(v.graph.sidste.body.message.body.contentType, 'Text');

  await v.kald('POST', '/api/kode', { body: { email: 'en@example.com', turnstile: 'tok', sprog: 'en' } });
  const en = v.mails.at(-1);
  assert.match(en.emne, /^\d{3} \d{3} is your Nem Inventar code$/);
  assert.match(en.tekst, /^Hello\n\nYour code is \d{3} \d{3}\n\nEnter it on the page/);
});

test('Graph med certifikat: client assertion signeret med nøglen, x5t = certifikatets SHA-1', async () => {
  const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey));
  const certDer = crypto.getRandomValues(new Uint8Array(300));       // kun tommelfingeraftrykket bruges
  const pem = (etiket, b) => `-----BEGIN ${etiket}-----\n${Buffer.from(b).toString('base64').replace(/.{64}/g, '$&\n')}\n-----END ${etiket}-----\n`;
  const v = lavVerden({ env: { GRAPH_CLIENT_SECRET: '', GRAPH_CERT_PEM: pem('CERTIFICATE', certDer), GRAPH_KEY_PEM: pem('PRIVATE KEY', pkcs8) } });
  let form;
  const indre = v.fetch;
  v.fetch = async (url, init) => {
    if (String(url).startsWith('https://login.microsoftonline.com/')) form = new URLSearchParams(init.body);
    return indre(url, init);
  };
  const r = await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  assert.equal(r.status, 200);
  assert.equal(form.get('client_secret'), null);
  assert.equal(form.get('client_assertion_type'), 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  const [h, k, s] = form.get('client_assertion').split('.');
  const hoved = JSON.parse(new TextDecoder().decode(fraB64url(h)));
  const krop = JSON.parse(new TextDecoder().decode(fraB64url(k)));
  assert.equal(hoved.alg, 'RS256');
  assert.equal(hoved.x5t, b64url(new Uint8Array(await crypto.subtle.digest('SHA-1', certDer))));
  assert.equal(krop.aud, 'https://login.microsoftonline.com/tenant.test/oauth2/v2.0/token');
  assert.equal(krop.iss, 'klient-id');
  assert.equal(krop.exp - krop.iat, 600);
  assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', par.publicKey, fraB64url(s), new TextEncoder().encode(`${h}.${k}`)));
});

test('Graph nede: {fejl:"mail"}, og koden bliver ikke liggende i en mail, der aldrig blev sendt', async () => {
  const v = lavVerden();
  v.graph.nede = true;
  const r = await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } });
  assert.deepEqual([r.status, r.json], [503, { fejl: 'mail' }]);
  assert.equal(v.mails.length, 0);
});

test('Staging: mails kun til TEST_HVIDLISTE, origins og Turnstile-vært fra miljøet', async () => {
  const preview = 'https://min-side.ni-konto.pages.dev';
  const v = lavVerden({ env: { MILJOE: 'staging', KONTO_ORIGIN: preview, TEST_HVIDLISTE: 'js@neminventar.dk, kontakt@neminventar.dk' } });
  v.turnstile.svar = { success: true, action: 'konto-kode', hostname: 'min-side.ni-konto.pages.dev' };
  const fremmed = await v.kald('POST', '/api/kode', { origin: preview, body: { email: EJER, turnstile: 'tok' } });
  assert.deepEqual([fremmed.status, fremmed.json], [200, { ok: true }]);      // samme svar (R5) …
  assert.equal(v.mails.length, 0);                                            // … men ingen mail til en kunde
  const intern = await v.kald('POST', '/api/kode', { origin: preview, body: { email: 'JS@neminventar.dk', turnstile: 'tok' } });
  assert.equal(intern.status, 200);
  assert.deepEqual(v.mails.map((m) => m.til), ['js@neminventar.dk']);
  // produktionens konto-origin er ikke staging-origin
  assert.equal((await v.kald('POST', '/api/kode', { origin: KONTO, body: { email: 'js@neminventar.dk', turnstile: 'tok' } })).status, 403);
  // staging uden hvidliste sender intet
  const w = lavVerden({ env: { MILJOE: 'staging', TEST_HVIDLISTE: '' } });
  await w.kald('POST', '/api/kode', { body: { email: 'js@neminventar.dk', turnstile: 'tok' } });
  assert.equal(w.mails.length, 0);
  // i produktion kan miljøet ikke flytte origin
  const p = lavVerden({ env: { MILJOE: 'prod', KONTO_ORIGIN: 'https://evil.example' } });
  assert.equal((await p.kald('POST', '/api/kode', { origin: 'https://evil.example', body: { email: EJER, turnstile: 'tok' } })).status, 403);
});

// ---------- broen (kontrakter §5) ----------
test('Broen: signatur over POST\\n/konto-bro\\n<tid>\\n<nonce>\\n<body>, ny nonce hver gang, body = {handling, …}', async () => {
  const v = lavVerden();
  const sete = [];
  const indre = v.fetch;
  v.fetch = async (url, init) => {
    if (String(url).startsWith('https://bro.test/')) sete.push({ url: String(url), h: new Headers(init.headers), body: init.body });
    return indre(url, init);
  };
  await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } });
  await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } });
  assert.equal(sete.length, 2);
  for (const s of sete) {
    assert.equal(s.url, 'https://bro.test/functions/v1/konto-bro');
    assert.equal(s.h.get('x-bro-v'), '1');
    assert.equal(s.h.get('x-bro-tid'), String(v.nu()));
    assert.match(s.h.get('x-bro-nonce'), /^[A-Za-z0-9_-]{22}$/);
    assert.equal(s.h.get('x-bro-sig'), await broSignatur(BRO_HEMMELIGHED, s.h.get('x-bro-tid'), s.h.get('x-bro-nonce'), s.body));
    assert.deepEqual(JSON.parse(s.body), { handling: 'ordre_for_noegle', noegle: NOEGLE });
  }
  assert.notEqual(sete[0].h.get('x-bro-nonce'), sete[1].h.get('x-bro-nonce'));
  // forkert hemmelighed → broen svarer 401 → "nede" for kunden, ingen data
  const w = lavVerden({ env: { BRO_HEMMELIGHED_1: 'forkert-hemmelighed-xxxxxxxxxxxxxx' } });
  assert.deepEqual((await w.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } })).json, { fejl: 'nede' });
});

test('Ordresiden: ukendt og erstattet → 200 med {fejl} (ingen rød linje i konsollen), med login kun når e-mailen passer', async () => {
  const v = lavVerden();
  // kontrakter §6 (rettet 12-11): et ukendt eller erstattet link er et svar, ikke en HTTP-fejl
  for (const [noegle, fejl] of [['xxxxxxxxxxxxxxxxxxxxxx', 'ukendt'], [NOEGLE_ERSTATTET, 'erstattet'], [undefined, 'ukendt'], ['for-kort', 'ukendt'], ['NI-1D078A14', 'ukendt']]) {
    const r = await v.kald('POST', '/api/ordre', { body: noegle === undefined ? {} : { noegle } });
    assert.deepEqual([r.status, r.json], [200, { fejl }], String(noegle));
  }

  const fremmed = await v.logInd('fremmed@example.com');
  const r1 = await v.kald('POST', '/api/ordre', { cookie: fremmed.token, body: { noegle: NOEGLE } });
  assert.equal(r1.json.visning, 'uden_login');
  assert.equal(r1.json.ordre.adresse.gade, undefined);
  v.frem(16 * MIN);
  const ejer = await v.logInd(EJER);
  const r2 = await v.kald('POST', '/api/ordre', { cookie: ejer.token, body: { noegle: NOEGLE } });
  assert.equal(r2.json.visning, 'med_login');
  assert.equal(r2.json.ordre.besked, 'Ring før levering');
  assert.equal(r2.json.ordre.adresse.navn, 'Mette Holm');
  // ordre-ref med en andens ordrenummer: samme svar som et ukendt
  assert.deepEqual((await v.kald('POST', '/api/ordre-ref', { cookie: fremmed.token, body: { ref: REF } })).json, { fejl: 'ukendt' });
  assert.deepEqual((await v.kald('POST', '/api/ordre-ref', { cookie: fremmed.token, body: { ref: 'NI-FFFFFFFF' } })).json, { fejl: 'ukendt' });
});

// ---------- nede (plan §8) ----------
test('Broen nede: {fejl:"nede"} kun for ordrer — designs og konto virker', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  await v.kald('POST', '/api/gem', { cookie: token, body: { produkt: 'hoejskab', t: kodT({ bredde: 60 }) } });
  v.bro.nede = true;
  const side = await v.kald('GET', '/api/min-side', { cookie: token });
  assert.equal(side.status, 200);
  assert.deepEqual(side.json.ordrer, { fejl: 'nede' });
  assert.equal(side.json.email, EJER);
  assert.equal(side.json.designs.length, 1);
  assert.deepEqual(side.json.gemt_uden_login, []);
  assert.deepEqual((await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } })).json, { fejl: 'nede' });
  assert.deepEqual((await v.kald('POST', '/api/ordre-ref', { cookie: token, body: { ref: REF } })).json, { fejl: 'nede' });
  assert.deepEqual((await v.kald('POST', '/api/ikke-min', { cookie: token, body: { ref: REF } })).json, { fejl: 'nede' });
  // konto og designs virker stadig
  assert.equal((await v.kald('GET', '/api/mig', { cookie: token })).json.logget_ind, true);
  assert.equal((await v.kald('POST', '/api/gem', { cookie: token, body: { produkt: 'hoejskab', t: kodT({ bredde: 80 }) } })).status, 200);
  assert.equal((await v.kald('POST', '/api/log-ud', { cookie: token, body: {} })).status, 200);
});

test('ni-konto nede: ordresiden virker (loftet fejler åbent), login fejler lukket', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  v.db.nede = true;
  const r = await v.kald('POST', '/api/ordre', { cookie: token, body: { noegle: NOEGLE } });
  assert.deepEqual([r.status, r.json.visning], [200, 'uden_login']);
  assert.deepEqual((await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok' } })).json, { fejl: 'mail' });
  assert.deepEqual((await v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: '123456' } })).json, { fejl: 'nede' });
  assert.deepEqual((await v.kald('GET', '/api/mig', { cookie: token })).json, { logget_ind: false, konto_aktiv: true, ordrestatus_aktiv: true });
  assert.deepEqual((await v.kald('GET', '/api/min-side', { cookie: token })).json, { fejl: 'nede' });
});

test('Visningsloftet: 300 ordreopslag pr. IP pr. time', async () => {
  const v = lavVerden();
  for (let i = 0; i < 300; i++) assert.deepEqual((await v.kald('POST', '/api/ordre', { body: { noegle: 'yyyyyyyyyyyyyyyyyyyyyy' } })).json, { fejl: 'ukendt' });
  const r = await v.kald('POST', '/api/ordre', { body: { noegle: NOEGLE } });
  assert.deepEqual([r.status, r.json], [429, { fejl: 'loft' }]);
  assert.equal((await v.kald('POST', '/api/ordre', { ip: '198.51.100.200', body: { noegle: NOEGLE } })).status, 200);
});

// ---------- gem og designs ----------
test('pris_ved_gem = designets egen pris inkl. moms uden levering (som bjælken), i øre', () => {
  // med afhentning (flatpack-produkter): afhentningens inkl, hvor leveringslinjen er 0 kr.
  assert.equal(prisUdenLevering([
    { form: 'flatpack', trin: 'afhent', inkl: 12200, linjer: [{ ex: 9760 }, { ex: 0 }] },
    { form: 'flatpack', trin: 'kantsten', inkl: 12767.5, linjer: [{ ex: 9760 }, { ex: 454 }] },
  ]), 12200);
  // uden afhentning (lockers: kun samlet): til kantsten minus den sidste linje (leveringen), plus 25 % moms
  assert.equal(prisUdenLevering([
    { form: 'samlet', trin: 'kantsten', inkl: 44853.75, linjer: [{ ex: 35300 }, { ex: 583 }] },
    { form: 'samlet', trin: 'baaret', inkl: 45498.75, linjer: [{ ex: 35300 }, { ex: 1099 }] },
  ]), 44125);
  // tvivl → null ("—"), aldrig en pris med levering
  assert.equal(prisUdenLevering([{ form: 'flatpack', trin: 'afhent', inkl: 100, linjer: [{ ex: 70 }, { ex: 10 }] }]), null);
  assert.equal(prisUdenLevering([{ form: 'samlet', trin: 'baaret', inkl: 100, linjer: [{ ex: 70 }, { ex: 10 }] }]), null);
  assert.equal(prisUdenLevering([]), null);
  assert.equal(prisUdenLevering(null), null);
});

test('Gem: prisen regnes af /pris (bjælkens grundlag), aldrig af klienten; uden pris gemmes "—"', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  const t = kodT({ bredde: 60, hoejde: 220 });
  const r = await v.kald('POST', '/api/gem', { origin: DESIGNER, cookie: token, body: { produkt: 'hoejskab', t, pris_oere: 1, navn: '' } });
  assert.deepEqual(r.json, { ok: true, id: r.json.id, pris_oere: 1220000 });
  const u = v.pris.kald.at(-1);
  assert.equal(`${u.origin}${u.pathname}`, 'https://api.neminventar.dk/pris');
  assert.equal(u.searchParams.get('p'), 'hoejskab');
  assert.equal(u.searchParams.get('t'), t);
  assert.equal(u.searchParams.get('format'), 'json');
  assert.deepEqual(v.bro.leads.at(-1), { handling: 'design_gemt', email: EJER, produkt: 'hoejskab', t, pris_oere: 1220000 });

  v.pris.status = 503;
  v.frem(1000);
  const uden = await v.kald('POST', '/api/gem', { cookie: token, body: { produkt: 'hoejskab', t, navn: 'Gangen' } });
  assert.equal(uden.json.pris_oere, null);
  const side = await v.kald('GET', '/api/min-side', { cookie: token });
  assert.deepEqual(side.json.designs.map((d) => [d.navn, d.pris_oere, d.t]), [['Gangen', null, t], ['Højskab 60 × 220', 1220000, t]]);

  assert.deepEqual((await v.kald('POST', '/api/gem', { cookie: token, body: { produkt: 'Hoejskab!', t } })).json, { fejl: 'design' });
  assert.deepEqual((await v.kald('POST', '/api/gem', { cookie: token, body: { produkt: 'hoejskab', t: 'ikke base64 {' } })).json, { fejl: 'design' });
  assert.deepEqual((await v.kald('POST', '/api/gem', { cookie: token, body: { produkt: 'hoejskab', t, navn: 'x'.repeat(81) } })).json, { fejl: 'navn' });
  const ud = await v.kald('POST', '/api/gem', { origin: DESIGNER, body: { produkt: 'hoejskab', t } });
  assert.deepEqual([ud.status, ud.json], [401, { fejl: 'login' }]);
});

test('Designs: omdøb og slet kun egne (ejerskabet ligger i forespørgslen)', async () => {
  const v = lavVerden();
  const a = await v.logInd(EJER);
  const b = await v.logInd('b@example.com');
  const id = (await v.kald('POST', '/api/gem', { cookie: a.token, body: { produkt: 'hoejskab', t: kodT({ bredde: 60 }) } })).json.id;
  assert.deepEqual((await v.kald('POST', '/api/design/navn', { cookie: b.token, body: { id, navn: 'Mit' } })).json, { fejl: 'ukendt' });
  assert.deepEqual((await v.kald('POST', '/api/design/slet', { cookie: b.token, body: { id } })).json, { fejl: 'ukendt' });
  assert.deepEqual((await v.kald('POST', '/api/design/navn', { cookie: a.token, body: { id, navn: '  Skab   i\tgangen ' } })).json, { ok: true });
  assert.equal([...v.db.s.designs.values()][0].navn, 'Skab i gangen');
  assert.deepEqual((await v.kald('POST', '/api/design/navn', { cookie: a.token, body: { id, navn: '' } })).json, { fejl: 'navn' });
  assert.deepEqual((await v.kald('POST', '/api/design/slet', { cookie: a.token, body: { id: 'ikke-et-id' } })).json, { fejl: 'ukendt' });
  assert.deepEqual((await v.kald('POST', '/api/design/slet', { cookie: a.token, body: { id } })).json, { ok: true });
  assert.equal(v.db.s.designs.size, 0);
});

test('Ikke min og skjul "gemt uden login": broen får sessionens e-mail, aldrig en e-mail fra body', async () => {
  const v = lavVerden();
  const { token } = await v.logInd();
  assert.deepEqual((await v.kald('POST', '/api/ikke-min', { cookie: token, body: { ref: REF, email: 'andens@example.com' } })).json, { ok: true });
  assert.deepEqual(v.bro.ikkeMin, [{ email: EJER, ref: REF }]);
  assert.deepEqual((await v.kald('POST', '/api/gemt-uden-login/skjul', { cookie: token, body: { id: 77, email: 'andens@example.com' } })).json, { ok: true });
  assert.deepEqual(v.bro.skjulte, [{ email: EJER, id: 77 }]);
  assert.deepEqual((await v.kald('POST', '/api/gemt-uden-login/skjul', { cookie: token, body: { id: 'drop table' } })).json, { fejl: 'ukendt' });
  assert.deepEqual((await v.kald('POST', '/api/ikke-min', { body: { ref: REF } })).json, { fejl: 'login' });
});

// ---------- log ind og log ud ----------
test('Log ind: e-mail i små bogstaver, kode med mellemrum, "ny" kun første gang; log ud alle steder', async () => {
  const v = lavVerden();
  await v.kald('POST', '/api/kode', { body: { email: '  Mette.Holm@Example.COM ', turnstile: 'tok' } });
  const kode = senesteKode(v, EJER);
  const r = await v.kald('POST', '/api/kode/tjek', { body: { email: 'mette.holm@example.com', kode: `${kode.slice(0, 3)} ${kode.slice(3)}` } });
  assert.deepEqual(r.json, { ok: true, retur: null, ny: true });
  assert.deepEqual((await v.kald('POST', '/api/kode/tjek', { body: { email: EJER, kode: '12345' } })).json, { fejl: 'kort' });
  assert.deepEqual((await v.kald('POST', '/api/kode', { body: { email: 'ikke en mail', turnstile: 'tok' } })).json, { fejl: 'email' });
  assert.deepEqual((await v.kald('POST', '/api/kode', { body: { email: EJER, turnstile: 'tok', formaal: 'slet' } })).json, { fejl: 'formaal' });

  v.frem(16 * MIN);
  const a = await v.logInd();
  assert.equal(a.svar.json.ny, false);
  v.frem(16 * MIN);
  const b = await v.logInd();
  assert.equal(v.db.s.kunder.size, 1);
  const alle = await v.kald('POST', '/api/log-ud', { cookie: a.token, body: { alle: true } });
  assert.deepEqual(alle.json, { ok: true });
  assert.equal((await v.kald('GET', '/api/mig', { cookie: b.token })).json.logget_ind, false);
  assert.ok([...v.db.s.sessioner.values()].every((s) => s.lukket));
});

test('Router: ukendt sti 404, forkert metode 405, for stor body 413, ugyldig JSON 400', async () => {
  const v = lavVerden();
  assert.equal((await v.kald('GET', '/api/admin')).status, 404);
  assert.equal((await v.kald('GET', '/api/kode')).status, 405);
  assert.equal((await v.kald('POST', '/api/mig')).status, 405);
  assert.equal((await v.kald('POST', '/api/gem', { raa: JSON.stringify({ t: 'x'.repeat(20_000) }) })).status, 413);
  assert.deepEqual((await v.kald('POST', '/api/kode', { raa: '{"email":' })).json, { fejl: 'json' });
  assert.deepEqual((await v.kald('POST', '/api/kode', { raa: '[1,2]' })).json, { fejl: 'json' });
});

// ---------- Pages-videresenderen og konfigurationen ----------
test('Pages-funktionen sender anmodningen uændret til service bindingen KONTO og svaret uændret tilbage', async () => {
  const req = new Request('https://konto.neminventar.dk/api/kode', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: KONTO, cookie: '__Host-ni_konto=abc', 'cf-connecting-ip': '203.0.113.7' },
    body: '{"email":"a@b.dk"}',
  });
  let fik;
  const svar = new Response('{"ok":true}', { status: 200, headers: { 'set-cookie': 'x=y' } });
  const res = await onRequest({ request: req, env: { KONTO: { fetch: async (r) => { fik = r; return svar; } } } });
  assert.equal(fik, req);
  assert.equal(res, svar);
  const kilde = fil('../../functions/api/[[sti]].js');
  assert.doesNotMatch(kilde, /import|fetch\(\s*['"`]|SECRET|HEMMELIG/i);
});

test('wrangler: produktionens flag er false, staging hedder ni-konto-backend-staging, ingen offentlig rute', () => {
  const w = fil('../wrangler.toml');
  const afsnit = (navn) => w.split(/^\[/m).find((x) => x.startsWith(`${navn}]`)) ?? '';
  assert.match(afsnit('env.production.vars'), /ORDRESTATUS_AKTIV = "false"/);
  assert.match(afsnit('env.production.vars'), /KONTO_AKTIV = "false"/);
  assert.match(afsnit('env.production.vars'), /MILJOE = "prod"/);
  assert.match(afsnit('vars'), /KONTO_AKTIV = "false"/);
  assert.match(afsnit('env.staging'), /name = "ni-konto-backend-staging"/);
  assert.match(afsnit('env.staging.vars'), /TEST_HVIDLISTE = "js@neminventar.dk,kontakt@neminventar.dk,tilbud@neminventar.dk"/);
  assert.match(afsnit('env.staging.vars'), /konto-bro-staging/);
  assert.doesNotMatch(w, /^\s*(route|routes)\s*=/m);
  assert.equal((w.match(/workers_dev = false/g) ?? []).length, 3);
  assert.doesNotMatch(w, /^(KODE_PEBER_1|BRO_HEMMELIGHED_1|TURNSTILE_SECRET|NI_KONTO_SERVICE_KEY)\s*=/m);
  const p = fil('../../wrangler.toml');
  assert.match(p, /name = "ni-konto"/);
  assert.match(p, /\[\[env\.production\.services\]\]\nbinding = "KONTO"\nservice = "ni-konto-backend"\n/);
  assert.match(p, /\[\[env\.preview\.services\]\]\nbinding = "KONTO"\nservice = "ni-konto-backend-staging"\n/);
});

void broOrdre;
