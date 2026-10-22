// node --test src/lib/kilde.test.ts  (Node 24: TypeScript køres direkte)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foersteBesoeg, mailtoMedEmne, medKilde, medKildeTilKontakt, sideMedKilde, starterPrivat, KILDE_SVAR } from './kilde.ts';

function lager() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

test('ekstern referrer gemmes som hostname, og første besøg vinder', () => {
  const ss = lager();
  const a = foersteBesoeg({ referrer: 'https://chatgpt.com/c/abc?x=1', href: 'https://neminventar.dk/toiletbaase/?utm_source=chatgpt.com', host: 'neminventar.dk' }, ss);
  assert.deepEqual(a, { referrer_host: 'chatgpt.com', landingsside: '/toiletbaase/', utm: { utm_source: 'chatgpt.com' } });
  const b = foersteBesoeg({ referrer: 'https://neminventar.dk/', href: 'https://neminventar.dk/kontakt/', host: 'neminventar.dk' }, ss);
  assert.equal(b.referrer_host, 'chatgpt.com');
  assert.equal(b.landingsside, '/toiletbaase/');
});

test('intern referrer giver tom kilde', () => {
  const a = foersteBesoeg({ referrer: 'https://neminventar.dk/lockers/', href: 'https://neminventar.dk/kontakt/', host: 'neminventar.dk' }, lager());
  assert.equal(a.referrer_host, '');
  assert.equal(a.landingsside, '/kontakt/');
});

test('virker uden storage (privat vindue)', () => {
  const ss = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const a = foersteBesoeg({ referrer: '', href: 'https://neminventar.dk/', host: 'neminventar.dk' }, ss);
  assert.deepEqual(a, { referrer_host: '', landingsside: '/', utm: {} });
});

test('klik-id\'er fra annoncer fanges sammen med utm_*, øvrige parametre ignoreres, utm skæres til 100 tegn og klik-id\'er til 200', () => {
  const lang = 'x'.repeat(150);
  const a = foersteBesoeg({
    referrer: 'https://www.google.com/',
    href: `https://neminventar.dk/toiletbaase/?utm_source=google_ads&utm_medium=cpc&gclid=EAIaIQ&gbraid=0AAA&wbraid=CjkB&fbclid=IwAR&sporing=1&ref=abc&gclid2=nej&gclid3=${lang}`,
    host: 'neminventar.dk',
  }, lager());
  assert.deepEqual(a.utm, { utm_source: 'google_ads', utm_medium: 'cpc', gclid: 'EAIaIQ', gbraid: '0AAA', wbraid: 'CjkB', fbclid: 'IwAR' });
  const b = foersteBesoeg({ referrer: '', href: `https://neminventar.dk/?gclid=${'x'.repeat(250)}&fbclid=${lang}&utm_campaign=${lang}`, host: 'neminventar.dk' });
  assert.equal(b.utm.gclid.length, 200);
  assert.equal(b.utm.fbclid.length, 150, 'et klik-id under 200 tegn skæres ikke');
  assert.equal(b.utm.utm_campaign.length, 100);
  // utm-objektet med klik-id'er skal stadig kunne gemmes af contact-form (JSON ≤ 1000 tegn): et realistisk annoncebesøg er langt under
  const typisk = foersteBesoeg({ referrer: '', host: 'neminventar.dk',
    href: `https://neminventar.dk/x/?utm_source=google_ads&utm_medium=cpc&utm_campaign=skoler-efterår&utm_term=lockers&utm_content=annonce1&gclid=${'g'.repeat(100)}&fbclid=${'f'.repeat(100)}` });
  assert.ok(JSON.stringify(typisk.utm).length <= 1000);
});

const D = 'https://designer.neminventar.dk/designer.html';
const ANNONCE = '?utm_source=google_ads&utm_medium=cpc&utm_campaign=skoler&gclid=EAIaIQ';

test('medKilde lægger sidens utm_* og klik-id\'er på et link til designeren', () => {
  assert.equal(medKilde(`${D}?p=locker&t=eyJhIjoxfQ`, ANNONCE), `${D}?p=locker&t=eyJhIjoxfQ&utm_source=google_ads&utm_medium=cpc&utm_campaign=skoler&gclid=EAIaIQ`);
  assert.equal(medKilde(D, '?gbraid=0AAA&wbraid=CjkB&fbclid=IwAR'), `${D}?gbraid=0AAA&wbraid=CjkB&fbclid=IwAR`, 'link uden query får ?');
  assert.equal(medKilde(`${D}?`, '?gclid=a'), `${D}?gclid=a`, 'tom query: intet dobbelt ?');
  assert.equal(medKilde(`${D}?p=locker&`, '?gclid=a'), `${D}?p=locker&gclid=a`, 'afsluttende &: ingen dobbelt &');
  assert.equal(medKilde(`${D}?p=locker#trin3`, '?gclid=a'), `${D}?p=locker&gclid=a#trin3`, 'før ankeret');
  assert.equal(medKilde(`${D}?p=locker&hent=ifc`, '?utm_term=høj skab&gclid=a%2Bb'), `${D}?p=locker&hent=ifc&utm_term=h%C3%B8j%20skab&gclid=a%2Bb`, 'værdier kodes');
});

test('medKilde rører ikke parametre, linket allerede har', () => {
  assert.equal(medKilde(`${D}?p=locker&utm_source=mail&gclid=DEN-GAMLE`, ANNONCE), `${D}?p=locker&utm_source=mail&gclid=DEN-GAMLE&utm_medium=cpc&utm_campaign=skoler`);
  const fuldt = `${D}?p=locker&utm_source=a&utm_medium=b&utm_campaign=c&gclid=d`;
  assert.equal(medKilde(fuldt, ANNONCE), fuldt, 'alt er der allerede: præcis samme streng');
  // selve linket (rækkefølge, kodning) rekonstrueres aldrig: kun nye parametre sættes bag på
  const t = `${D}?p=hoejskab&t=${'A-_'.repeat(20)}`;
  assert.ok(medKilde(t, ANNONCE).startsWith(t + '&'));
});

test('medKilde lader andre links være', () => {
  for (const h of [
    'https://neminventar.dk/kontakt/', 'https://neminventar.dk/designer.neminventar.dk', 'mailto:tilbud@neminventar.dk', 'tel:+4542422684',
    '/lockers/', 'lockers/', '#send', '', 'ikke et link', '//designer.neminventar.dk/designer.html',
    'http://designer.neminventar.dk/designer.html', 'https://designer.neminventar.dk.evil.example/designer.html',
    'https://evil.example/?u=designer.neminventar.dk', 'https://designer.neminventar.dk@evil.example/', 'https://ni-designer.pages.dev/designer.html?p=locker',
    'https://designer.neminventar.dk:8443/designer.html', 'https://xdesigner.neminventar.dk/designer.html',
  ]) assert.equal(medKilde(h, ANNONCE), h, h);
});

test('medKilde ignorerer andre query-parametre og gør intet, når siden ikke har nogen kilde', () => {
  assert.equal(medKilde(`${D}?p=locker`, '?foo=1&ref=abc&gclid2=x&sporing=1&UTM_SOURCE=x&xutm_source=y'), `${D}?p=locker`);
  assert.equal(medKilde(`${D}?p=locker`, '?foo=1&utm_source=x&bar=2'), `${D}?p=locker&utm_source=x`);
  assert.equal(medKilde(`${D}?p=locker`, ''), `${D}?p=locker`);
  assert.equal(medKilde(`${D}?p=locker`, '?'), `${D}?p=locker`);
});

test('mailto får emne, eksisterende emne bevares', () => {
  assert.equal(mailtoMedEmne('mailto:tilbud@neminventar.dk', 'Lockers'),
    'mailto:tilbud@neminventar.dk?subject=' + encodeURIComponent('Forespørgsel fra neminventar.dk – Lockers'));
  assert.equal(mailtoMedEmne('mailto:a@b.dk?subject=Hej', 'X'), 'mailto:a@b.dk?subject=Hej');
  assert.equal(mailtoMedEmne('mailto:a@b.dk?cc=c@d.dk', 'X'), 'mailto:a@b.dk?cc=c@d.dk&subject=' + encodeURIComponent('Forespørgsel fra neminventar.dk – X'));
});

// 22-10-2026: annonceklikkeren, der går fra en landingsside videre til /kontakt/, skal have kilden med
const SIDE = 'https://neminventar.dk/garderobeskab/';
test('medKildeTilKontakt: links til /kontakt på sitet får annoncens utm_* og klik-id\'er', () => {
  assert.equal(medKildeTilKontakt('/kontakt?emne=Garderobeskab', ANNONCE, SIDE), '/kontakt?emne=Garderobeskab&utm_source=google_ads&utm_medium=cpc&utm_campaign=skoler&gclid=EAIaIQ');
  assert.equal(medKildeTilKontakt('/kontakt/', '?utm_source=google_ads', SIDE), '/kontakt/?utm_source=google_ads');
  assert.equal(medKildeTilKontakt('https://neminventar.dk/kontakt', '?gclid=a', SIDE), 'https://neminventar.dk/kontakt?gclid=a');
  assert.equal(medKildeTilKontakt('/kontakt?utm_source=mail', ANNONCE, SIDE), '/kontakt?utm_source=mail&utm_medium=cpc&utm_campaign=skoler&gclid=EAIaIQ', 'eksisterende parametre røres ikke');
  assert.equal(medKildeTilKontakt('/kontakt#send', '?gclid=a', SIDE), '/kontakt?gclid=a#send', 'før ankeret');
});
test('medKildeTilKontakt lader alt andet være', () => {
  for (const h of ['/garderobeskab/', '/kontakt-os/', '/kontakter', 'mailto:tilbud@neminventar.dk', 'tel:+4542422684', '#send', '',
    'https://evil.example/kontakt', 'https://neminventar.dk.evil.example/kontakt', 'kontakt', `${D}?p=locker`])
    assert.equal(medKildeTilKontakt(h, ANNONCE, SIDE), h, h);
  assert.equal(medKildeTilKontakt('/kontakt', '', SIDE), '/kontakt', 'ingen kilde på siden');
  assert.equal(medKildeTilKontakt('/kontakt', '?foo=1', SIDE), '/kontakt');
});
test('sideMedKilde: siden med utm først og klik-id sidst, højst 200 tegn', () => {
  assert.equal(sideMedKilde('/garderobeskab/', ''), '/garderobeskab/');
  assert.equal(sideMedKilde('/garderobeskab/', '?gclid=G&utm_source=google_ads&utm_campaign=privat-skabe&foo=1'), '/garderobeskab/?utm_source=google_ads&utm_campaign=privat-skabe&gclid=G');
  const lang = sideMedKilde('/garderobeskab/', `?gclid=${'g'.repeat(200)}&utm_source=google_ads&utm_term=skab%20p%C3%A5%20m%C3%A5l`);
  assert.equal(lang.length, 200);
  assert.ok(lang.startsWith('/garderobeskab/?utm_source=google_ads&utm_term=skab%20p%C3%A5%20m%C3%A5l&gclid='), lang);
});
test('starterPrivat: sider til private og privatkampagner', () => {
  assert.equal(starterPrivat('?emne=Garderobeskab'), true);
  assert.equal(starterPrivat('?emne=B%C3%A6nk'), true);
  assert.equal(starterPrivat('?utm_campaign=privat-skabe'), true);
  assert.equal(starterPrivat('?emne=Toiletb%C3%A5se'), false);
  assert.equal(starterPrivat('?utm_campaign=erhverv-toiletbaase'), false);
  assert.equal(starterPrivat(''), false);
});

test('svarmulighederne er de seks fra spec §4', () => {
  assert.deepEqual([...KILDE_SVAR], ['Google', 'ChatGPT eller anden AI', 'Anbefaling', 'LinkedIn', 'Vi har arbejdet sammen før', 'Andet']);
});
