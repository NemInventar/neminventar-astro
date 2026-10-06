// Forsidens udvalg (forside v3, 05-10-2026). Kun HVILKE og I HVILKEN RÆKKEFØLGE står her — tekster, billeder og tal
// kommer fra Supabase-views (v_web_products, v_web_cases, v_web_landing_pages, v_web_colors).
// Spec: docs/superpowers/specs/2026-10-05-ny-forside-design.md · mockup: mockups/forside-v3.html.
// Ingen Astro-imports: testes med node --test (src/lib/forside.test.ts).

// Den offentlige designer (D3a-lite + D3b, live 05-10-2026). Links: ?p=<produkt>&t=<base64url(JSON-tilstand)>, og
// &hent=ifc henter IFC-filen ved start (ni-apps core/permalink.js). Designeren renser selv tilstanden mod sine valg,
// så en kulør, den ikke har, falder tilbage til standarden.
export const DESIGNER_URL: string | null = 'https://ni-designer.pages.dev/designer.html';

// Typer, designeren kan åbne (produkt-id i designeren).
export const DESIGNER_AF: Record<string, 'locker' | 'hoejskab'> = {
  'garderobeskab-perforerede-lager': 'locker',
  'skohylde-med-locker': 'locker',
  'hoejskab-krydsfiner': 'hoejskab',
  'opbevaringsskab-bejdset-krydsfiner': 'hoejskab',
  'opbevaringsskab-laminat-standard': 'hoejskab',
  'hoejskab-hpl-laager': 'hoejskab',
  'hoejskab-kompaktlaminat': 'hoejskab',
};

// Typen (og den valgte kulør) som tilstand i designeren. Farvede låger på klar korpus = front 'farve' + farve.laage.
const laager = (k?: string) => (k && k !== 'natur' ? { mat: 'kryds', front: 'farve', farve: { kryds: 'natur', laage: k } } : { mat: 'kryds', farve: { kryds: 'natur' } });
const TILSTAND: Record<string, (kuloer?: string) => Record<string, unknown>> = {
  'hoejskab-krydsfiner': laager,
  'opbevaringsskab-bejdset-krydsfiner': laager,
  'opbevaringsskab-laminat-standard': () => ({ mat: 'kryds', front: 'laminat' }),
  'hoejskab-hpl-laager': () => ({ mat: 'kryds', front: 'laminat' }),
  'hoejskab-kompaktlaminat': () => ({ mat: 'kompakt' }),
  'garderobeskab-perforerede-lager': (k) => ({ mat: 'kryds', farve: { kryds: k ?? 'natur' } }),
  'skohylde-med-locker': (k) => ({ mat: 'kryds', farve: { kryds: k ?? 'natur' } }),
};
const kod = (st: unknown) => {
  let s = '';
  for (const b of new TextEncoder().encode(JSON.stringify(st))) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
// Link til designeren for en type, evt. i en kulør og med IFC-download. null, hvis designeren ikke har typen.
export function designerLink(slug: string, kuloer?: string, hent?: 'ifc' | 'dxf'): string | null {
  const p = DESIGNER_AF[slug];
  if (!DESIGNER_URL || !p) return null;
  const t = TILSTAND[slug];
  return `${DESIGNER_URL}?p=${p}${t ? `&t=${kod(t(kuloer))}` : ''}${hent ? `&hent=${hent}` : ''}`;
}

// Katalog-panelet i toppen: seks typer, et tværsnit. kuloer = hvilken render der vises (images_meta.color).
export const KATALOG_TOP: { slug: string; kuloer?: string; foto?: string }[] = [
  { slug: 'garderobeskab-perforerede-lager' },
  { slug: 'hoejskab-krydsfiner', kuloer: 'natur' },
  { slug: 'opbevaringsskab-bejdset-krydsfiner', kuloer: 'roedbrun' },
  { slug: 'garderobeskab-laager-siddeniche', kuloer: 'fern' },
  { slug: 'omklaedningsbaenk-integreret-knagerakke', kuloer: 'charcoal' },
  { slug: 'koekkenvaeg-bejdset-krydsfiner', kuloer: 'blaa' },
];

// Inspiration: syv varianter. w = bredde i 12-kolonne-gitteret (8 = liggende render, 4 = kvadrat).
// Fliserne viser typens navn og kuløren — det samme, som man lander på (Fable 06-10: ingen egne titler).
export const INSPIRATION: { slug: string; kuloer: string; w: 8 | 4 }[] = [
  { slug: 'hoejskab-krydsfiner', kuloer: 'blaa', w: 8 },
  { slug: 'opbevaringsskab-bejdset-krydsfiner', kuloer: 'roedbrun', w: 4 },
  { slug: 'garderobeskab-laager-siddeniche', kuloer: 'fern', w: 4 },
  { slug: 'vaegbeklaedning-krydsfiner', kuloer: 'charcoal', w: 8 },
  { slug: 'skohylde-med-locker', kuloer: 'roedbrun', w: 4 },
  { slug: 'koekkenvaeg-bejdset-krydsfiner', kuloer: 'blaa', w: 4 },
  { slug: 'garderobereol-siddenicher', kuloer: 'blaa', w: 4 },
];

// "Det laver vi": én slags link pr. række (Fable 06-10-2026: rækken blandede materialer, produkter, arbejdsform og
// certificering). Emnesiderne (kind 'emne') deles her. Et nyt emne lander under Inventar, til det står i en af listerne.
export const EMNE_MATERIALER = ['krydsfiner-inventar', 'akustikvaegge-perforeret-krydsfiner', 'kompaktlaminat', 'rustfri-staal-bordplader'];
export const EMNE_ARBEJDSFORM = ['vaerkstedstegninger-og-3d-model', 'inventar-til-svanemaerket-byggeri'];
export function emneGruppe(slug: string): 'inventar' | 'materialer' | 'arbejdsform' {
  return EMNE_MATERIALER.includes(slug) ? 'materialer' : EMNE_ARBEJDSFORM.includes(slug) ? 'arbejdsform' : 'inventar';
}

// Bevisbjælken: ét tal fra hver af fire forskellige sager.
export const BEVIS_SAGER = ['morkhoj-skole', 'bolholmen-stenlose', 'idraetspark-koebenhavn', 'daginstitution-vinge'];
// Projekter-afsnittet: tre sager af forskellig art (skole · boliger · idræt). Her nævnes Mørkhøj ved navn.
export const PROJEKTER = ['morkhoj-skole', 'bolholmen-stenlose', 'idraetspark-koebenhavn'];

type MedBilleder = { primary_image: string | null; images_meta: { url: string; color: string | null }[] | null };
export function billedeAf(p: MedBilleder, kuloer?: string): string {
  const hit = kuloer ? (p.images_meta ?? []).find((m) => m.color === kuloer) : undefined;
  return hit?.url ?? p.primary_image ?? '';
}

// "342 lockers · 342 skohylder" → { b: '342', t: 'lockers' }. Første led med et tal; ellers null.
export function bevis(c: { delivery_label: string | null }): { b: string; t: string } | null {
  for (const led of (c.delivery_label ?? '').split(' · ')) {
    const m = led.trim().match(/^((?:ca\.\s*)?[\d.,]+(?:\s*m²|\s*m\b)?)\s+(.+)$/);
    if (m) return { b: m[1], t: m[2] };
  }
  return null;
}
