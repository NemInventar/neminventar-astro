// Engelske og tyske udgaver af guiderne (Joachim 25-10-2026: "sørg for at vores guides er oversat, så de kan give lidt
// ekstra point i ChatGPT, både på tysk og engelsk"). Teksten bor i src/data/guides-i18n.<lang>.json; billeder, relaterede
// sider, produkter og "senest ændret" hentes fra den danske side i v_web_landing_pages, så en guide kun vises på engelsk
// og tysk, så længe den danske er publiceret. Slug og titel er valgt efter søgeordstal (DataForSEO 25-10-2026, se
// "keywords" i filerne): tyskerne søger fx "HPL Platte" og "Spanplatte oder MDF", ikke "Kompaktlaminat".
import EN from '../data/guides-i18n.en.json';
import DE from '../data/guides-i18n.de.json';
import type { WebImage, WebLanding } from './supabase';

export type GuideLang = 'en' | 'de';

interface GuideText {
  da_slug: string;
  slug: string;
  nav_label: string;
  kicker: string | null;
  h1: string;
  lead: string | null;
  body: string;
  faq: { q: string; a: string }[];
  highlights: { k: string; v: string }[];
  image_alts: Record<string, { alt: string; caption?: string }>;
  seo_title: string;
  seo_description: string;
  keywords: string[];
}

export interface GuideI18n extends Omit<GuideText, 'image_alts'> {
  lang: GuideLang;
  images: WebImage[];
  related_slugs: string[];
  updated_at: string;
  web_display_order: number | null;
}

const TEXTS: Record<GuideLang, GuideText[]> = { en: EN as GuideText[], de: DE as GuideText[] };

// Stien til oversigten og til den enkelte guide, uden base.
export const GUIDE_DIR: Record<GuideLang, string> = { en: 'en/guides/', de: 'de/ratgeber/' };
export const guidePath = (lang: GuideLang, slug: string) => `${GUIDE_DIR[lang]}${slug}/`;

export function guidesFor(lang: GuideLang, daPages: WebLanding[]): GuideI18n[] {
  const out: GuideI18n[] = [];
  for (const t of TEXTS[lang]) {
    const da = daPages.find((p) => p.slug === t.da_slug);
    if (!da) continue; // den danske er afpubliceret, så er oversættelsen det også
    const { image_alts, ...tekst } = t;
    out.push({
      ...tekst,
      lang,
      images: (da.images ?? []).map((im) => ({ ...im, ...(image_alts[im.src] ?? {}) })),
      related_slugs: da.related_slugs ?? [],
      updated_at: da.updated_at,
      web_display_order: da.web_display_order,
    });
  }
  return out.sort((a, b) => (a.web_display_order ?? 999) - (b.web_display_order ?? 999));
}

// Alle sprogudgaver af en dansk guide (til hreflang på den danske side og på de oversatte).
export function translationsOf(daSlug: string, daPages: WebLanding[]): { lang: GuideLang; path: string }[] {
  if (!daPages.some((p) => p.slug === daSlug)) return [];
  return (['en', 'de'] as GuideLang[]).flatMap((lang) => {
    const t = TEXTS[lang].find((x) => x.da_slug === daSlug);
    return t ? [{ lang, path: guidePath(lang, t.slug) }] : [];
  });
}

// Links i brødtekst og FAQ peger på danske adresser (/krydsfiner-mdf-eller-spaanplade). Findes siden på sproget, går
// linket dertil; kontaktlinks går til sprogets kontaktvej; resten bliver på den danske side.
export function localHref(lang: GuideLang, href: string, daPages: WebLanding[]): string {
  if (!href.startsWith('/')) return href;
  const [sti, query = ''] = href.slice(1).split('?');
  const slug = sti.replace(/\/$/, '');
  if (slug === 'kontakt') return lang === 'en' ? `en/contact/${query ? '?' + query : ''}` : 'de/#kontakt';
  if (lang === 'en' && slug === 'garderobeskab') return 'en/wardrobes/';
  const t = TEXTS[lang].find((x) => x.da_slug === slug);
  if (t && daPages.some((p) => p.slug === slug)) return guidePath(lang, t.slug);
  return href.slice(1);
}
