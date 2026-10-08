// Interne links med afsluttende skråstreg (08-10-2026).
//
// GitHub Pages svarer /side med 301 → /side/. Sitets egne links blev bygget uden skråstreg (`${base}${slug}`), så hvert
// klik og hvert crawl kostede en omdirigering, og Search Console meldte 6 "Omdirigeringsfejl" på /kompaktlaminat,
// /garderober m.fl. (crawlet 24-25/9). Sitemap, canonical og og:url har allerede skråstreg. Det er kun href'erne.
//
// Efter `astro build` (hook astro:build:done) får hvert internt href="/sti" (eller https://neminventar.dk/sti) en
// skråstreg, når siden findes som mappe med index.html i dist. Filer (.pdf, .jpg …), ankre, query, mailto/tel, andre
// domæner (fx designer.neminventar.dk) og stier, der ikke findes, røres ikke. Slå det fra med SKRAASTREG=0.
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HREF = /href="((?:https:\/\/(?:www\.)?neminventar\.dk)?)(\/[^"#?]*)([?#][^"]*)?"/g;

/** Tilføjer skråstreg på interne links til sider, der findes. findes(sti) får stien uden base og uden skråstreg. */
export function tilfoejSkraastreg(html, findes, base = '/') {
  let n = 0;
  const ud = html.replace(HREF, (hel, vaert, sti, rest = '') => {
    if (sti.endsWith('/') || /\.[a-z0-9]{1,5}$/i.test(sti) || !sti.startsWith(base)) return hel;
    if (!findes(sti.slice(base.length))) return hel;
    n++;
    return `href="${vaert}${sti}/${rest}"`;
  });
  return { html: ud, n };
}

async function htmlFiler(dir) {
  const ud = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ud.push(...await htmlFiler(p));
    else if (e.name.endsWith('.html')) ud.push(p);
  }
  return ud;
}

export async function skraastreg({ dist, base = '/', log = console }) {
  const findes = (rel) => !!rel && existsSync(path.join(dist, rel, 'index.html'));
  let links = 0, filer = 0;
  for (const f of await htmlFiler(dist)) {
    const { html, n } = tilfoejSkraastreg(await fs.readFile(f, 'utf8'), findes, base);
    if (n) { await fs.writeFile(f, html); links += n; filer++; }
  }
  log.info(`skraastreg: ${links} interne links fik skråstreg i ${filer} sider`);
  return { links, filer };
}

/** Astro-integration. */
export default function skraastregIntegration() {
  let base = '/';
  return {
    name: 'skraastreg',
    hooks: {
      'astro:config:done': ({ config }) => { base = config.base || '/'; },
      'astro:build:done': async ({ dir, logger }) => {
        if (process.env.SKRAASTREG === '0') { logger.info('slået fra (SKRAASTREG=0)'); return; }
        try {
          await skraastreg({ dist: fileURLToPath(dir), base, log: { info: (m) => logger.info(m) } });
        } catch (e) {
          // Aldrig et rødt build på grund af en optimering: linkene virker også uden skråstreg (via 301).
          logger.warn(`skraastreg: ADVAR sprang over (${e?.stack ?? e})`);
        }
      },
    },
  };
}
