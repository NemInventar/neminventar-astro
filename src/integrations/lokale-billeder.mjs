// Billeder på eget domæne (07-10-2026).
//
// Firmanetværkenes webfiltre vurderer hvert domæne for sig. Er *.supabase.co "unrated" eller blokeret hos en kunde,
// mangler billederne. Derfor henter buildet hvert Supabase-billede, som sitet bruger, ned i dist/_b/ og skriver
// URL'erne om, så alt kundevendt kommer fra neminventar.dk.
//
// Sådan virker det (efter `astro build`, hook astro:build:done):
//   1. Alle tekstfiler i dist (html, json, xml, txt, js, css) skannes for Supabase storage-URL'er
//      (render/image = transform med width/quality, object = original). Formular-endpointet (functions/v1) røres ikke.
//   2. Hvert billede hentes én gang med samme transform-parametre, højst SAMTIDIGE ad gangen:
//      - på siden (img, srcset, data-src, CSS) som webp, ligesom browseren får det fra Supabase i dag
//      - i <meta> (og:image, twitter:image) og JSON-LD i originalformatet og med absolut URL, for delingstjenester
//        og søgemaskiner, der ikke læser webp
//   3. Filnavnet er <originalnavn>-<kilde-id>-<bredde>.<ext>, fx 33_lockere-roede-ved-doer-til-klasserum-1a2b3c4d-w800.webp.
//      Kilde-id'et er det samme for alle bredder af ét billede (testen "kortbillede = hovedbillede" bygger på det).
//   4. Cache mellem builds i .cache/lokale-billeder (actions/cache i CI). Hvert billede genvalideres med ETag
//      (Supabase svarer 304), så et udskiftet billede kommer med ved næste build.
//
// Fejler en hentning, beholdes den fjerne URL, og der skrives en advarsel. Buildet fejler ALDRIG på grund af et billede.
// Slå det hele fra med LOKALE_BILLEDER=0.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAPPE = '_b';
const SAMTIDIGE = 6;
const TIMEOUT_MS = 30_000;
const FORSOEG = 3; // ved netværks- og serverfejl
const PAUSER_429 = [1000, 3000, 8000, 15000, 30000]; // ventetid før næste forsøg; 429 får alle, andre fejl de to første
const RYD_EFTER_DAGE = 30; // cache-filer, der ikke er brugt i så mange dage, slettes
const TEKSTFILER = new Set(['.html', '.json', '.xml', '.txt', '.js', '.mjs', '.css', '.webmanifest']);

// Supabase storage-URL. Stopper ved anførselstegn, mellemrum, <>, ), backslash og HTML-kodede anførselstegn
// (&quot; i astro-island-props). Formular-endpointet /functions/v1/ matches ikke.
const URL_RE = /https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/(?:render\/image|object)\/public\/(?:(?!&quot;|&#34;|&#39;|&#x27;|&apos;)[^"'\s<>)\\])+/gi;
// Steder, hvor URL'en skal være absolut og i originalformat: <meta …> og JSON-LD.
const ABS_RE = /<meta\b[^>]*>|<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi;

/** Finder Supabase-billed-URL'er i en tekst. Returnerer [{ start, end, raa, url, absolut }]. */
export function findUrler(tekst, ext) {
  const html = ext === '.html';
  const absOmraader = [];
  if (html) for (const m of tekst.matchAll(ABS_RE)) absOmraader.push([m.index, m.index + m[0].length]);
  // Datafiler (varianter.json, sitemap …) læses uden for sitet: absolut URL. Webp er fint for json (læses af ni-apps i en browser).
  const data = ext === '.json' || ext === '.xml' || ext === '.txt' || ext === '.webmanifest';
  const fund = [];
  for (const m of tekst.matchAll(URL_RE)) {
    let raa = m[0].replace(/[.,;:!?]+$/, '');
    const start = m.index;
    const iAbs = absOmraader.some(([a, b]) => start >= a && start < b);
    fund.push({
      start, end: start + raa.length, raa,
      url: raa.replace(/&amp;|&#38;|&#x26;/gi, '&'),
      absolut: iAbs || data,
      format: iAbs || ext === '.xml' || ext === '.txt' ? 'org' : 'web',
    });
  }
  return fund;
}

const sha1 = (s) => createHash('sha1').update(s).digest('hex');

export function slug(s) {
  return s.toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm' };

/** Filnavn for et hentet billede: <originalnavn>-<kilde-id>-<variant>.<ext>. */
export function filnavn(url, contentType) {
  const u = new URL(url);
  const p = decodeURIComponent(u.pathname);
  const kilde = p.replace('/render/image/', '/object/');
  const navn = path.posix.basename(p);
  const stem = slug(navn.replace(/\.[^.]+$/, '')).slice(0, 60) || 'billede';
  const id = sha1(u.origin + kilde).slice(0, 8);
  let variant = 'orig';
  if (p.includes('/render/image/')) {
    const q = new URLSearchParams(u.searchParams);
    const w = q.get('width');
    q.delete('width');
    q.sort();
    const rest = q.toString();
    variant = (w ? `w${w}` : 'x') + (rest === 'quality=72&resize=contain' ? '' : '-' + sha1(rest).slice(0, 6));
  }
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  const ext = EXT[type] || (navn.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'bin').toLowerCase();
  return `${stem}-${id}-${variant}.${ext}`;
}

/** Erstatter fundene i teksten (bagfra, så positionerne holder). */
export function erstat(tekst, fund, nyUrl) {
  let ud = tekst;
  for (const f of [...fund].sort((a, b) => b.start - a.start)) {
    const ny = nyUrl(f);
    if (ny) ud = ud.slice(0, f.start) + ny + ud.slice(f.end);
  }
  return ud;
}

async function* filerI(mappe) {
  for (const e of await fs.readdir(mappe, { withFileTypes: true })) {
    const p = path.join(mappe, e.name);
    if (e.isDirectory()) { if (e.name !== MAPPE) yield* filerI(p); }
    else if (TEKSTFILER.has(path.extname(e.name).toLowerCase())) yield p;
  }
}

const vent = (ms) => new Promise((r) => setTimeout(r, ms));

/** Henter ét billede. Med etag: 304 → { uaendret: true }. Kaster ved fejl. */
async function hent(url, format, etag) {
  const headers = { 'User-Agent': 'neminventar.dk-build (lokale-billeder)' };
  if (format === 'web') headers.Accept = 'image/webp,image/*;q=0.8,*/*;q=0.5';
  if (etag) headers['If-None-Match'] = etag;
  let sidste, pause = 0;
  for (let i = 0; i <= PAUSER_429.length; i++) {
    if (i) await vent(pause);
    pause = PAUSER_429[i] ?? 0;
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (r.status === 304 && etag) return { uaendret: true };
      if (r.ok) {
        const type = r.headers.get('content-type') || '';
        if (!/^(image|video)\//i.test(type)) throw new Error(`uventet indholdstype ${type || '(ingen)'}`);
        const data = Buffer.from(await r.arrayBuffer());
        if (!data.length) throw new Error('tomt svar');
        return { data, type, etag: r.headers.get('etag') };
      }
      sidste = new Error(`HTTP ${r.status}`);
      if (r.status === 429) { // Supabase' transform-grænse: vent (Retry-After hvis den er sat) og prøv igen
        const ra = Number(r.headers.get('retry-after'));
        if (ra > 0) pause = Math.min(60, ra) * 1000;
        continue;
      }
      if (r.status < 500 && r.status !== 408) break; // øvrige 4xx: prøv ikke igen
    } catch (e) {
      sidste = e;
    }
    if (i + 1 >= FORSOEG) break; // netværks- og serverfejl: højst FORSOEG forsøg
  }
  throw sidste;
}

/** Kører opgaver med højst n samtidige. */
async function pulje(opgaver, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, opgaver.length) }, async () => {
    while (i < opgaver.length) { const o = opgaver[i++]; await fn(o); }
  }));
}

export async function lokaliser({ dist, cache, base = '/', site, log = console }) {
  const t0 = Date.now();
  const nu = new Date().toISOString();
  const filer = [];
  const jobs = new Map(); // `${format}|${url}` → { url, format, fil? }
  for await (const f of filerI(dist)) {
    const ext = path.extname(f).toLowerCase();
    const tekst = await fs.readFile(f, 'utf8');
    const fund = findUrler(tekst, ext);
    if (!fund.length) continue;
    filer.push({ f, tekst, fund });
    for (const x of fund) {
      const k = `${x.format}|${x.url}`;
      if (!jobs.has(k)) jobs.set(k, { url: x.url, format: x.format });
    }
  }
  if (!jobs.size) { log.info('lokale-billeder: ingen Supabase-billeder i dist'); return { jobs: 0 }; }

  const filmappe = path.join(cache, 'filer');
  await fs.mkdir(filmappe, { recursive: true });
  const indeksSti = path.join(cache, 'index.json');
  let indeks = {};
  try { indeks = JSON.parse(await fs.readFile(indeksSti, 'utf8')); } catch { /* ny cache */ }

  const ud = path.join(dist, MAPPE);
  await fs.mkdir(ud, { recursive: true });
  const tal = { hentet: 0, uaendret: 0, cacheUdenTjek: 0, fejl: 0, bytes: 0 };
  const fejlede = [];

  await pulje([...jobs.entries()], SAMTIDIGE, async ([k, job]) => {
    const kendt = indeks[k];
    let harKopi = false;
    if (kendt) { try { await fs.access(path.join(filmappe, kendt.fil)); harKopi = true; } catch { /* filen er væk */ } }
    let fil;
    try {
      const r = await hent(job.url, job.format, harKopi ? kendt.etag : null);
      if (r.uaendret) { tal.uaendret++; fil = kendt.fil; }
      else {
        fil = filnavn(job.url, r.type);
        // Skriv til en midlertidig fil og omdøb: to job kan give samme filnavn (fx webp-original i begge formater)
        const tmp = path.join(filmappe, `${fil}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);
        await fs.writeFile(tmp, r.data);
        await fs.rename(tmp, path.join(filmappe, fil));
        indeks[k] = { fil, etag: r.etag, type: r.type, hentet: nu };
        tal.hentet++;
      }
      indeks[k].brugt = nu;
    } catch (e) {
      if (!harKopi) {
        tal.fejl++;
        fejlede.push(job.url);
        log.warn(`lokale-billeder: ADVAR beholder fjern URL (${e?.message ?? e}): ${job.url}`);
        return;
      }
      // Supabase svarer ikke lige nu: den gemte kopi er bedre end den fjerne URL
      fil = kendt.fil; kendt.brugt = nu; tal.cacheUdenTjek++;
      log.warn(`lokale-billeder: kunne ikke genvalidere, bruger gemt kopi (${e?.message ?? e}): ${job.url}`);
    }
    try {
      await fs.copyFile(path.join(filmappe, fil), path.join(ud, fil));
      job.fil = fil; // først nu må URL'en skrives om
    } catch (e) {
      tal.fejl++;
      fejlede.push(job.url);
      log.warn(`lokale-billeder: ADVAR beholder fjern URL (kopi til dist fejlede: ${e?.message ?? e}): ${job.url}`);
    }
  });

  // Størrelse af det, der ligger i dist/_b
  for (const e of await fs.readdir(ud)) tal.bytes += (await fs.stat(path.join(ud, e))).size;

  const rod = base.endsWith('/') ? base : base + '/';
  const absRod = site ? new URL(rod, site).href : null;
  let omskrevet = 0, filerRettet = 0;
  for (const { f, tekst, fund } of filer) {
    const ny = erstat(tekst, fund, (x) => {
      const job = jobs.get(`${x.format}|${x.url}`);
      if (!job?.fil) return null;
      omskrevet++;
      return (x.absolut && absRod ? absRod : rod) + MAPPE + '/' + job.fil;
    });
    if (ny !== tekst) { await fs.writeFile(f, ny); filerRettet++; }
  }

  // Ryd op i cachen: filer, der ikke er brugt i RYD_EFTER_DAGE
  const graense = Date.now() - RYD_EFTER_DAGE * 864e5;
  const iBrug = new Set();
  for (const [k, v] of Object.entries(indeks)) {
    if (!v.brugt || Date.parse(v.brugt) < graense) delete indeks[k];
    else iBrug.add(v.fil);
  }
  for (const e of await fs.readdir(filmappe)) if (!iBrug.has(e)) await fs.rm(path.join(filmappe, e), { force: true });
  await fs.writeFile(indeksSti, JSON.stringify(indeks));

  const sek = ((Date.now() - t0) / 1000).toFixed(1);
  log.info(`lokale-billeder: ${jobs.size} billeder på ${sek}s — ${tal.hentet} hentet, ${tal.uaendret} uændrede (304), ` +
    `${tal.cacheUdenTjek} fra cache uden tjek, ${tal.fejl} fejlede · ${omskrevet} URL'er omskrevet i ${filerRettet} filer · ` +
    `dist/${MAPPE} ${(tal.bytes / 1048576).toFixed(1)} MB`);
  if (fejlede.length) log.warn(`lokale-billeder: ${fejlede.length} billeder bliver hentet fra Supabase (se ADVAR ovenfor)`);
  return { jobs: jobs.size, ...tal, omskrevet, filerRettet, fejlede };
}

/** Astro-integration. */
export default function lokaleBilleder() {
  let root, base = '/', site;
  return {
    name: 'lokale-billeder',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = fileURLToPath(config.root);
        base = config.base || '/';
        site = config.site;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (process.env.LOKALE_BILLEDER === '0') { logger.info('slået fra (LOKALE_BILLEDER=0)'); return; }
        const log = { info: (m) => logger.info(m), warn: (m) => logger.warn(m) };
        try {
          await lokaliser({
            dist: fileURLToPath(dir),
            cache: process.env.LOKALE_BILLEDER_CACHE || path.join(root, '.cache', 'lokale-billeder'),
            base, site, log,
          });
        } catch (e) {
          // Aldrig et rødt build på grund af billeder: siden virker stadig med Supabase-URL'erne.
          logger.warn(`lokale-billeder: ADVAR sprang over (${e?.stack ?? e}) — billederne hentes fra Supabase`);
        }
      },
    },
  };
}
