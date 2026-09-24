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
  Kvadrat: 'Kvadrat-tekstil',
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

/** Mapper en liste af katalogværdier til unikke, kundevendte mærkater. */
export function chipLabels(values: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const v of values ?? []) {
    const label = v in MAP ? MAP[v] : tidy(v);
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}
