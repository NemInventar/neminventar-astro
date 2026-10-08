// node --test src/lib/api.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_AKTIV, API_BASE, FORMULAR_DIREKTE, PLAUSIBLE_SCRIPT, formularFetch, uploadAdresse, plausibleViaApi } from './api.ts';

const S = 'https://guhbrpektblabndqttgp.supabase.co';
const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"dry_run":true}' };

function mock(...svar: (Response | Error)[]) {
  const kald: string[] = [];
  const f = (async (u: string) => {
    kald.push(String(u));
    const s = svar.shift();
    if (s instanceof Error) throw s;
    return s ?? new Response('{}');
  }) as unknown as typeof fetch;
  return { f, kald };
}

test('adresserne', () => {
  assert.equal(typeof API_AKTIV, 'boolean');
  assert.equal(API_BASE, 'https://api.neminventar.dk');
  assert.equal(FORMULAR_DIREKTE, `${S}/functions/v1/contact-form`);
});

test('flag falsk: direkte til supabase.co, ét kald, fejl kastes som før', async () => {
  const m = mock(new Response('{"success":true}'));
  const { res, via } = await formularFetch(init, false, m.f);
  assert.deepEqual(m.kald, [FORMULAR_DIREKTE]);
  assert.equal(via, 'direkte');
  assert.equal(res.status, 200);
  const m2 = mock(new TypeError('Failed to fetch'));
  await assert.rejects(formularFetch(init, false, m2.f), TypeError);
  assert.equal(m2.kald.length, 1, 'ingen ekstra forsøg med flaget slået fra');
});

test('flag sandt: via proxyen', async () => {
  const m = mock(new Response('{"success":true}'));
  const { via } = await formularFetch(init, true, m.f);
  assert.deepEqual(m.kald, [`${API_BASE}/contact-form`]);
  assert.equal(via, 'api');
});

test('flag sandt + netværksfejl (TypeError): supabase.co prøves én gang', async () => {
  const m = mock(new TypeError('Failed to fetch'), new Response('{"success":true}'));
  const { res, via } = await formularFetch(init, true, m.f);
  assert.deepEqual(m.kald, [`${API_BASE}/contact-form`, FORMULAR_DIREKTE]);
  assert.equal(via, 'direkte');
  assert.equal(res.status, 200);
});

test('flag sandt + netværksfejl begge steder: fejlen kastes, kun to kald', async () => {
  const m = mock(new TypeError('a'), new TypeError('b'));
  await assert.rejects(formularFetch(init, true, m.f), TypeError);
  assert.equal(m.kald.length, 2);
});

test('flag sandt + HTTP-svar (også 5xx): ingen nyt forsøg', async () => {
  for (const status of [400, 429, 500, 502]) {
    const m = mock(new Response('{"error":"x"}', { status }));
    const { res, via } = await formularFetch(init, true, m.f);
    assert.deepEqual(m.kald, [`${API_BASE}/contact-form`], `status ${status}`);
    assert.equal(res.status, status);
    assert.equal(via, 'api');
  }
});

test('flag sandt + anden fejl end TypeError: kastes uden nyt forsøg', async () => {
  const m = mock(new Error('AbortError'));
  await assert.rejects(formularFetch(init, true, m.f), /AbortError/);
  assert.equal(m.kald.length, 1);
});

test('uploadAdresse: host skrives om til proxyen, kun når kaldet gik via api', () => {
  const u = `${S}/storage/v1/object/upload/sign/web-henvendelser/2026-10/abc/tegning%20A.pdf?token=eyJ.x.y`;
  assert.equal(uploadAdresse(u, 'api'), `${API_BASE}/storage/v1/object/upload/sign/web-henvendelser/2026-10/abc/tegning%20A.pdf?token=eyJ.x.y`);
  assert.equal(uploadAdresse(u, 'direkte'), u);
  // Andre adresser røres ikke
  const fremmed = 'https://example.com/storage/v1/object/upload/sign/a?token=t';
  assert.equal(uploadAdresse(fremmed, 'api'), fremmed);
  const offentlig = `${S}/storage/v1/object/public/a/b.png`;
  assert.equal(uploadAdresse(offentlig, 'api'), offentlig);
  assert.equal(uploadAdresse('ikke en url', 'api'), 'ikke en url');
});

// Kør snippet'et mod en lille falsk DOM: endpoint sat, script fra proxyen, fallback til plausible.io ved fejl.
function kør(js: string) {
  const scripts: any[] = [];
  const window: any = {};
  const document = { createElement: () => ({}), head: { appendChild: (s: any) => scripts.push(s) } };
  new Function('window', 'document', 'plausible', `${js}\nreturn window;`)(window, document, undefined);
  return { window, scripts };
}

test('plausibleViaApi: endpoint og script via proxyen; sitets egen init() beholder endpointet', () => {
  const { window, scripts } = kør(plausibleViaApi('https://api.neminventar.dk'));
  assert.equal(window.plausible.o.endpoint, 'https://api.neminventar.dk/api/event');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://api.neminventar.dk/js/script.js');
  assert.equal(scripts[0].async, true);
  // Sitets uændrede snippet: plausible.init = plausible.init || …; plausible.init();
  window.plausible.init();
  assert.equal(window.plausible.o.endpoint, 'https://api.neminventar.dk/api/event');
  // Kø'en virker før scriptet er hentet
  window.plausible('Mail', { props: { side: '/' } });
  assert.equal(window.plausible.q.length, 1);
});

test('plausibleViaApi: kan scriptet ikke hentes fra proxyen → plausible.io for både script og events', () => {
  const { window, scripts } = kør(plausibleViaApi('https://api.neminventar.dk'));
  scripts[0].onerror();
  assert.equal(scripts.length, 2);
  assert.equal(scripts[1].src, PLAUSIBLE_SCRIPT);
  assert.equal(window.plausible.o.endpoint, 'https://plausible.io/api/event');
  window.plausible.init();
  assert.equal(window.plausible.o.endpoint, 'https://plausible.io/api/event');
});
