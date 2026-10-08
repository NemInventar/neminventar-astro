// node --test src/integrations/lokale-billeder.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findUrler, filnavn, erstat, lokaliser, slug } from './lokale-billeder.mjs';

const S = 'https://guhbrpektblabndqttgp.supabase.co';
const R = (navn, w) => `${S}/storage/v1/render/image/public/quote-renders/a/${navn}?width=${w}&resize=contain&quality=72`;
const FORM = `${S}/functions/v1/contact-form`;

test('img, srcset og data-src: relativ webp; &amp; afkodes', () => {
  const u = R('x.jpg', 800).replaceAll('&', '&amp;');
  const html = `<img src="${u}"><img srcset="${u} 800w, ${u.replace('800', '1200')} 1200w"><a data-src="${u}">`;
  const f = findUrler(html, '.html');
  assert.equal(f.length, 4);
  assert.ok(f.every((x) => !x.absolut && x.format === 'web'));
  assert.equal(f[0].url, R('x.jpg', 800));
  assert.equal(html.slice(f[0].start, f[0].end), u);
});

test('og:image, twitter:image og JSON-LD: absolut og originalformat', () => {
  const html = `<meta property="og:image" content="${R('x.jpg', 1200).replaceAll('&', '&amp;')}">` +
    `<script type="application/ld+json">{"image":"${R('x.jpg', 1200)}"}</script><img src="${R('x.jpg', 800)}">`;
  const f = findUrler(html, '.html');
  assert.deepEqual(f.map((x) => [x.absolut, x.format]), [[true, 'org'], [true, 'org'], [false, 'web']]);
  assert.equal(f[0].url, f[1].url);
});

test('formular-endpointet og andre domæner røres ikke', () => {
  assert.equal(findUrler(`fetch("${FORM}"); <img src="https://example.com/a.jpg">`, '.html').length, 0);
});

test('astro-island-props (&quot;) og CSS url() afgrænses rigtigt', () => {
  const html = `<astro-island props="{&quot;img&quot;:[0,&quot;${R('x.jpg', 640).replaceAll('&', '&amp;')}&quot;]}">` +
    `<div style="background:url(${R('y.png', 400)})">`;
  const f = findUrler(html, '.html');
  assert.deepEqual(f.map((x) => x.url), [R('x.jpg', 640), R('y.png', 400)]);
});

test('json: absolut webp', () => {
  const f = findUrler(JSON.stringify({ img: R('x.jpg', 480) }), '.json');
  assert.equal(f.length, 1);
  assert.ok(f[0].absolut);
  assert.equal(f[0].format, 'web');
});

test('filnavn: samme kilde-id på tværs af bredder, læsbart navn, ext efter indholdstype', () => {
  const a = filnavn(R('33_Lockere røde.jpg', 800), 'image/webp');
  const b = filnavn(R('33_Lockere røde.jpg', 1200), 'image/jpeg');
  assert.match(a, /^33_lockere-roede-[0-9a-f]{8}-w800\.webp$/);
  assert.match(b, /^33_lockere-roede-[0-9a-f]{8}-w1200\.jpg$/);
  assert.equal(a.split('-w')[0], b.split('-w')[0]);
  // andre parametre end standard (quality=72, resize=contain) får et kort hash, så de ikke kolliderer
  assert.match(filnavn(R('x.jpg', 800).replace('quality=72', 'quality=60'), 'image/webp'), /-w800-[0-9a-f]{6}\.webp$/);
  assert.match(filnavn(`${S}/storage/v1/object/public/b/c/foto.png`, 'image/png'), /^foto-[0-9a-f]{8}-orig\.png$/);
  assert.equal(slug('Højskab Æble Å'), 'hoejskab-aeble-aa');
});

test('erstat: bagfra, så positionerne holder', () => {
  const t = 'a URL1 b URL2 c';
  const fund = [{ start: 2, end: 6, n: 1 }, { start: 9, end: 13, n: 2 }];
  assert.equal(erstat(t, fund, (f) => `/_b/${f.n}.webp`), 'a /_b/1.webp b /_b/2.webp c');
  assert.equal(erstat(t, fund, (f) => (f.n === 1 ? null : 'X')), 'a URL1 b X c');
});

test('lokaliser: 429 fra Supabase venter (Retry-After) og prøver igen', async (t) => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-'));
  const dist = path.join(tmp, 'dist');
  await fs.mkdir(dist, { recursive: true });
  await fs.writeFile(path.join(dist, 'index.html'), `<img src="${R('travl.jpg', 640)}">`);
  let n = 0;
  const ægte = globalThis.fetch;
  t.after(() => { globalThis.fetch = ægte; });
  globalThis.fetch = async () => (++n <= 2
    ? new Response('', { status: 429, headers: { 'retry-after': '1' } })
    : new Response('WEBP', { status: 200, headers: { 'content-type': 'image/webp', etag: '"e"' } }));
  const r = await lokaliser({ dist, cache: path.join(tmp, 'cache'), site: 'https://neminventar.dk', log: { info() {}, warn() {} } });
  assert.equal(n, 3);
  assert.equal(r.hentet, 1);
  assert.match(await fs.readFile(path.join(dist, 'index.html'), 'utf8'), /src="\/_b\/travl-[0-9a-f]{8}-w640\.webp"/);
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lokaliser: henter, beholder fjern URL ved fejl, genbruger cache (304) og klarer Supabase nede', async (t) => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-'));
  const dist = path.join(tmp, 'dist'), cache = path.join(tmp, 'cache');
  await fs.mkdir(path.join(dist, 'p'), { recursive: true });
  const god = R('god.jpg', 800), daarlig = R('mangler.jpg', 800);
  const side = `<meta property="og:image" content="${god.replaceAll('&', '&amp;')}"><img src="${god.replaceAll('&', '&amp;')}">` +
    `<img src="${daarlig.replaceAll('&', '&amp;')}"><script>fetch("${FORM}")</script>`;
  await fs.writeFile(path.join(dist, 'p', 'index.html'), side);
  await fs.writeFile(path.join(dist, 'data.json'), JSON.stringify({ img: god }));

  const kald = [];
  let tilstand = 'oppe';
  const ægte = globalThis.fetch;
  t.after(() => { globalThis.fetch = ægte; });
  globalThis.fetch = async (url, { headers }) => {
    kald.push({ url, headers });
    if (tilstand === 'nede') throw new Error('ECONNRESET');
    if (url.includes('mangler')) return new Response('not found', { status: 404, headers: { 'content-type': 'application/json' } });
    if (headers['If-None-Match'] === '"e1"') return new Response(null, { status: 304 });
    const webp = (headers.Accept || '').includes('webp');
    return new Response(webp ? 'WEBP' : 'JPEG', { status: 200, headers: { 'content-type': webp ? 'image/webp' : 'image/jpeg', etag: '"e1"' } });
  };
  const stille = { info() {}, warn() {} };
  const opts = { dist, cache, base: '/', site: 'https://neminventar.dk', log: stille };

  const r1 = await lokaliser(opts);
  assert.equal(r1.jobs, 3); // god som webp (img + json deler den) og som jpeg (og:image), mangler som webp
  assert.equal(r1.hentet, 2);
  assert.equal(r1.fejl, 1);
  assert.equal(kald.filter((k) => k.url.includes('mangler')).length, 1, '404 prøves ikke igen');
  const html = await fs.readFile(path.join(dist, 'p', 'index.html'), 'utf8');
  assert.match(html, /content="https:\/\/neminventar\.dk\/_b\/god-[0-9a-f]{8}-w800\.jpg"/);
  assert.match(html, /<img src="\/_b\/god-[0-9a-f]{8}-w800\.webp">/);
  assert.ok(html.includes(daarlig.replaceAll('&', '&amp;')), 'fejlet billede beholder sin fjerne URL');
  assert.ok(html.includes(FORM), 'formular-endpointet er urørt');
  const json = JSON.parse(await fs.readFile(path.join(dist, 'data.json'), 'utf8'));
  assert.match(json.img, /^https:\/\/neminventar\.dk\/_b\/god-[0-9a-f]{8}-w800\.webp$/);
  assert.equal(await fs.readFile(path.join(dist, '_b', path.basename(json.img)), 'utf8'), 'WEBP');

  // nyt build med samme dist-indhold og varm cache: 304, ingen nye bytes
  await fs.rm(path.join(dist, '_b'), { recursive: true });
  await fs.writeFile(path.join(dist, 'p', 'index.html'), side);
  const r2 = await lokaliser(opts);
  assert.equal(r2.uaendret, 2);
  assert.equal(r2.hentet, 0);
  assert.match(await fs.readFile(path.join(dist, 'p', 'index.html'), 'utf8'), /<img src="\/_b\/god-[0-9a-f]{8}-w800\.webp">/);

  // Supabase nede: gemt kopi bruges, buildet fortsætter
  await fs.rm(path.join(dist, '_b'), { recursive: true });
  await fs.writeFile(path.join(dist, 'p', 'index.html'), side);
  tilstand = 'nede';
  const r3 = await lokaliser(opts);
  assert.equal(r3.cacheUdenTjek, 2);
  assert.equal(r3.fejl, 1);
  const h3 = await fs.readFile(path.join(dist, 'p', 'index.html'), 'utf8');
  assert.match(h3, /<img src="\/_b\/god-[0-9a-f]{8}-w800\.webp">/);
  const filer = await fs.readdir(path.join(dist, '_b'));
  assert.equal(filer.length, 2);
  await fs.rm(tmp, { recursive: true, force: true });
});
