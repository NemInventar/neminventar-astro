// Varianter (D4, spec §7). En variant er en bestemt udgave af en type, som vi har en render af: typen + en kulør.
// V1 udledes af v_web_products.images_meta (billedets color). Navn og materiale følger af typen. Kuløren følger af
// v_web_colors (Rubio-kulørerne) eller MATERIALEFARVER (laminat, HPL og stof, som ikke olieres). Billeder uden kulør
// og kulører, der ikke står nogen af stederne, er ikke varianter. De bliver i galleriet uden at være en variant.
// Ny variant = ny render med color + approved_for_web (opskriften i repoets CLAUDE.md). V2: tabellen web_varianter.
// Typesiden har én vælger (Joachim 05-10-2026: "Hvorfor kører vi med 2?"): varianterne under hovedbilledet, og
// "Få pris på denne" følger den valgte. Fotoet fra leverancen er ikke et valg og står for sig.
// Ingen imports: testes med node --test (src/lib/varianter.test.ts), og bruges af både Astro og React-øerne.

// Farver på materialer, der ikke olieres. Nøglen er images_meta.color, som den står i databasen.
// HPL og laminat = Arpa HPL Bloom fra Riisfort, syv farver (Joachim 06-10-2026: "noget fra Riisfort", "stærke er sjovere").
// Kompaktlaminat = Sanders lagerfarver; vi køber kompakt hos Sander Kabin (Joachim 06-10-2026).
export const MATERIALEFARVER: Record<string, string> = {
  'rosa-shade': 'Rosa Shade',
  'rosso-falun': 'Rosso Falun',
  maggese: 'Maggese',
  'rosa-bourbon': 'Rosa Bourbon',
  'verde-celadon': 'Verde Celadon',
  'verde-pino': 'Verde Pino',
  'blu-berta': 'Blu Berta',
  'sander-hvid': 'Hvid',
  'sander-lysgraa': 'Lys grå',
  'sander-mellemgraa': 'Mellemgrå',
  'sander-antracit': 'Antracit',
  'sander-creme': 'Creme',
  'sander-trae': 'Trædekor',
  // Akustikpaneler: farvesammensætninger i Kvadrat Field 2
  groenne: 'Grønne farver',
  varme: 'Varme farver',
};

// Hvilken palet en kulør hører til (oversigten over varianter i ni-apps grupperer efter den).
export const SPOR: Record<string, string> = {
  olie: 'Olie (Rubio Monocoat)',
  hpl: 'HPL og laminat (Arpa HPL Bloom, Riisfort)',
  kompakt: 'Kompaktlaminat (Sander)',
  stof: 'Stof (Kvadrat Field 2)',
};
export function sporAf(kuloer: string): keyof typeof SPOR {
  if (kuloer.startsWith('sander-')) return 'kompakt';
  if (kuloer === 'groenne' || kuloer === 'varme') return 'stof';
  return kuloer in MATERIALEFARVER ? 'hpl' : 'olie';
}

type Billede = { url: string; color: string | null };
type Produkt = { slug: string; name: string; color_order: string[] | null; images_meta: Billede[] | null };
type Kuloer = { slug: string; label: string; swatch_hex: string; sort_order: number };

export type Variant = {
  id: string;         // anker: /produkter/<slug>#<id>
  slug: string;       // typens slug
  navn: string;       // typens navn
  kuloer: string;     // images_meta.color
  label: string;      // "Blå" eller "Dueblå laminat"
  hex: string | null; // kun Rubio-kulørerne har en prøvefarve
  img: string;        // første billede i kuløren
};

export const variantId = (kuloer: string) =>
  'v-' + kuloer.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Én variant pr. kulør: typens color_order først, så de øvrige Rubio-kulører i farvekortets rækkefølge, så
// materialefarverne i billedernes rækkefølge. Første billede i kuløren vinder (images_meta er sorteret: primær først).
export function varianterAf(p: Produkt, kulorer: Kuloer[]): Variant[] {
  const foerste = new Map<string, string>();
  for (const m of p.images_meta ?? []) if (m.color && !foerste.has(m.color)) foerste.set(m.color, m.url);
  const rubio = new Map(kulorer.map((k) => [k.slug, k]));
  const orden = [
    ...(p.color_order ?? []),
    ...[...kulorer].sort((a, b) => a.sort_order - b.sort_order).map((k) => k.slug),
    ...foerste.keys(),
  ];
  const brugt = new Set<string>();
  const ud: Variant[] = [];
  for (const k of orden) {
    if (brugt.has(k) || !foerste.has(k)) continue;
    const r = rubio.get(k);
    const label = r?.label ?? MATERIALEFARVER[k];
    if (!label) continue;
    brugt.add(k);
    ud.push({ id: variantId(k), slug: p.slug, navn: p.name, kuloer: k, label, hex: r?.swatch_hex ?? null, img: foerste.get(k)! });
  }
  return ud;
}

// "Få pris på denne": kontaktsiden med emnet og, for en variant, ?v=<slug>~<kulør> → spor 'variant' i leadet.
export function prisHref(base: string, v: { slug: string; navn: string; kuloer?: string; label?: string }): string {
  const emne = v.label ? `${v.navn}, ${v.label.toLowerCase()}` : v.navn;
  const q = `emne=${encodeURIComponent(emne)}` + (v.kuloer ? `&v=${encodeURIComponent(`${v.slug}~${v.kuloer}`)}` : '');
  return `${base}kontakt?${q}`;
}

// Kontaktsiden: ?v=<slug>~<kulør> → konfigurationen, der følger med henvendelsen. Ugyldigt giver null.
export function variantFraUrl(search: string): { type: 'variant'; produkt: string; kuloer: string } | null {
  const v = new URLSearchParams(search).get('v');
  if (!v) return null;
  const i = v.indexOf('~');
  if (i < 1) return null;
  const produkt = v.slice(0, i);
  const kuloer = v.slice(i + 1);
  if (!/^[a-z0-9-]{1,80}$/.test(produkt) || !kuloer || kuloer.length > 40) return null;
  return { type: 'variant', produkt, kuloer };
}

// Forsiden, en type uden valgt kulør (fx et foto fra en leverance): samme formular på forsiden, med typen som emne.
export function typeTilbud(navn: string) {
  return { besked: `Vedr. ${navn}`, spor: 'skitse' as const };
}

// Forsiden: "Få pris på denne" åbner "Send os materialet" med varianten udfyldt (samme felter som ?v= på kontaktsiden).
export function variantTilbud(v: { slug: string; navn: string; kuloer: string; label: string }) {
  return {
    besked: `Vedr. ${v.navn}, ${v.label.toLowerCase()}`,
    spor: 'variant' as const,
    konfiguration: { type: 'variant', produkt: v.slug, kuloer: v.kuloer },
  };
}
