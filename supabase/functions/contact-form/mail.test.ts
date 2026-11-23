// node --test supabase/functions/contact-form/mail.test.ts  (Node 24: TypeScript køres direkte; deno test virker også)
// Beskederne herunder er designerens og formularens rigtige formater (november 2026) med opdigtede navne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bygMail, designerSpec, emnelinje, historikAf, normPhone, resumeAf, specFraKonfiguration, specLinjer, tilstandAf,
  variantInfo, vedrAf, type MailInput,
} from './mail.ts';

const BAENK = '(ingen besked)\n\nBygget i designeren (Bænk):\n1. Bænk 70 × 42 × 50 cm — Mål (b × h × d): 70 × 42 × 50 cm · Sædehøjde: 42 cm, 48 cm med hynde · Materiale: Massiv eg, klar olie · Opbygning: Top og bund går hen over siderne, så sædet hviler direkte på dem · skufferne fingertappede i massivt træ, plant i rammen · Under sædet: 1 skuffe side om side under sædet · Greb: Uden greb — skufferne åbner, når du trykker · Plade: Massiv eg, stavlimet 20 mm\n\nLevering: Flatpack · Til kantsten\nPris i designeren: pris følger';
const BAENK_PRIS = 'Bænken skal stå i vores entré og skal bruges til skoopbevaring.\n\nBygget i designeren (Bænk):\n1. Bænk 110 × 42 × 40 cm — Mål (b × h × d): 110 × 42 × 40 cm · Sædehøjde: 42 cm · sokkel 15 cm · Materiale: Shinnoki Natural Oak · Greb: Uden greb — skufferne åbner, når du trykker\n\nLevering: Flatpack · Til kantsten\nPris i designeren: 8.288 kr. inkl. moms (privat)';
const SKABE = 'Sprog: engelsk (designeren på engelsk) — svar på engelsk\n\nThree for the hallway\n\nBygget i designeren (Højskab):\n1. Skabsvæg: 4 højskabe à 60 × 210 × 60 cm — Skabe: 4 side om side · Materiale: Fyrrekrydsfiner, klar olie\n2. Højskab 40 × 210 × 60 cm × 2 — Materiale: Fyrrekrydsfiner, klar olie';

// Et udsnit af sitets varianter.json (src/pages/varianter.json.ts), som det så ud 23-11-2026, med pris-feltet fra v10
const D = 'https://designer.neminventar.dk/designer.html';
const kod = (st: unknown) => btoa(JSON.stringify(st)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const VJ = {
  paletter: { olie: [{ kuloer: 'natur', label: 'Klar olie' }, { kuloer: 'cotton-white', label: 'Cotton White' }, { kuloer: 'dark-roast', label: 'Dark Roast' }], hpl: [], kompakt: [], stof: [] },
  typer: [
    {
      slug: 'hoejskab-krydsfiner', navn: 'Højskab i krydsfiner', url: 'https://neminventar.dk/produkter/hoejskab-krydsfiner',
      designer: `${D}?p=hoejskab&t=${kod({ mat: 'kryds', farve: { kryds: 'natur' } })}`,
      pris: { inkl: 11200, ex: 8960, link: `${D}?p=hoejskab&t=x` },
      varianter: [{ kuloer: 'cotton-white', label: 'Cotton White', img: 'https://neminventar.dk/_b/cw-w480.webp', url: 'https://neminventar.dk/produkter/hoejskab-krydsfiner#v-cotton-white',
        ifc: `${D}?p=hoejskab&t=${kod({ mat: 'kryds', front: 'farve', farve: { kryds: 'natur', laage: 'cotton-white' } })}&hent=ifc` }],
    },
    {
      slug: 'lockerbank-omklaedning', navn: 'Lockerbank til omklædning', url: 'https://neminventar.dk/produkter/lockerbank-omklaedning', designer: null, pris: null,
      varianter: [{ kuloer: 'dark-roast', label: 'Dark Roast', img: null, url: 'https://neminventar.dk/produkter/lockerbank-omklaedning#v-dark-roast', ifc: null }],
    },
    { slug: 'gammel-type', navn: 'Gammel type', url: 'https://neminventar.dk/produkter/gammel-type', designer: null, varianter: [] },
  ],
};

const basis = (x: Partial<MailInput>): MailInput => ({
  name: 'Mette Hansen', company: 'Privatkunde', email: 'mette@example.dk', phone: '60 00 00 01', message: 'Hej', side: '/kontakt/',
  spor: 'besked', kanal: 'Google', kildeSvar: 'Google', referrerHost: '', landingsside: '/kontakt/',
  konfiguration: null, permalink: '', files: [], valgteFiler: 0, folder: '2026-11/abc', bucket: 'web-henvendelser', linkDays: 30,
  leadId: 'fcd16b2b-eaa5-4e17-858a-850c2be71123', leadNote: '', rowId: '6650bfcf-6f4e-435d-8b2b-051ed74a77a9', historik: [],
  ...x,
});

test('designerens tekst bliver til en tabel: fortsættelser, ordre og "pris følger"', () => {
  const s = designerSpec(BAENK)!;
  assert.equal(s.produkt, 'Bænk');
  assert.equal(s.egneOrd, '');
  assert.equal(s.engelsk, false);
  assert.equal(s.varer.length, 1);
  assert.equal(s.varer[0].titel, 'Bænk 70 × 42 × 50 cm');
  const l = Object.fromEntries(s.varer[0].linjer);
  assert.equal(l['Mål (b × h × d)'], '70 × 42 × 50 cm');
  assert.equal(l['Materiale'], 'Massiv eg, klar olie');
  assert.equal(l['Opbygning'], 'Top og bund går hen over siderne, så sædet hviler direkte på dem · skufferne fingertappede i massivt træ, plant i rammen');
  assert.equal(l['Greb'], 'Uden greb — skufferne åbner, når du trykker');
  assert.deepEqual(s.ordre, [['Levering', 'Flatpack · Til kantsten'], ['Pris i designeren', 'pris følger']]);
  assert.equal(s.pris, null);
  assert.equal(s.prisFoelger, true);
});

test('designerens pris og kundens egne ord', () => {
  const s = designerSpec(BAENK_PRIS)!;
  assert.equal(s.pris, '8.288 kr. inkl. moms (privat)');
  assert.equal(s.egneOrd, 'Bænken skal stå i vores entré og skal bruges til skoopbevaring.');
  assert.deepEqual(s.varer[0].linjer[1], ['Sædehøjde', '42 cm · sokkel 15 cm']);
});

test('den engelske designer og flere varer', () => {
  const s = designerSpec(SKABE)!;
  assert.equal(s.engelsk, true);
  assert.equal(s.egneOrd, 'Three for the hallway');
  assert.deepEqual(s.varer.map((v) => v.titel), ['Skabsvæg: 4 højskabe à 60 × 210 × 60 cm', 'Højskab 40 × 210 × 60 cm × 2']);
  assert.deepEqual(s.ordre, []);
  assert.equal(designerSpec('Vi skal bruge 12 lockers'), null);
});

test('spec-linjer', () => {
  assert.deepEqual(specLinjer('Hængsler: 4 pr. låge · standard · Greb: Fingergreb'), [['Hængsler', '4 pr. låge · standard'], ['Greb', 'Fingergreb']]);
  assert.deepEqual(specLinjer(''), []);
});

test('formularens "Vedr."-linje skilles fra kundens egne ord', () => {
  assert.deepEqual(vedrAf('Vedr. Højskab i krydsfiner, cotton white\nAlt. klar olie'), { emne: 'Højskab i krydsfiner, cotton white', rest: 'Alt. klar olie' });
  assert.deepEqual(vedrAf('Et garderobeskab'), { emne: null, rest: 'Et garderobeskab' });
});

test('varianten slås op i sitets varianter.json: navn, kulør, låger, designer og pris', () => {
  const v = variantInfo(VJ, { type: 'variant', produkt: 'hoejskab-krydsfiner', kuloer: 'cotton-white' })!;
  assert.equal(v.navn, 'Højskab i krydsfiner');
  assert.equal(v.label, 'Cotton White');
  assert.equal(v.url, 'https://neminventar.dk/produkter/hoejskab-krydsfiner#v-cotton-white');
  assert.equal(v.laager, true);
  assert.equal(v.korpus, 'klar olie');
  assert.ok(v.designer && !v.designer.includes('hent='));
  assert.deepEqual(v.pris, { inkl: 11200, ex: 8960, link: `${D}?p=hoejskab&t=x` });
  const l = variantInfo(VJ, { type: 'variant', produkt: 'lockerbank-omklaedning', kuloer: 'dark-roast' })!;
  assert.equal(l.laager, false);
  assert.equal(l.pris, null);
  assert.equal(l.designer, null);
  // kulør uden render: navnet fra paletten; varianter.json uden pris-felt: undefined
  const g = variantInfo(VJ, { type: 'variant', produkt: 'gammel-type', kuloer: 'natur' })!;
  assert.equal(g.label, 'Klar olie');
  assert.equal(g.pris, undefined);
  assert.equal(variantInfo(VJ, { type: 'variant', produkt: 'findes-ikke', kuloer: 'natur' }), null);
  assert.equal(variantInfo(null, { type: 'variant', produkt: 'hoejskab-krydsfiner', kuloer: 'natur' }), null);
});

test('resumé og emne: variant med docx', () => {
  const v = variantInfo(VJ, { type: 'variant', produkt: 'hoejskab-krydsfiner', kuloer: 'cotton-white' });
  const i = basis({
    spor: 'variant', message: 'Vedr. Højskab i krydsfiner, cotton white\nAlt. klar olie',
    konfiguration: { type: 'variant', produkt: 'hoejskab-krydsfiner', kuloer: 'cotton-white' }, variant: v,
    files: [{ name: 'Garderobeskabe.docx', size: 6649, path: '2026-11/abc/01_Garderobeskabe.docx', url: 'https://x/docx' }], valgteFiler: 1,
    udtraek: { '2026-11/abc/01_Garderobeskabe.docx': { tekst: 'Jeg skal bruge 3 garderobeskabe.', afkortet: false } },
  });
  assert.equal(resumeAf(i), 'Mette Hansen (privat) spørger om højskab i krydsfiner med låger i Cotton White. Skriver også: "Alt. klar olie". Vedhæftet: Garderobeskabe.docx. Garderobeskabe.docx begynder: "Jeg skal bruge 3 garderobeskabe". Kom fra Google.');
  assert.equal(emnelinje(i), 'Web-henvendelse: Mette Hansen · Højskab i krydsfiner, Cotton White · 1 fil [CRM fcd16b2b]');
  const h = bygMail(i).html;
  assert.match(h, /11\.200 kr\.<\/strong> inkl\. moms \(8\.960 kr\. ekskl\. moms\)/);
  assert.match(h, /Cotton White på lågerne, korpus i klar olie/);
  assert.match(h, /Jeg skal bruge 3 garderobeskabe\./);
  assert.match(h, /Åbn varianten i designeren/);
  assert.match(h, /Vedr\. Højskab i krydsfiner, cotton white<br>Alt\. klar olie/);
});

test('variant uden data fra sitet: linket og "Vedr."-linjen bærer den', () => {
  const i = basis({ spor: 'variant', message: 'Vedr. Lockerbank til omklædning, dark roast\n\nKan I give en vejledende pris?', konfiguration: { type: 'variant', produkt: 'lockerbank-omklaedning', kuloer: 'dark-roast' }, variant: null });
  assert.equal(resumeAf(i), 'Mette Hansen (privat) spørger om Lockerbank til omklædning, dark roast. Skriver også: "Kan I give en vejledende pris?". Kom fra Google.');
  assert.match(bygMail(i).html, /produkter\/lockerbank-omklaedning#v-dark-roast/);
});

test('resumé og emne: designeren (3D-billedet tæller ikke som kundens fil)', () => {
  const render = { name: 'designer-1.png', size: 738349, path: '2026-11/abc/01_designer-1.png', url: 'https://x/render.png' };
  const i = basis({ spor: 'designer', company: 'Privatkunde', phone: '', message: BAENK, permalink: `${D}?p=baenk&t=x`, files: [render], valgteFiler: 1 });
  assert.equal(resumeAf(i), 'Mette Hansen (privat) har bygget bænk 70 × 42 × 50 cm i designeren (Massiv eg, klar olie). Designeren kunne ikke regne en pris. Kom fra Google.');
  assert.equal(emnelinje(i), 'Web-henvendelse: Mette Hansen · Designer: Bænk 70 × 42 × 50 cm [CRM fcd16b2b]');
  const h = bygMail(i).html;
  assert.match(h, /Bygget i designeren: Bænk/);
  assert.match(h, /<img src="https:\/\/x\/render\.png"/);
  assert.match(h, /Ingen besked, kun det byggede\./);
  assert.doesNotMatch(h, /Vedhæftet \(/);
  const p = basis({ spor: 'designer', company: 'Hansen Arkitekter', message: BAENK_PRIS });
  assert.equal(resumeAf(p), 'Mette Hansen fra Hansen Arkitekter har bygget bænk 110 × 42 × 40 cm i designeren (Shinnoki Natural Oak). Skriver: "Bænken skal stå i vores entré og skal bruges til skoopbevaring". Designerens pris: 8.288 kr. inkl. moms (privat). Kom fra Google.');
  assert.match(bygMail(p).html, /<strong>8\.288 kr\. inkl\. moms \(privat\)<\/strong>/);
  const e = basis({ spor: 'designer', message: SKABE, kanal: 'Ukendt' });
  assert.match(resumeAf(e), /har bygget 2 ting \(skabsvæg: 4 højskabe à 60 × 210 × 60 cm, højskab 40 × 210 × 60 cm × 2\) i designeren\. Skriver: "Three for the hallway"\. Skrev fra den engelske designer, så svar på engelsk\. Kilden er ukendt\.$/);
  assert.match(emnelinje(e), /Designer: Højskab, 2 ting/);
});

test('besked med billeder: billederne står inline, beskeden med linjeskift', () => {
  const f = (n: number, name: string) => ({ name, size: 70000, path: `2026-11/abc/0${n}_${name}`, url: `https://x/${n}` });
  const i = basis({ message: 'Et garderobeskab, der passer ind et indhak.\n\nDer skal være garderobestang.', files: [f(1, 'Mål.jpg'), f(2, 'a.png'), f(3, 'b.png')], valgteFiler: 3 });
  assert.equal(resumeAf(i), 'Mette Hansen (privat) skriver: "Et garderobeskab, der passer ind et indhak". Vedhæftet: 3 billeder (vist nedenfor). Kom fra Google.');
  assert.equal(emnelinje(i), 'Web-henvendelse: Mette Hansen · Et garderobeskab, der passer ind et indhak. · 3 filer [CRM fcd16b2b]');
  const h = bygMail(i).html;
  assert.equal((h.match(/<img /g) ?? []).length, 3);
  assert.match(h, /indhak\.<br><br>Der skal være/);
  // blandede filer: billede, tekst og andre
  const j = basis({ files: [f(1, 'foto.heic'), f(2, 'tegning.pdf'), f(3, 'noter.txt')], udtraek: { '2026-11/abc/03_noter.txt': { tekst: 'x', afkortet: false } } });
  assert.match(resumeAf(j), /Vedhæftet: noter\.txt, foto\.heic og tegning\.pdf\. noter\.txt begynder: "x"\./);
  assert.equal((bygMail(j).html.match(/<img /g) ?? []).length, 0);
});

test('mailen escaper alt fra kunden', () => {
  const i = basis({ name: '<b>x</b>', message: '<script>alert(1)</script>' });
  const { html, subject } = bygMail(i);
  assert.doesNotMatch(html, /<script>|<b>x<\/b>/);
  assert.doesNotMatch(subject, /\n/);
});

test('historikken: samme mail eller telefon, uden denne henvendelse og dens nye lead', () => {
  const row = '6650bfcf-0000-0000-0000-000000000000', lead = 'fcd16b2b-0000-0000-0000-000000000000';
  const h = historikAf({
    email: 'Mette@Example.dk', phone: '+45 60 00 00 01', rowId: row, leadId: lead, nytLead: true,
    henvendelser: [
      { id: row, created_at: '2026-11-23T20:24:35Z', kind: 'besked', message: 'denne', email: 'mette@example.dk', crm_deal_id: lead },
      { id: 'w1', created_at: '2026-11-10T19:22:01Z', kind: 'besked', message: BAENK, email: 'mette@example.dk', crm_deal_id: '49c988a4-1111' },
      { id: 'w2', created_at: '2026-10-01T10:00:00Z', kind: 'besked', message: 'Vedr. Højskab i krydsfiner, blå', email: 'andet@example.dk', phone: '60000001', crm_deal_id: null },
      { id: 'w3', created_at: '2026-10-02T10:00:00Z', kind: 'honeypot', message: 'bot', email: 'mette@example.dk' },
      { id: 'w4', created_at: '2026-10-03T10:00:00Z', kind: 'besked', message: 'anden', email: 'xmette@example.dk', phone: '12345678' },
    ],
    leads: [
      { id: lead, created_at: '2026-11-23T20:24:34Z', title: 'Web: Mette', contact_info: 'Mette · Privatkunde · mette@example.dk' },
      { id: '49c988a4-1111', created_at: '2026-11-10T19:22:01Z', title: 'Web: Mette', contact_info: 'Mette · mette@example.dk' },
      { id: 'aa11bb22-2222', created_at: '2026-09-30T08:00:00Z', title: 'Opkald: Mette', pipeline_stage: 'lead', primary_contact_phone: '+45 60 00 00 01' },
    ],
  });
  assert.deepEqual(h.map((x) => [x.dato, x.emne, x.lead]), [
    ['10-11-2026', 'Designer: Bænk 70 × 42 × 50 cm', '49c988a4'],
    ['01-10-2026', 'Højskab i krydsfiner, blå', null],
    ['30-09-2026', 'Opkald: Mette', 'aa11bb22'],
  ]);
  // føjet til et eksisterende lead: leadet er historik, ikke nyt
  const g = historikAf({ email: 'mette@example.dk', phone: '', rowId: row, leadId: lead, nytLead: false, henvendelser: [], leads: [{ id: lead, created_at: '2026-11-20T10:00:00Z', title: 'Web: Mette', contact_info: 'Mette · mette@example.dk' }] });
  assert.equal(g.length, 1);
  assert.match(bygMail(basis({ historik: h })).html, /Har skrevet før \(3\):.*10-11-2026 · Designer: Bænk 70 × 42 × 50 cm · lead 49c988a4/s);
  assert.match(bygMail(basis({ historik: [] })).html, /Første henvendelse/);
  assert.match(bygMail(basis({ historik: null })).html, /Historik: kunne ikke slås op\./);
});

test('reserven: konfigurationen, hvis designerens tekst mangler', () => {
  const f = specFraKonfiguration({ b: 60, h: 210, d: 60, n: 4, mat: 'kryds', front: 'farve', farve: { kryds: 'natur', laage: 'blaa' }, greb: 'finger' }, `${D}?p=hoejskab&t=x`)!;
  assert.equal(f.produkt, 'Højskab');
  assert.deepEqual(f.linjer, [['Mål pr. skab', '60 × 210 × 60 cm, 4 skabe'], ['Materiale', 'Krydsfiner (fyr), klar olie'], ['Låger', 'farvet olie, Blå'], ['Greb', 'Fingergreb']]);
  const i = basis({ spor: 'designer', message: 'Kun en besked', konfiguration: { mat: 'kryds' }, permalink: `${D}?p=locker&t=x` });
  assert.match(bygMail(i).html, /Udledt af konfigurationen/);
  assert.equal(specFraKonfiguration(null, ''), null);
});

test('designerens tilstand fra et link og telefonnumre', () => {
  assert.deepEqual(tilstandAf(`${D}?p=hoejskab&t=${kod({ mat: 'kryds' })}`), { mat: 'kryds' });
  assert.equal(tilstandAf('ikke et link'), null);
  assert.equal(normPhone('+45 60 14 36 84'), '60143684');
  assert.equal(normPhone('004560143684'), '60143684');
});

test('egne tekster i resuméet har ingen tankestreger', () => {
  for (const m of [BAENK, BAENK_PRIS, SKABE]) assert.doesNotMatch(resumeAf(basis({ spor: 'designer', message: m })), / — /);
});
