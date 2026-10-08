// node --test api/test/
// Rutningen i proxyen bag api.neminventar.dk. fetch (og Cache API) mockes — intet sendes ud.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';

const S = 'https://guhbrpektblabndqttgp.supabase.co';
const A = 'https://api.neminventar.dk';
const PA = 'https://plausible.io/js/pa-HNaluSTt8ee5v0U7h3J8z.js';

let kald, svar, ægteFetch;
beforeEach(() => {
  kald = [];
  svar = () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': 'https://neminventar.dk', vary: 'Origin' } });
  ægteFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? await new Response(init.body).text() : null;
    kald.push({ url: String(url), method: init.method ?? 'GET', headers: new Headers(init.headers), body });
    return svar(url, init);
  };
});
afterEach(() => { globalThis.fetch = ægteFetch; delete globalThis.caches; });

const req = (sti, init = {}) => worker.fetch(new Request(A + sti, init), {}, { waitUntil() {} });
const BESOEG = { origin: 'https://neminventar.dk', 'cf-connecting-ip': '203.0.113.7', cookie: 'hemmelig=1', 'user-agent': 'Mozilla/5.0 Test' };

test('GET /contact-form → funktionen med origin; svaret kommer uændret tilbage', async () => {
  svar = () => new Response('{"name":"contact-form","version":9}', { status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': 'https://neminventar.dk', vary: 'Origin' } });
  const r = await req('/contact-form', { headers: BESOEG });
  assert.equal(kald.length, 1);
  assert.equal(kald[0].url, `${S}/functions/v1/contact-form`);
  assert.equal(kald[0].method, 'GET');
  assert.equal(kald[0].headers.get('origin'), 'https://neminventar.dk');
  assert.equal(kald[0].headers.get('x-forwarded-for'), '203.0.113.7');
  assert.equal(kald[0].body, null);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://neminventar.dk');
  assert.equal(r.headers.get('vary'), 'Origin');
  assert.equal((await r.json()).version, 9);
});

test('POST /contact-form → metode, body, content-type, origin og IP videre; ingen cookie', async () => {
  const body = JSON.stringify({ name: 'Test', dry_run: true });
  await req('/contact-form', { method: 'POST', headers: { ...BESOEG, 'content-type': 'application/json' }, body });
  assert.equal(kald[0].method, 'POST');
  assert.equal(kald[0].body, body);
  assert.equal(kald[0].headers.get('content-type'), 'application/json');
  assert.equal(kald[0].headers.get('origin'), 'https://neminventar.dk');
  assert.equal(kald[0].headers.get('x-forwarded-for'), '203.0.113.7');
  assert.equal(kald[0].headers.get('cookie'), null);
  assert.equal(kald[0].headers.get('user-agent'), null);
});

test('OPTIONS /contact-form → preflight videre; funktionens CORS-headere og status uændret', async () => {
  svar = () => new Response('ok', { status: 200, headers: { 'access-control-allow-origin': 'https://www.neminventar.dk', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
  const r = await req('/contact-form', { method: 'OPTIONS', headers: { origin: 'https://www.neminventar.dk', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
  assert.equal(kald[0].method, 'OPTIONS');
  assert.equal(kald[0].headers.get('access-control-request-method'), 'POST');
  assert.equal(kald[0].headers.get('access-control-request-headers'), 'content-type');
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://www.neminventar.dk');
  assert.equal(r.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});

test('HTTP-fejl fra funktionen sendes uændret tilbage (ingen omskrivning)', async () => {
  svar = () => new Response('{"error":"Ugyldig e-mail"}', { status: 400, headers: { 'content-type': 'application/json', 'access-control-allow-origin': 'https://neminventar.dk' } });
  const r = await req('/contact-form', { method: 'POST', headers: { ...BESOEG, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'Ugyldig e-mail');
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://neminventar.dk');
});

test('PUT upload → samme sti og query (token) på supabase.co, body og content-type videre', async () => {
  const sti = '/storage/v1/object/upload/sign/web-henvendelser/2026-10/abc/tegning%20A.pdf?token=eyJ.x.y';
  const r = await req(sti, { method: 'PUT', headers: { ...BESOEG, 'content-type': 'application/pdf' }, body: '%PDF-1.7 test' });
  assert.equal(kald[0].url, S + sti);
  assert.equal(kald[0].method, 'PUT');
  assert.equal(kald[0].body, '%PDF-1.7 test');
  assert.equal(kald[0].headers.get('content-type'), 'application/pdf');
  assert.equal(kald[0].headers.get('x-forwarded-for'), '203.0.113.7');
  assert.equal(kald[0].headers.get('cookie'), null);
  assert.equal(r.status, 200);
});

test('OPTIONS upload → preflight videre til Storage', async () => {
  svar = () => new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'PUT' } });
  const r = await req('/storage/v1/object/upload/sign/web-henvendelser/a/b.pdf?token=t', { method: 'OPTIONS', headers: { origin: 'https://neminventar.dk', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'content-type' } });
  assert.equal(kald[0].url, `${S}/storage/v1/object/upload/sign/web-henvendelser/a/b.pdf?token=t`);
  assert.equal(kald[0].method, 'OPTIONS');
  assert.equal(kald[0].headers.get('access-control-request-method'), 'PUT');
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
});

test('GET /js/script.js → Plausible-scriptet med cache 1 dag; andet kald tages fra cachen', async () => {
  const gemt = new Map();
  globalThis.caches = { default: {
    match: async (k) => gemt.get(k.url)?.clone(),
    put: async (k, r) => { gemt.set(k.url, r); },
  } };
  svar = () => new Response('!function(){}()', { status: 200, headers: { 'content-type': 'application/javascript', 'cache-control': 'public, max-age=60' } });
  const r = await req('/js/script.js?v=1');
  assert.equal(kald[0].url, PA);
  assert.equal(r.headers.get('content-type'), 'application/javascript');
  assert.equal(r.headers.get('cache-control'), 'public, max-age=86400');
  assert.equal(await r.text(), '!function(){}()');
  const r2 = await req('/js/script.js');
  assert.equal(kald.length, 1, 'andet kald rammer cachen');
  assert.equal(await r2.text(), '!function(){}()');
});

test('GET /js/script.js uden Cache API (fx lokalt) virker også', async () => {
  svar = () => new Response('x', { status: 200, headers: { 'content-type': 'application/javascript' } });
  const r = await req('/js/script.js');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=86400');
});

test('POST /api/event → plausible.io med user-agent, content-type, body og X-Forwarded-For; ingen cookie', async () => {
  svar = () => new Response('ok', { status: 202 });
  const body = '{"name":"pageview","url":"https://neminventar.dk/","domain":"neminventar.dk"}';
  const r = await req('/api/event', { method: 'POST', headers: { ...BESOEG, 'content-type': 'text/plain' }, body });
  assert.equal(kald[0].url, 'https://plausible.io/api/event');
  assert.equal(kald[0].method, 'POST');
  assert.equal(kald[0].body, body);
  assert.equal(kald[0].headers.get('user-agent'), 'Mozilla/5.0 Test');
  assert.equal(kald[0].headers.get('content-type'), 'text/plain');
  assert.equal(kald[0].headers.get('x-forwarded-for'), '203.0.113.7');
  assert.equal(kald[0].headers.get('cookie'), null);
  assert.equal(kald[0].headers.get('origin'), null);
  assert.equal(r.status, 202);
});

test('alt andet er 404, og upstream kaldes ikke', async () => {
  const forkerte = [
    ['/', 'GET'], ['/contact-form', 'PUT'], ['/contact-form', 'DELETE'], ['/contact-form/', 'POST'],
    ['/functions/v1/contact-form', 'POST'], ['/storage/v1/object/upload/sign/', 'PUT'],
    ['/storage/v1/object/upload/sign/a/b.pdf?token=t', 'GET'], ['/storage/v1/object/upload/sign/a/b.pdf', 'POST'],
    ['/storage/v1/object/public/a/b.png', 'GET'], ['/storage/v1/object/web-henvendelser/a.pdf', 'PUT'],
    ['/js/script.js', 'POST'], ['/js/pa-HNaluSTt8ee5v0U7h3J8z.js', 'GET'], ['/api/event', 'GET'], ['/api/event/', 'POST'],
    ['/rest/v1/projects', 'GET'],
  ];
  for (const [sti, method] of forkerte) {
    const r = await req(sti, { method, ...(method === 'GET' || method === 'HEAD' ? {} : { body: 'x' }) });
    assert.equal(r.status, 404, `${method} ${sti}`);
  }
  assert.equal(kald.length, 0);
});

test('upstream kan ikke nås → 502 uden CORS (browseren falder selv tilbage til supabase.co)', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  const r = await req('/contact-form', { method: 'POST', headers: { ...BESOEG, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 502);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});
