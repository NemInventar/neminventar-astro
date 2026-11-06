// Engelske tekster til det, der ellers kommer på dansk fra Supabase: typernes navne, kulørerne, de fire sager på forsiden og
// holdet. Nøglen er slug'en (e-mail for holdet). Står en type eller sag ikke her, vises den ikke på de engelske sider, så en
// side aldrig blander sprog. Ny type eller sag på den engelske forside → tilføj den her.

// Typerne (fra /en/products/, backlog e2c66652): navn og kort tekst.
export const PRODUKT_EN: Record<string, { name: string; desc: string }> = {
  'omklaedningsbaenk-integreret-knagerakke': { name: 'Changing-room bench with coat hooks', desc: 'A continuous bench with backrest and a row of coat hooks, built as one element along the wall. Oiled wood that can be repaired locally.' },
  'garderobeskab-perforerede-lager': { name: 'Wardrobes with perforated doors', desc: 'A row of plywood wardrobes with perforated doors and no handles, a closed top, open shoe compartments at the bottom and an integrated oak bench.' },
  'lockers-krydsfiner': { name: 'Plywood lockers', desc: 'Lockers in two tiers with plain doors and locks. For changing rooms, sports halls and staff rooms.' },
  'lockerskab-ventilerede-laager': { name: 'Lockers with ventilated doors', desc: 'Tall plywood lockers where each door has a field of holes at the top and bottom, so air can pass through.' },
  'lockerbank-omklaedning': { name: 'Locker bank for changing rooms', desc: 'A freestanding plywood locker bank with many small compartments in five tiers, each with a hasp for a padlock.' },
  'vaegbeklaedning-krydsfiner': { name: 'Plywood wall cladding', desc: 'Birch plywood cladding with visible edges and pigmented oil, also used to close installation walls behind a calm timber surface.' },
  'hoejskab-kompaktlaminat': { name: 'Tall cabinet in compact laminate', desc: 'A tall cabinet for bathrooms and wet rooms with visible surfaces in compact laminate, which does not absorb water.' },
  'akustikpanel-kvadrat-stof': { name: 'Upholstered acoustic panel', desc: 'An acoustic panel upholstered in coloured fabric, made to measure with no minimum quantity. The cover can be replaced without replacing the panel.' },
  'garderobereol-siddenicher': { name: 'Open wardrobe with seating niches', desc: 'An open plywood wardrobe unit with upholstered seating niches.' },
  'garderobeskab-laager-siddeniche': { name: 'Wardrobe with lockable doors', desc: 'A plywood wardrobe with lockable doors and an upholstered seating niche.' },
  'skohylde-siddeplads': { name: 'Open shoe rack with seat', desc: 'An open plywood shoe rack with an integrated seat.' },
  'omklaedningsmoebel-gitterskaerm': { name: 'Changing unit with grille screen', desc: 'A changing unit clad in high-pressure laminate, with a grille screen and a seat. The modules can be replaced one by one.' },
  'opbevaringsskab-laminat-standard': { name: 'Tall cabinet in laminate', desc: 'A tall cabinet for storage or clothes in high-pressure laminate, which stands up to wear and daily cleaning.' },
  'opbevaringsskab-bejdset-krydsfiner': { name: 'Tall cabinet with stained plywood doors', desc: 'A tall cabinet with stained plywood doors that show the grain and the edge.' },
  'koekkenvaeg-laminat-standard': { name: 'Kitchen wall in laminate', desc: 'A complete kitchen wall in high-pressure laminate with a laminate worktop, for staff rooms and kitchenettes.' },
  'hoejskab-krydsfiner': { name: 'Tall cabinet in plywood', desc: 'A tall cabinet built entirely in plywood: carcass, shelves, back and doors. The doors can be oiled, stained or faced with laminate.' },
  'hoejskab-aaben-reol': { name: 'Tall cabinets with open shelving', desc: 'Plywood tall cabinets with an open shelf section between the closed cabinets. Carcass in clear oil, doors oiled in one of our colours.' },
  'koekkenvaeg-bejdset-krydsfiner': { name: 'Kitchen wall with stained plywood fronts', desc: 'A kitchen wall with fronts in stained plywood that show the grain and the edge.' },
  'hoejskab-hpl-laager': { name: 'Tall cabinet with laminate doors', desc: 'A tall cabinet with a carcass in clear oiled plywood and doors faced with high-pressure laminate in seven colours.' },
  'mobil-lockers-krydsfiner': { name: 'Phone lockers in plywood', desc: 'For schools that collect phones during the day, and for sports halls where valuables need locking away. Thirty small compartments in one narrow bank, each with a hasp for a padlock.' },
  'akustikpaneler-perforeret-krydsfiner': { name: 'Perforated plywood acoustic panels', desc: 'Pine or birch plywood panels with holes and acoustic felt behind. For classrooms, music rooms, sports halls and canteens, where the wall must absorb sound and take knocks.' },
};

// Kulørernes navne (v_web_colors.label er dansk). Rubios egne navne er allerede engelske.
export const KULOER_EN: Record<string, string> = {
  natur: 'Clear oil', roedbrun: 'Red-brown', blaa: 'Blue', 'cotton-white': 'Cotton White', cocoa: 'Cocoa',
  fern: 'Fern', 'dark-roast': 'Dark Roast', charcoal: 'Charcoal',
};

// Sagerne på forsiden (BEVIS_SAGER og PROJEKTER i lib/forside.ts), oversat fra v_web_cases 06-11-2026.
// levering = delivery_label (bevisbjælkens tal læses af første led, som på dansk); status og resume = projektkortet.
export const SAG_EN: Record<string, { navn: string; levering: string; status: string; resume: string }> = {
  'morkhoj-skole': {
    navn: 'Mørkhøj School',
    levering: '342 lockers · 342 shoe shelves · 52 stained side screens · 14 tall cabinets · 19 upholstered niches and seats · 6 kitchenettes · 68 glass boards · approx. 300 m² acoustics · approx. 100 m² installation walls',
    status: 'First stage handed over · 2026',
    resume: 'Fixed furniture for Mørkhøj School with Ason A/S and Rønnow Arkitekter: 342 lockers with shoe shelves, approx. 300 m² acoustics, 68 glass boards, upholstered niches, tall cabinets and kitchenettes, all made to measure for the school.',
  },
  'bolholmen-stenlose': {
    navn: 'Bølholmen, Stenløse',
    levering: '230 identical vanity units in compact laminate · 220 homes',
    status: 'Delivered',
    resume: '230 identical vanity units in compact laminate for 220 homes in the renovation of the Bølholmen housing blocks in Stenløse for Enemærke & Petersen. Delivered and in use.',
  },
  'idraetspark-koebenhavn': {
    navn: 'Sundby Sports Park',
    levering: '150 m of benches · 150 locker compartments · 9 wash counters in compact laminate · kitchenette',
    status: 'Being installed · 2026',
    resume: 'Benches in solid pine, plywood locker banks and wash counters in compact laminate for the changing rooms, and a kitchenette for the club meeting room at Sundby Sports Park.',
  },
  'daginstitution-vinge': {
    navn: 'Vinge daycare centre',
    levering: "92 children's wardrobes · toilet cubicles · tall cabinets for wet rooms · room dividers · staff lockers · mobile kitchen island",
    status: 'In production · 2026',
    resume: "Fixed furniture for Vinge daycare centre: 92 children's wardrobes in oiled pine, toilet cubicles in compact laminate, tall cabinets for wet rooms, staff lockers and a mobile kitchen island.",
  },
};

// Holdet på forsiden (lib/team.ts desc)
export const TEAM_EN: Record<string, string> = {
  'js@neminventar.dk': 'Contact and coordination with contractors, architects and others.',
  'kontakt@neminventar.dk': 'Sales, supplier coordination and process.',
  'cf@neminventar.dk': 'Product design, innovation and quality.',
};

// Supabase-rækkerne på engelsk til den engelske forside. Uden engelsk tekst falder typen og sagen fra (se øverst).
export const produkterPaaEngelsk = <P extends { slug: string; name: string }>(ps: P[]): P[] =>
  ps.filter((p) => PRODUKT_EN[p.slug]).map((p) => ({ ...p, name: PRODUKT_EN[p.slug].name }));
export const kulorerPaaEngelsk = <K extends { slug: string; label: string }>(ks: K[]): K[] =>
  ks.map((k) => ({ ...k, label: KULOER_EN[k.slug] ?? k.label }));
export const sagerPaaEngelsk = <C extends { slug: string; name: string; delivery_label: string | null; status_label: string | null; web_summary: string | null }>(cs: C[]): C[] =>
  cs.filter((c) => SAG_EN[c.slug]).map((c) => {
    const e = SAG_EN[c.slug];
    return { ...c, name: e.navn, delivery_label: e.levering, status_label: e.status, web_summary: e.resume };
  });
