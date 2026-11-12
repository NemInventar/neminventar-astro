// Buildet (begge udgivelser) til en midlertidig mappe og scannet: streng CSP kræver, at HTML'en hverken har inline
// <script>, <style>, style= eller on…=-attributter (review-samlet nr. 3). Udgivelse 1 nævner intet om Min side.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { byg } from '../scripts/byg.mjs';

const MAPPE = mkdtempSync(path.join(tmpdir(), 'ni-konto-build-'));
const U1 = path.join(MAPPE, 'u1');
const U2 = path.join(MAPPE, 'u2');

function filer(dir, ud = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) filer(f, ud); else ud.push(f);
  }
  return ud;
}
const html = (dir) => filer(dir).filter((f) => f.endsWith('.html'));

before(async () => {
  // Efter hinanden: to builds på samme tid deler Astros cache og vælter hinanden
  await byg({ udgivelse: 1, ud: U1 });
  await byg({ udgivelse: 2, ud: U2 });
}, { timeout: 240_000 });

process.on('exit', () => { try { rmSync(MAPPE, { recursive: true, force: true }); } catch { /* ok */ } });

test('ingen inline <script>, <style>, style= eller on…= i HTML\'en (begge udgivelser)', () => {
  for (const dir of [U1, U2]) {
    const sider = html(dir);
    assert.ok(sider.length >= 2, dir);
    for (const f of sider) {
      const h = readFileSync(f, 'utf8');
      const rel = path.relative(MAPPE, f);
      for (const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        assert.match(m[1], /\bsrc="\/_astro\/[^"]+\.js"/, `${rel}: <script> uden src`);
        assert.equal(m[2].trim(), '', `${rel}: <script> med indhold`);
      }
      assert.ok(!/<style\b/i.test(h), `${rel}: <style>`);
      assert.ok(!/\sstyle\s*=/i.test(h), `${rel}: style=`);
      assert.ok(!/\son[a-z]+\s*=/i.test(h), `${rel}: on…=`);
      assert.ok(!/javascript:/i.test(h), `${rel}: javascript:`);
      assert.ok(!/src="data:|href="data:/i.test(h), `${rel}: data:-URL`);
    }
  }
});

test('kun egne filer: scripts, CSS og fonte fra /_astro/, intet fra Supabase eller fremmede CDN\'er', () => {
  for (const dir of [U1, U2]) {
    for (const f of html(dir)) {
      const h = readFileSync(f, 'utf8');
      for (const m of h.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/gi)) {
        assert.ok(m[1].startsWith('/'), `${path.relative(MAPPE, f)}: ${m[1]}`);
      }
    }
    for (const f of filer(path.join(dir, '_astro')).filter((x) => /\.(js|css)$/.test(x))) {
      const s = readFileSync(f, 'utf8');
      assert.ok(!/supabase\.co|plausible\.io|googleapis|gstatic/.test(s), path.relative(MAPPE, f));
      assert.ok(!/url\(\s*["']?data:/.test(s), `${path.relative(MAPPE, f)}: data: i CSS (assetsInlineLimit 0)`);
    }
  }
});

test('siderne er noindex og bærer udgivelsen; _headers kommer med', () => {
  for (const dir of [U1, U2]) {
    assert.ok(existsSync(path.join(dir, '_headers')));
    for (const f of html(dir)) assert.ok(readFileSync(f, 'utf8').includes('<meta name="robots" content="noindex, nofollow">'), f);
  }
  assert.ok(readFileSync(path.join(U1, 'ordre', 'index.html'), 'utf8').includes('data-udgivelse="1"'));
  assert.ok(readFileSync(path.join(U2, 'ordre', 'index.html'), 'utf8').includes('data-udgivelse="2"'));
});

test('udgivelse 1: kun ordresiden, intet om Min side eller log ind; adresserne sendes til neminventar.dk', () => {
  assert.ok(existsSync(path.join(U1, 'ordre', 'index.html')));
  for (const s of ['index.html', 'en/index.html', 'min-side/index.html', 'en/min-side/index.html']) {
    assert.ok(!existsSync(path.join(U1, s)), `${s} findes i udgivelse 1`);
  }
  for (const f of html(U1)) {
    const h = readFileSync(f, 'utf8');
    assert.ok(!/Min side|My account|konto\.neminventar\.dk\//.test(h.replace(/<script[\s\S]*?<\/script>/g, '')), `${path.relative(MAPPE, f)} nævner Min side`);
  }
  const r = readFileSync(path.join(U1, '_redirects'), 'utf8');
  assert.match(r, /^\/ https:\/\/neminventar\.dk\/ 302$/m);
  assert.match(r, /^\/min-side\/ https:\/\/neminventar\.dk\/ 302$/m);
  assert.ok(!/ordre/.test(r), 'ordresiden sendes aldrig videre');
});

test('udgivelse 2: log ind og Min side på dansk og engelsk, "Min side" i header og footer', () => {
  for (const s of ['index.html', 'en/index.html', 'min-side/index.html', 'en/min-side/index.html', 'ordre/index.html', '404.html']) {
    assert.ok(existsSync(path.join(U2, s)), s);
  }
  const forside = readFileSync(path.join(U2, 'index.html'), 'utf8');
  assert.ok(forside.includes('class="nav-min"'), 'Min side i headeren');
  assert.ok(/<footer[\s\S]*<a href="https:\/\/konto\.neminventar\.dk\/"[^>]*>Min side<\/a>[\s\S]*<\/footer>/.test(forside), 'Min side i footeren');
  assert.ok(forside.includes('Log ind eller opret konto'), 'første trin står i HTML\'en');
  assert.ok(forside.includes('data-turnstile="'), 'Turnstile-nøglen på log ind');
  assert.ok(!readFileSync(path.join(U2, 'ordre', 'index.html'), 'utf8').includes('data-turnstile'), 'ordresiden henter ikke Turnstile');
  const en = readFileSync(path.join(U2, 'en', 'index.html'), 'utf8');
  assert.ok(en.includes('<html lang="en">') && en.includes('Log in or create an account') && en.includes('My account'));
  assert.equal(readFileSync(path.join(U2, '_redirects'), 'utf8'), '');
});

test('noscript-teksten (Fable d4) på siderne med JavaScript', () => {
  const h = readFileSync(path.join(U1, 'ordre', 'index.html'), 'utf8');
  assert.ok(h.includes('<noscript>') && h.includes('Siden kan ikke vises, fordi JavaScript er slået fra i din browser.'));
  // engelsk på /en/ og /en/min-side/ (Fable runde 4, afsnit 10)
  for (const s of ['en/index.html', 'en/min-side/index.html']) {
    const en = readFileSync(path.join(U2, s), 'utf8');
    assert.ok(en.includes('This page cannot be shown because JavaScript is turned off in your browser.'), s);
  }
});

test('404: første sætning er overskriften, resten brødtekst — samme tekst i begge udgivelser (Fable runde 4, afsnit 3)', () => {
  for (const dir of [U1, U2]) {
    const f = path.join(dir, '404.html');
    if (!existsSync(f)) continue;
    const h = readFileSync(f, 'utf8');
    assert.match(h, /<h1[^>]*>Siden findes ikke\.<\/h1>/, dir);
    assert.ok(/<p class="sub"[^>]*>Leder du efter din bestilling, så brug linket i ordrebekræftelsen, eller ring på <a [^>]*>\+45 42 42 26 84<\/a>\.<\/p>/.test(h), dir);
  }
  assert.ok(existsSync(path.join(U2, '404.html')));
});
