// konto/public/_headers: præcis de headere, plan-teknik-v3 §2 "Kundeflade" og R18 kræver — og ikke andre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FIL = new URL('../public/_headers', import.meta.url);

export function laesHeaders(tekst) {
  const regler = new Map();
  let sti = null;
  for (const raa of tekst.split(/\r?\n/)) {
    if (!raa.trim() || raa.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raa)) {
      sti = raa.trim();
      assert.ok(!regler.has(sti), `${sti} står to gange`);
      regler.set(sti, new Map());
      continue;
    }
    const i = raa.indexOf(':');
    assert.ok(sti && i > 0, `linjen hører ikke til en sti: ${raa}`);
    const navn = raa.slice(0, i).trim().toLowerCase();
    assert.ok(!regler.get(sti).has(navn), `${navn} står to gange under ${sti}`);
    regler.get(sti).set(navn, raa.slice(i + 1).trim());
  }
  return regler;
}

const csp = (v) => new Map(v.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const [navn, ...kilder] = d.split(/\s+/);
  return [navn, kilder];
}));

test('_headers: præcis to regler med præcis de krævede headere', () => {
  const r = laesHeaders(readFileSync(FIL, 'utf8'));
  assert.deepEqual([...r.keys()], ['/*', '/ordre/*']);
  assert.deepEqual([...r.get('/*').keys()].sort(), [
    'content-security-policy', 'referrer-policy', 'strict-transport-security', 'x-content-type-options', 'x-robots-tag',
  ]);
  assert.deepEqual([...r.get('/ordre/*').entries()], [['cache-control', 'private, no-store']], 'R18 på /ordre/');
  const h = r.get('/*');
  assert.equal(h.get('referrer-policy'), 'no-referrer');
  assert.match(h.get('strict-transport-security'), /^max-age=(\d+)/);
  assert.ok(Number(/max-age=(\d+)/.exec(h.get('strict-transport-security'))[1]) >= 31536000, 'HSTS mindst et år');
  assert.equal(h.get('x-content-type-options'), 'nosniff');
  assert.equal(h.get('x-robots-tag'), 'noindex, nofollow', 'siderne er noindex (Fable b)');
});

test('CSP uden unsafe-inline: script-src self + Turnstile, connect-src self + api.neminventar.dk, frame-ancestors none', () => {
  const r = laesHeaders(readFileSync(FIL, 'utf8'));
  const p = csp(r.get('/*').get('content-security-policy'));
  const v = r.get('/*').get('content-security-policy');
  assert.ok(!/unsafe-inline|unsafe-eval|unsafe-hashes|\*|data:|blob:|http:/.test(v), v);
  assert.deepEqual(p.get('default-src'), ["'none'"]);
  assert.deepEqual(p.get('script-src'), ["'self'", 'https://challenges.cloudflare.com']);
  assert.deepEqual(p.get('style-src'), ["'self'"]);
  assert.deepEqual(p.get('connect-src'), ["'self'", 'https://api.neminventar.dk']);
  assert.deepEqual(p.get('frame-src'), ['https://challenges.cloudflare.com']);
  assert.deepEqual(p.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(p.get('base-uri'), ["'none'"]);
  assert.deepEqual(p.get('form-action'), ["'self'"]);
  assert.deepEqual(p.get('img-src'), ["'self'"]);
  assert.deepEqual(p.get('font-src'), ["'self'"]);
});
