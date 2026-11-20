// Kundevendte mærkater for arketypernes materialer, overflader og anvendelser.
// Katalogets arrays er ERP-data (slugs, mål, leverandørnavne) og må ikke vises råt på sitet.
// null = vises ikke. Ukendte værdier falder tilbage til en pæn version af teksten.
const MAP: Record<string, string | null> = {
  // materialer
  '18mm krydsfiner': 'Krydsfiner',
  '19mm melaminspånplade': 'Melaminbeklædt spånplade',
  '3mm HDF': null,
  birk: 'Birk',
  Ecophon: 'Akustikplade',
  eg: 'Eg',
  'eg-massiv-bænkeplade': 'Massiv eg',
  fyr: 'Fyr',
  'HPL højtrykslaminat': 'Højtrykslaminat',
  'HPL-laminat': 'Højtrykslaminat',
  krydsfiner: 'Krydsfiner',
  'krydsfiner-birk': 'Birkekrydsfiner',
  Kvadrat: 'Møbeltekstil', // mærkenavnet må ikke stå på sitet (skill seo, hårde grænser)
  'laminatbordplade 30mm': 'Laminatbordplade',
  MDF: 'MDF',
  staal: 'Stål',
  // overflader
  '2k-topcoat': 'Slidstærk topcoat',
  'Højtrykslaminat, valgfri farve': 'Højtrykslaminat i valgfri farve',
  'Højtrykslaminat, valgfri farve (fx støvgrå, hvid, lysegrå)': 'Højtrykslaminat i valgfri farve',
  olie: 'Olie',
  PreColour: 'Pigmenteret olie',
  'Rubio Monocoat': 'Hårdvoksolie',
  'Rubio Monocoat hardwax-olie, klar eller pigmenteret': 'Hårdvoksolie, klar eller pigmenteret',
  'Rubio Monocoat hardwax-olie, pigmenteret': 'Pigmenteret hårdvoksolie',
  'rubio-monocoat-precolour': 'Pigmenteret olie',
  'rubio-oil-plus-2c': 'Hårdvoksolie',
  stof: 'Tekstil',
  // anvendelser
  bolig: 'Boliger',
  daginstitution: 'Daginstitutioner',
  daginstitutioner: 'Daginstitutioner',
  faellesareal: 'Fællesarealer',
  foreningshus: 'Foreningshuse',
  garderobe: 'Garderober',
  idraetshal: 'Idrætshaller',
  'idrætshal': 'Idrætshaller',
  installationsvaeg: 'Installationsvægge',
  institution: 'Institutioner',
  kontor: 'Kontorer',
  omklaedning: 'Omklædning',
  'omklædning': 'Omklædning',
  personale: 'Personalerum',
  skole: 'Skoler',
  skoler: 'Skoler',
  spa: 'Spa',
  wellness: 'Wellness',
};

const tidy = (s: string) => {
  const t = s.replace(/-/g, ' ').replace(/\b\d+\s?mm\b/gi, '').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Engelsk: de danske mærkater ovenfor oversat. En mærkat uden engelsk ord her vises ikke på engelsk (aldrig dansk på en
// engelsk side); test i labels.test.ts holder listen fuld.
export const EN: Record<string, string> = {
  Krydsfiner: 'Plywood', 'Melaminbeklædt spånplade': 'Melamine-faced chipboard', Birk: 'Birch', Akustikplade: 'Acoustic board',
  Eg: 'Oak', 'Massiv eg': 'Solid oak', Fyr: 'Pine', Højtrykslaminat: 'High-pressure laminate', Birkekrydsfiner: 'Birch plywood',
  Møbeltekstil: 'Furniture textile', Laminatbordplade: 'Laminate worktop', MDF: 'MDF', Stål: 'Steel',
  'Slidstærk topcoat': 'Hard-wearing topcoat', 'Højtrykslaminat i valgfri farve': 'High-pressure laminate in any colour',
  Olie: 'Oil', 'Pigmenteret olie': 'Pigmented oil', Hårdvoksolie: 'Hardwax oil', 'Hårdvoksolie, klar eller pigmenteret': 'Hardwax oil, clear or pigmented',
  'Pigmenteret hårdvoksolie': 'Pigmented hardwax oil', Tekstil: 'Textile',
  Fyrrekrydsfiner: 'Pine plywood', 'Olie, klar eller farvet': 'Oil, clear or coloured', Bejdse: 'Stain',
  'Højtrykslaminat på lågerne': 'High-pressure laminate on the doors', Kompaktlaminat: 'Compact laminate',
  'Kompaktlaminat i valgfri farve': 'Compact laminate in any colour', 'Klar olie på korpus': 'Clear oil on the carcass',
  Hardvoksolie: 'Hardwax oil', Kantiner: 'Canteens', Musiklokaler: 'Music rooms',
  Boliger: 'Housing', Daginstitutioner: 'Daycare centres', Fællesarealer: 'Shared areas', Foreningshuse: 'Club houses',
  Garderober: 'Cloakrooms', Idrætshaller: 'Sports halls', Installationsvægge: 'Installation walls', Institutioner: 'Institutions',
  Kontorer: 'Offices', Omklædning: 'Changing rooms', Personalerum: 'Staff rooms', Skoler: 'Schools', Spa: 'Spa', Wellness: 'Wellness',
};

/** Mapper en liste af katalogværdier til unikke, kundevendte mærkater. */
export function chipLabels(values: string[] | null | undefined, lang: 'da' | 'en' = 'da'): string[] {
  const out: string[] = [];
  for (const v of values ?? []) {
    const da = v in MAP ? MAP[v] : tidy(v);
    const label = lang === 'en' ? (da ? EN[da] ?? null : null) : da;
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}
