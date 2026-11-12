// Ordrer i hver af de 16 tilstande (Fable runde 3 afsnit e) som broen kunne sende dem (kontrakter §5), med et fast "nu"
// pr. tilstand. Bruges af node-testene og af den falske API bag skærmbillederne (konto/scripts/fake-api.mjs).
// Data er opdigtede som i mockuppen (Mette Holm, NI-1D078A14, 16.012,50 kr.). H1 er Fables ordret (afsnit e).
// LÆK = felter, der aldrig må nå kunden (kontrakter §5 "Aldrig"); de står her med vilje, så testen kan se, at
// renderen ikke viser dem, selv hvis broen en dag sendte dem med.
export const REF = 'NI-1D078A14';
export const EMAIL = 'mette.holm@eksempel.dk';
export const LAEK = ['+45 20 30 40 50', '20304050', EMAIL, 'milot@neminventar.dk', 'kontakt@neminventar.dk', 'cs_test_a1b2', 'pi_3Q', 'intern note'];

const AFTALT = 'Soklen laves 8 cm høj, så den flugter med din fodliste. Aftalt på mail 9. november.';
const BESKED = 'Kan soklen laves lidt lavere, så den flugter med fodlisten? Vi bor på 2. sal uden elevator.';

const trin = (t, data, tid) => ({ trin: t, data, tid, sat_af: 'milot@neminventar.dk' });
const UGE51 = trin('uge_bekraeftet', { aar: 2026, uge: 51, praecis: false, aftalt: { tekst: AFTALT, kundens_ja: 'mail 9/11' } }, '2026-11-09T08:30:00.000Z');
const UGE2 = trin('uge_flyttet', { aar: 2027, uge: 2, fra: { aar: 2026, uge: 51 }, aarsag: 'Pladerne fra vores leverandør er forsinkede' }, '2026-12-02T09:00:00.000Z');
const DAG15 = trin('dag_aftalt', { dato: '2026-12-15', fra: '08:00', til: '12:00' }, '2026-12-08T10:00:00.000Z');
const DAG17 = trin('dag_flyttet', { dato: '2026-12-17', fra: '08:00', til: '12:00', tidligere: '2026-12-15', efter_kundens_oenske: true }, '2026-12-10T10:00:00.000Z');
const LEVERET = trin('leveret', { dato: '2026-12-15', fortryd_til: '2026-12-29' }, '2026-12-15T14:00:00.000Z');
const KLAR = trin('klar_afhentning', {}, '2026-12-14T09:00:00.000Z');
const HENTET = trin('hentet', { dato: '2026-12-15', fortryd_til: null }, '2026-12-15T14:00:00.000Z');
const FORTRUDT = trin('fortrudt', { dato: '2026-12-22', beloeb_oere: 1426250 }, '2026-12-22T10:00:00.000Z');
const SKJULTE = [
  trin('ordreside_aabnet', {}, '2026-11-07T11:00:00.000Z'),
  trin('email_rettet', { gammel: 'mette.hollm@eksempel.dk', ny: EMAIL, aarsag: 'tastefejl' }, '2026-11-08T09:00:00.000Z'),
];

function base() {
  return {
    ref: REF,
    bestilt: '2026-11-07T10:15:00.000Z',
    status: 'betalt',
    sprog: 'da',
    produkt: 'hoejskab',
    linjer: [
      { tekst: 'Skabsvæg med 4 højskabe', antal: 1, beloeb_oere: 1426250 },
      { tekst: 'Levering: samlet, båret ind', antal: 1, beloeb_oere: 175000 },
    ],
    levering: { form: 'baaret_ind', tekst: 'Samlet, båret ind' },   // som kernens leveringAf (kontrakter §5)
    total: { ex_oere: 1281000, moms_oere: 320250, inkl_oere: 1601250, valuta: 'DKK' },
    beskrivelse: [
      ['Bredde', '240 cm, fire skabe på 60 cm'],
      ['Højde og dybde', '236 cm · 60 cm'],
      ['Skabe og låger', 'Hvid melamin, otte glatte låger med sorte greb'],
      ['Skab 1 og 2', 'Bøjlestang og hylde'],
      ['Skab 3', 'Fem hylder'],
      ['Skab 4', 'Tre skuffer og bøjlestang'],
      ['Sokkel', '10 cm, hvid'],
    ],
    forloeb: [...SKJULTE],
    betaling: { betalt_at: '2026-11-07T10:16:00.000Z', betalingsmiddel: 'card', refunderet_oere: 0, refunderet_at: null, stripe_pi: 'pi_3Q' },
    fortrydelsesret: false,
    uge_frist_at: '2026-11-09T22:59:59.000Z',
    adresse: { postnr: '2500', by: 'Valby', navn: 'Mette Holm', gade: 'Rosenvej 14, 2. th.', telefon: '20304050' },
    besked: BESKED,
    permalink: 'https://designer.neminventar.dk/designer?p=hoejskab&t=eyJiIjoyNDAsImgiOjIzNn0',
    // LÆK
    telefon: '+45 20 30 40 50',
    email: EMAIL,
    ansvarlig: 'kontakt@neminventar.dk',
    stripe_session: 'cs_test_a1b2',
    noter: 'intern note',
  };
}

const AFHENT = { form: 'afhentning', tekst: 'Flatpack, afhentning på Mågevej' };   // som kernens leveringAf (kontrakter §5)
const AFHENT_LINJER = [{ tekst: 'Skabsvæg med 4 højskabe', antal: 1, beloeb_oere: 1426250 }];
const AFHENT_TOTAL = { ex_oere: 1141000, moms_oere: 285250, inkl_oere: 1426250, valuta: 'DKK' };

// nr → { navn, nu, h1, ordre(): fuld ordre (med login-felter + LÆK) }
export const TILSTANDE = [
  { nr: 1, navn: 'Betalt, fristen ikke nået', nu: '2026-11-08T12:00:00.000Z', h1: 'Vi bekræfter leveringsugen senest mandag 9. november', lav: (o) => o },
  { nr: 2, navn: 'Fristen overskredet', nu: '2026-11-10T09:00:00.000Z', h1: 'Leveringsugen er ikke bekræftet endnu', lav: (o) => o },
  { nr: 3, navn: 'Ugen bekræftet', nu: '2026-11-12T10:00:00.000Z', h1: 'Vi leverer i uge 51 (14.–18. december 2026)', lav: (o) => ({ ...o, forloeb: [...o.forloeb, UGE51] }) },
  { nr: 4, navn: 'Ugen flyttet', nu: '2026-12-03T10:00:00.000Z', h1: 'Vi leverer i uge 2 (11.–15. januar 2027)', lav: (o) => ({ ...o, forloeb: [...o.forloeb, UGE51, UGE2] }) },
  { nr: 5, navn: 'Ugen gået uden aftalt dag', nu: '2026-12-21T09:00:00.000Z', h1: 'Leveringen i uge 51 er ikke aftalt endnu', lav: (o) => ({ ...o, forloeb: [...o.forloeb, UGE51] }) },
  { nr: 6, navn: 'Dagen aftalt', nu: '2026-12-09T10:00:00.000Z', h1: 'Vi leverer tirsdag 15. december', lav: (o) => ({ ...o, forloeb: [...o.forloeb, UGE51, DAG15] }) },
  { nr: 7, navn: 'Dagen flyttet', nu: '2026-12-11T10:00:00.000Z', h1: 'Vi leverer torsdag 17. december', lav: (o) => ({ ...o, forloeb: [...o.forloeb, UGE51, DAG15, DAG17] }) },
  { nr: 8, navn: 'Den aftalte dag', nu: '2026-12-15T07:00:00.000Z', h1: 'Vi leverer i dag', lav: (o) => ({ ...o, forloeb: [...o.forloeb, UGE51, DAG15] }) },
  { nr: 9, navn: 'Dagen passeret, ikke meldt leveret', nu: '2026-12-16T10:00:00.000Z', h1: 'Aftalt levering tirsdag 15. december', lav: (o) => ({ ...o, forloeb: [...o.forloeb, UGE51, DAG15] }) },
  { nr: 10, navn: 'Leveret', nu: '2026-12-16T10:00:00.000Z', h1: 'Leveret tirsdag 15. december', lav: (o) => ({ ...o, fortrydelsesret: true, forloeb: [...o.forloeb, UGE51, DAG15, LEVERET] }) },
  { nr: 11, navn: 'Afhentning, ugen bekræftet', nu: '2026-11-12T10:00:00.000Z', h1: 'Klar til afhentning i uge 51 (14.–18. december 2026)', lav: (o) => ({ ...o, levering: AFHENT, linjer: AFHENT_LINJER, total: AFHENT_TOTAL, forloeb: [...o.forloeb, UGE51] }) },
  { nr: 12, navn: 'Afhentning, klar', nu: '2026-12-14T12:00:00.000Z', h1: 'Klar til afhentning', lav: (o) => ({ ...o, levering: AFHENT, linjer: AFHENT_LINJER, total: AFHENT_TOTAL, forloeb: [...o.forloeb, UGE51, KLAR] }) },
  { nr: 13, navn: 'Afhentning, hentet', nu: '2026-12-16T10:00:00.000Z', h1: 'Hentet tirsdag 15. december', lav: (o) => ({ ...o, levering: AFHENT, linjer: AFHENT_LINJER, total: AFHENT_TOTAL, forloeb: [...o.forloeb, UGE51, KLAR, HENTET] }) },
  { nr: 14, navn: 'Annulleret', nu: '2026-11-11T10:00:00.000Z', h1: 'Bestillingen er annulleret', lav: (o) => ({ ...o, status: 'annulleret', betaling: { ...o.betaling, refunderet_oere: 1601250, refunderet_at: '2026-11-10T13:00:00.000Z' } }) },
  { nr: 15, navn: 'Fortrudt', nu: '2026-12-23T10:00:00.000Z', h1: 'Du har fortrudt købet', lav: (o) => ({ ...o, fortrydelsesret: true, forloeb: [...o.forloeb, UGE51, DAG15, LEVERET, FORTRUDT], betaling: { ...o.betaling, refunderet_oere: 1426250, refunderet_at: '2026-12-22T10:00:00.000Z' } }) },
  { nr: 16, navn: 'Delvis refusion (overskriften uændret)', nu: '2026-11-12T10:00:00.000Z', h1: 'Vi leverer i uge 51 (14.–18. december 2026)', grundNr: 3, lav: (o) => ({ ...o, forloeb: [...o.forloeb, UGE51], betaling: { ...o.betaling, refunderet_oere: 175000, refunderet_at: '2026-11-10T13:00:00.000Z' } }) },
].map((x) => ({ ...x, form: x.nr >= 11 && x.nr <= 13 ? 'afhentning' : 'levering' }));

// Undersætningerne, Fable e skriver ud (ordret med fixturens værdier)
export const UNDER = {
  1: 'Du får en mail, og ugen står her på siden.',
  2: 'Det skulle den have været. Ring på +45 42 42 26 84, eller svar på ordrebekræftelsen.',
  3: 'Vi aftaler leveringsdagen med dig.',
  4: 'Ændret 2. december fra uge 51: Pladerne fra vores leverandør er forsinkede. Vi aftaler leveringsdagen med dig.',
  5: 'Vi fik ikke aftalt en dag med dig i den uge. Ring på +45 42 42 26 84, eller svar på ordrebekræftelsen.',
  6: 'Mellem kl. 8 og 12. Samlet, båret ind.',
  7: 'Ændret 10. december fra tirsdag 15. december. Mellem kl. 8 og 12.',
  9: 'Er der noget, så ring på +45 42 42 26 84.',
  10: 'Du kan fortryde til og med 29. december 2026.',
  11: 'Du får en mail, når din bestilling står klar.',
  12: 'Mågevej 73, st. tv., 2400 København NV. Ring på +45 42 42 26 84 og aftal et tidspunkt.',
  13: 'To års reklamationsret efter købeloven.',
  14: 'Vi har tilbageført 16.012,50 kr. den 10. november. Hvornår beløbet står på din konto, afhænger af din bank.',
  15: 'Vi har tilbageført 14.262,50 kr. den 22. december. Hvornår beløbet står på din konto, afhænger af din bank.',
};

// Varianter ud over de 16 med Fables runde 4-tekster (afsnit 6 og 7). Kun skærmbillederne bruger dem (fake-api: nøglen
// v05a…/v14u…); testene gennemløber TILSTANDE. nr = tilstanden, siden viser.
export const VARIANTER = [
  { id: '05a', nr: 5, navn: 'Afhentning, ugen gået uden "klar" (runde 4, afsnit 6)', nu: '2026-12-21T09:00:00.000Z', form: 'afhentning',
    lav: (o) => ({ ...o, levering: AFHENT, linjer: AFHENT_LINJER, total: AFHENT_TOTAL, forloeb: [...o.forloeb, UGE51] }) },
  { id: '14u', nr: 14, navn: 'Annulleret uden registreret tilbageførsel (runde 4, afsnit 7)', nu: '2026-11-11T10:00:00.000Z', form: 'levering',
    lav: (o) => ({ ...o, status: 'annulleret' }) },
];

/** Ordren som broen/Workeren sender den i en visning. 'uden_login' = uden navn, gade, besked, permalink (kontrakter §5).
 *  nr = 1–16 (TILSTANDE) eller en variants id ('05a', '14u'). */
export function ordreI(nr, visning = 'med_login', { medLaek = true } = {}) {
  const x = typeof nr === 'string' ? VARIANTER.find((v) => v.id === nr) : TILSTANDE.find((s) => s.nr === nr);
  const o = x.lav(base());
  if (!medLaek) {
    for (const k of ['telefon', 'email', 'ansvarlig', 'stripe_session', 'noter']) delete o[k];
    o.forloeb = o.forloeb.filter((f) => !['ordreside_aabnet', 'email_rettet'].includes(f.trin)).map(({ sat_af, ...f }) => f);
    delete o.adresse.telefon;
    delete o.betaling.stripe_pi;
  }
  if (visning === 'uden_login') {
    delete o.adresse.navn;
    delete o.adresse.gade;
    delete o.besked;
    delete o.permalink;
  }
  return o;
}

// Min side med en bestilling pr. ny statustekst (Fable runde 4, afsnit 5), set mandag 21. december 2026 (MIN_SIDE_STATUS_NU):
// tilstand 9 (dagOver), afhentning med ugen gået (afhentUgeOver), afhentning i uge 2 (afhentUge) + leveret og annulleret.
export const MIN_SIDE_STATUS_NU = '2026-12-21T09:00:00.000Z';
function minSideStatusOrdrer() {
  const m = (nr, ref, bestilt, ekstra = {}) => ({ ...ordreI(nr, 'med_login', { medLaek: false }), ref, bestilt, ...ekstra });
  const uge2 = trin('uge_bekraeftet', { aar: 2027, uge: 2, praecis: true }, '2026-12-01T09:00:00.000Z');
  const o11 = m(11, 'NI-4C83B2E5', '2026-11-20T09:00:00.000Z');
  return [
    m(9, 'NI-2A61F0C3', '2026-11-25T09:00:00.000Z'),
    m('05a', 'NI-3B72A1D4', '2026-11-22T09:00:00.000Z'),
    { ...o11, forloeb: [uge2].map(({ sat_af, ...f }) => f) },
    m(10, 'NI-7C21E0B5', '2026-09-02T08:00:00.000Z'),
    m('14u', 'NI-5D94C3F6', '2026-08-14T08:00:00.000Z'),
  ];
}

// Min side: svaret fra GET /api/min-side (kontrakter §6)
export function minSideData({ tom = false, nede = false, status = false } = {}) {
  if (tom) return { email: 'jonas.berg@eksempel.dk', ordrer: [], designs: [], gemt_uden_login: [] };
  if (status) return { ...minSideData(), ordrer: minSideStatusOrdrer() };
  const o3 = ordreI(3, 'med_login', { medLaek: false });
  const o10 = { ...ordreI(10, 'med_login', { medLaek: false }), ref: 'NI-7C21E0B5', bestilt: '2026-09-02T08:00:00.000Z' };
  return {
    email: EMAIL,
    ordrer: nede ? { fejl: 'nede' } : [o10, o3],
    designs: [
      { id: '0b9f6c1e-1f3a-4c55-9a77-1d2e3f4a5b6c', produkt: 'hoejskab', navn: 'Garderobe til soveværelset', t: 'eyJiIjoxODB9', pris_oere: 2148750, gemt: '2026-11-02T15:20:00.000Z' },
      { id: '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', produkt: 'hoejskab', navn: 'Skabsvæg, udgave med skuffer', t: 'eyJiIjoyNDB9', pris_oere: 1518750, gemt: '2026-10-30T10:00:00.000Z' },
      { id: '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d', produkt: 'baenk', navn: 'Bænk til entréen', t: 'eyJiIjoxNDB9', pris_oere: 624375, gemt: '2026-10-18T09:00:00.000Z' },
    ],
    gemt_uden_login: [
      { id: 4711, produkt: 'locker', titel: 'Lockerskab', dato: '2026-10-09T12:00:00.000Z', permalink: 'https://designer.neminventar.dk/designer?p=locker&t=eyJzb2VqbGVyIjozfQ', pris_oere: null },
    ],
  };
}
