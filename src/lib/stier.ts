// Adresserne på sitet pr. sprog (Joachim 20-11-2026: "sørg for at vores engelske hjemmeside er ligeså fin som vores
// danske"). Én funktion pr. slags side, så ingen side bygger en adresse selv og kommer til at linke til den danske udgave
// fra en engelsk side. Stierne er uden base og domæne. De danske er uden afsluttende skråstreg, som de altid har været
// (skraastreg.mjs retter dem efter buildet); de engelske har skråstregen med fra start.
// Ingen imports: testes med node --test (src/lib/stier.test.ts). Den engelske slug pr. type, sag og landingsside kommer
// fra lib/engelsk.ts, som kalder ind med opslaget.
export type Lang = 'da' | 'en';

export const SIDER = {
  forside: { da: '', en: 'en/' },
  kontakt: { da: 'kontakt', en: 'en/contact/' },
  inventar: { da: 'inventar', en: 'en/products/' },
  projekter: { da: 'projekter', en: 'en/projects/' },
  omOs: { da: 'om-os', en: 'en/about/' },
  designDetSelv: { da: 'design-det-selv/', en: 'en/design-it-yourself/' },
  privatliv: { da: 'privatlivspolitik', en: 'en/privacy/' },
  cookies: { da: 'cookiepolitik', en: 'en/cookies/' },
  betingelser: { da: 'handelsbetingelser', en: 'en/terms/' },
} as const;
export type Side = keyof typeof SIDER;

export const side = (lang: Lang, s: Side): string => SIDER[s][lang];

// Kontaktsiden med emnet udfyldt (?emne=…), på sidens sprog.
export const kontaktMedEmne = (lang: Lang, emne?: string): string =>
  side(lang, 'kontakt') + (emne ? `?emne=${encodeURIComponent(emne)}` : '');

// Et link til designeren åbner den på sidens sprog (designeren på engelsk: ?lang=en, #71).
export const designerSprog = (url: string, lang: Lang): string =>
  lang === 'en' && !/[?&]lang=/.test(url) ? url + (url.includes('?') ? '&' : '?') + 'lang=en' : url;

// Typer, sager og landingssider. enSlug = den engelske slug (null = ingen engelsk udgave).
export const typeSti = (lang: Lang, daSlug: string, enSlug?: string | null): string =>
  lang === 'en' && enSlug ? `en/products/${enSlug}/` : `produkter/${daSlug}`;
export const sagSti = (lang: Lang, daSlug: string, enSlug?: string | null): string =>
  lang === 'en' && enSlug ? `en/projects/${enSlug}/` : `projekter/${daSlug}`;
export const landingSti = (lang: Lang, daSlug: string, enSlug?: string | null): string =>
  lang === 'en' && enSlug ? `en/${enSlug}/` : daSlug;
