// Den engelske udgave af det, der ellers kommer på dansk fra Supabase: typerne, sagerne, landingssiderne, designerens
// eksempler, holdet og kulørerne (Joachim 20-11-2026: "sørg for at vores engelske hjemmeside er ligeså fin som vores
// danske"). Teksten bor i src/data/engelsk/*.json; billeder, priser, rækkefølge og alt andet kommer fra den danske række,
// så en engelsk side kun findes, så længe den danske er publiceret. Nøglen er den danske slug; den engelske slug står i
// oversættelsen. Står en type, sag eller landingsside ikke her, findes den ikke på engelsk, og der linkes til den danske.
//
// Fingeraftrykket (kilde): hver oversættelse bærer et fingeraftryk af den danske tekst, den er oversat fra. Er den
// danske rettet siden, er oversættelsen forældet: siden bygges stadig, men får <meta name="ni-engelsk"> og en ADVAR i
// tekst-tjekket (lint-web-copy.py --dist), så det ses i hver kørsel. Status, dansk kilde og nyt fingeraftryk efter en ny
// oversættelse: python scripts/engelsk_status.py (samme regnestykke som fingeraftryk herunder).
import { createHash } from 'node:crypto';
import P from '../data/engelsk/produkter.json';
import S from '../data/engelsk/sager.json';
import L from '../data/engelsk/landing.json';
import E from '../data/engelsk/eksempler.json';
import H from '../data/engelsk/holdet.json';
import GUIDES from '../data/guides-i18n.en.json';
import type { WebCase, WebImage, WebLanding, WebPartners, WebProduct } from './supabase';
import { landingSti, sagSti, typeSti, designerSprog, type Lang } from './stier';

type Alt = Record<string, { alt: string; caption?: string | null }>;
export interface TypeEn { slug: string; name: string; intro: string; hero_tagline?: string | null; story?: string; seo_title?: string; seo_description?: string; kilde?: string }
export interface SagEn {
  slug: string; name: string; hero_tagline?: string | null; web_summary: string; web_story?: string; seo_title?: string; seo_description?: string;
  delivery_label: string; status_label: string; partners?: { title?: string | null; text: string; roles?: Record<string, string> } | null; image_alts?: Alt; kilde?: string;
}
export interface LandingEn {
  da_slug: string; slug: string; nav_label: string; kicker: string | null; h1: string; lead: string | null; body: string;
  faq: { q: string; a: string }[]; highlights: { k: string; v: string }[]; image_alts: Alt; seo_title: string; seo_description: string; keywords: string[]; kilde?: string;
}

export const TYPE_EN = P as Record<string, TypeEn>;
export const SAG_EN = S as Record<string, SagEn>;
export const LANDING_EN = L as LandingEn[];
export const EKSEMPEL_EN = E as Record<string, { titel: string; tekst: string }>;
export const HOLD_EN = H as Record<string, { role: string; desc: string; edu: string; bio: string }>;

// ---------- fingeraftryk ----------
// sha1 af felterne sat sammen med \u0001 (lister: q\u0002a / k\u0002v). Samme regnestykke i scripts/engelsk_status.py.
export const fingeraftryk = (felter: (string | null | undefined)[]): string =>
  createHash('sha1').update(felter.map((f) => f ?? '').join('\u0001'), 'utf8').digest('hex').slice(0, 12);
export const typeKilde = (p: WebProduct) => fingeraftryk([p.name, p.hero_tagline, p.intro, p.story || p.short_description, p.seo_title, p.seo_description]);
export const sagKilde = (c: WebCase) => fingeraftryk([c.name, c.hero_tagline, c.web_summary, c.web_story, c.delivery_label, c.status_label, c.seo_title, c.seo_description]);
export const landingKilde = (l: WebLanding) => fingeraftryk([
  l.nav_label, l.kicker, l.h1, l.lead, l.body, (l.faq ?? []).map((f) => `${f.q}\u0002${f.a}`).join('\u0003'),
  (l.highlights ?? []).map((h) => `${h.k}\u0002${h.v}`).join('\u0003'), l.seo_title, l.seo_description,
  (l.images ?? []).map((i) => `${i.src}\u0002${i.alt ?? ''}\u0002${i.caption ?? ''}`).join('\u0003'),
]);
// Forældet = oversættelsen har et fingeraftryk, og det passer ikke længere. Uden fingeraftryk: ukendt, regnes som i orden.
const foraeldet = (gemt: string | undefined, nu: string) => !!gemt && gemt !== nu;

// ---------- kulører og materialefarver ----------
// Kulørernes navne (v_web_colors.label er dansk). Rubios egne navne er allerede engelske.
export const KULOER_EN: Record<string, string> = {
  natur: 'Clear oil', roedbrun: 'Red-brown', blaa: 'Blue', 'cotton-white': 'Cotton White', cocoa: 'Cocoa',
  fern: 'Fern', 'dark-roast': 'Dark Roast', charcoal: 'Charcoal',
};
// MATERIALEFARVER i lib/varianter.ts: HPL-farverne har egne (italienske) navne; kompaktlaminat og stof oversættes.
export const MATERIALEFARVE_EN: Record<string, string> = {
  'sander-hvid': 'White', 'sander-lysgraa': 'Light grey', 'sander-mellemgraa': 'Mid grey', 'sander-antracit': 'Anthracite',
  'sander-creme': 'Cream', 'sander-trae': 'Wood decor', groenne: 'Green colours', varme: 'Warm colours',
};
export const kuloerNavn = (kuloer: string, dansk: string, lang: Lang) => (lang === 'en' ? KULOER_EN[kuloer] ?? MATERIALEFARVE_EN[kuloer] ?? dansk : dansk);

// ---------- adresser ----------
// En type eller sag har sin egen engelske side, når den er fuldt oversat (story / web_story og en engelsk slug).
export const harTypeEn = (daSlug: string) => !!(TYPE_EN[daSlug]?.story && TYPE_EN[daSlug]?.slug);
export const harSagEn = (daSlug: string) => !!(SAG_EN[daSlug]?.web_story && SAG_EN[daSlug]?.slug);
export const typeHref = (lang: Lang, daSlug: string) => typeSti(lang, daSlug, harTypeEn(daSlug) ? TYPE_EN[daSlug].slug : null);
export const sagHref = (lang: Lang, daSlug: string) => sagSti(lang, daSlug, harSagEn(daSlug) ? SAG_EN[daSlug].slug : null);
// Landingssider med en håndskrevet engelsk side (ikke en oversættelse i landing.json).
export const HAANDSKREVET_EN: Record<string, string> = { lockers: 'lockers' };
export const HAANDSKREVET_NAVN: Record<string, string> = { lockers: 'Lockers made to measure' };
export const landingEnSlug = (daSlug: string): string | null =>
  HAANDSKREVET_EN[daSlug] ?? LANDING_EN.find((l) => l.da_slug === daSlug)?.slug ?? null;
// Den engelske sti til en dansk landingsside: oversat side, håndskrevet side eller guide (src/data/guides-i18n.en.json).
export function landingEnSti(daSlug: string): string | null {
  const s = landingEnSlug(daSlug);
  if (s) return landingSti('en', daSlug, s);
  const g = (GUIDES as { da_slug: string; slug: string }[]).find((x) => x.da_slug === daSlug);
  return g ? `en/guides/${g.slug}/` : null;
}
// De engelske guiders navne pr. dansk slug (til links fra andre engelske sider)
export const GUIDE_NAVN: Record<string, string> = Object.fromEntries((GUIDES as { da_slug: string; nav_label: string }[]).map((g) => [g.da_slug, g.nav_label]));
export const landingHref = (lang: Lang, daSlug: string) => (lang === 'en' ? landingEnSti(daSlug) ?? daSlug : daSlug);
// Findes landingssiden på engelsk? (ellers linker en engelsk side til den danske med hreflang="da")
export const harLandingEn = (daSlug: string) => !!landingEnSti(daSlug);

// Et dansk link i brødtekst eller FAQ (/kompaktlaminat, /kontakt?emne=…, /produkter/…, /#ydelser) på engelsk: den engelske
// side, hvis den findes, ellers den danske. Uden base. Eksterne links og ukendte stier bliver, som de er.
export function enHref(href: string): string {
  // designeren åbner på engelsk (?lang=en, #71)
  if (href.startsWith('https://designer.neminventar.dk/')) return designerSprog(href, 'en');
  if (!href.startsWith('/')) return href;
  const [stiOgQ, anker = ''] = href.slice(1).split('#');
  const [sti, q = ''] = stiOgQ.split('?');
  const s = sti.replace(/\/$/, '');
  const qa = (q ? `?${q}` : '') + (anker ? `#${anker}` : '');
  const fast: Record<string, string> = {
    '': 'en/', kontakt: 'en/contact/', inventar: 'en/products/', projekter: 'en/projects/', 'om-os': 'en/about/',
    'design-det-selv': 'en/design-it-yourself/', privatlivspolitik: 'en/privacy/', cookiepolitik: 'en/cookies/', handelsbetingelser: 'en/terms/',
  };
  if (s in fast) return fast[s] + qa;
  const m = s.match(/^(produkter|projekter)\/([a-z0-9-]+)$/);
  if (m) return (m[1] === 'produkter' ? typeHref('en', m[2]) : sagHref('en', m[2])) + qa;
  const l = landingEnSti(s);
  return (l ?? sti) + qa;
}
// Linker et dansk link i en engelsk tekst stadig til en dansk side? (så får linket hreflang="da")
export const enHrefErDansk = (href: string) => href.startsWith('/') && !enHref(href).startsWith('en/');

// ---------- rækkerne på engelsk ----------
const altPaa = <I extends { src: string; alt: string; caption?: string | null }>(ims: I[], alts?: Alt): I[] =>
  ims.map((im) => (alts?.[im.src] ? { ...im, alt: alts[im.src].alt, caption: alts[im.src].caption ?? im.caption } : im));

export type MedStatus<T> = T & { foraeldet?: boolean };

// En type på engelsk. Uden fuld oversættelse (story) kun navn og kort tekst, til kort på forsiden og i kataloget.
export function typePaaEngelsk(p: WebProduct): MedStatus<WebProduct> | null {
  const e = TYPE_EN[p.slug];
  if (!e) return null;
  return {
    ...p, name: e.name, intro: e.intro, short_description: e.intro, hero_tagline: e.hero_tagline ?? null,
    story: e.story ?? '', seo_title: e.seo_title ?? `${e.name} | Nem Inventar`, seo_description: e.seo_description ?? e.intro,
    foraeldet: foraeldet(e.kilde, typeKilde(p)),
  };
}
export const produkterPaaEngelsk = (ps: WebProduct[]): WebProduct[] => ps.map(typePaaEngelsk).filter((p): p is WebProduct => !!p);

export function sagPaaEngelsk(c: WebCase): MedStatus<WebCase> | null {
  const e = SAG_EN[c.slug];
  if (!e) return null;
  const partners: WebPartners | null = c.web_partners && e.partners
    ? { ...c.web_partners, title: e.partners.title ?? c.web_partners.title, text: e.partners.text,
        list: c.web_partners.list.map((x) => ({ ...x, role: (x.role && e.partners?.roles?.[x.name]) ?? x.role })) }
    : null;
  return {
    ...c, name: e.name, hero_tagline: e.hero_tagline ?? null, web_summary: e.web_summary, web_story: e.web_story ?? null,
    seo_title: e.seo_title ?? `${e.name} | Nem Inventar`, seo_description: e.seo_description ?? e.web_summary,
    delivery_label: e.delivery_label, status_label: e.status_label,
    // pladsholderen "Hovedentreprenør" vises ikke (lib/catalog caseMeta); et rigtigt firmanavn står som det er
    gallery: c.gallery ? altPaa(c.gallery, e.image_alts) : null, web_partners: partners,
    foraeldet: foraeldet(e.kilde, sagKilde(c)),
  };
}
export const sagerPaaEngelsk = (cs: WebCase[]): WebCase[] => cs.map(sagPaaEngelsk).filter((c): c is WebCase => !!c);

export type LandingPaaEngelsk = MedStatus<WebLanding> & { en_slug: string };
export function landingPaaEngelsk(l: WebLanding): LandingPaaEngelsk | null {
  const e = LANDING_EN.find((x) => x.da_slug === l.slug);
  if (!e) return null;
  return {
    ...l, en_slug: e.slug, nav_label: e.nav_label, kicker: e.kicker, h1: e.h1, lead: e.lead, body: e.body, faq: e.faq,
    highlights: e.highlights, keywords: e.keywords, seo_title: e.seo_title, seo_description: e.seo_description,
    images: altPaa(l.images ?? [], e.image_alts) as WebImage[],
    foraeldet: foraeldet(e.kilde, landingKilde(l)),
  };
}

export const kulorerPaaEngelsk = <K extends { slug: string; label: string }>(ks: K[]): K[] =>
  ks.map((k) => ({ ...k, label: KULOER_EN[k.slug] ?? k.label }));

// Holdet (lib/team.ts) på engelsk; TEAM_EN = den korte linje på forsiden.
export const TEAM_EN: Record<string, string> = Object.fromEntries(Object.entries(HOLD_EN).map(([k, v]) => [k, v.desc]));
