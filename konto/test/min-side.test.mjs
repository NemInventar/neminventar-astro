// Min side (Fable b "Min side", c3–c7, d3) og log ind (c1, d1, d2) — renderet i Node mod fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMinSide, renderMinSideFejl, statusTekst, renderLogUdAlle, renderSletTrin, renderDesignSvar } from '../src/lib/min-side-visning.mjs';
import { renderEmailVenstre, renderEmailForm, renderKodeVenstre, renderKodeForm, renderLoginLukket, fejlBesked, beskedHtml } from '../src/lib/login-visning.mjs';
import { t } from '../src/lib/tekst.mjs';
import { TILSTANDE, ordreI, minSideData, EMAIL } from './fixtures.mjs';

const DESIGNER = 'https://designer.neminventar.dk/designer.html';
const NU = '2026-11-12T10:00:00.000Z';
const tekstAf = (html) => html.replace(/<(div|p|td|th|tr|small)\b[^>]*>/g, ' ').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Statuskolonnen (Fable d3 best.status.*) — ordret på dansk og engelsk
const STATUS = {
  1: ['Leveringsugen bekræftes senest mandag 9. november', 'Delivery week will be confirmed by Monday 9 November'],
  2: ['Leveringsugen er ikke bekræftet endnu', 'The delivery week has not been confirmed yet'],
  3: ['Leveres i uge 51 (14.–18. december 2026)', 'Delivery in week 51 (14–18 December 2026)'],
  4: ['Leveres i uge 2 (11.–15. januar 2027)', 'Delivery in week 2 (11–15 January 2027)'],
  5: ['Leveringen i uge 51 er ikke aftalt endnu', 'Delivery in week 51 has not been agreed yet'],
  6: ['Leveres tirsdag 15. december', 'Delivery on Tuesday 15 December'],
  7: ['Leveres torsdag 17. december', 'Delivery on Thursday 17 December'],
  8: ['Leveres i dag', 'Delivery today'],
  9: ['Aftalt levering tirsdag 15. december', 'Delivery agreed for Tuesday 15 December'],   // Fable runde 4, 5
  10: ['Leveret 15. december 2026', 'Delivered 15 December 2026'],
  11: ['Klar til afhentning i uge 51 (14.–18. december 2026)', 'Ready for collection in week 51 (14–18 December 2026)'],
  12: ['Klar til afhentning', 'Ready for collection'],
  13: ['Hentet 15. december 2026', 'Collected 15 December 2026'],
  14: ['Annulleret', 'Cancelled'],
  15: ['Fortrudt', 'Withdrawn'],
  16: ['Leveres i uge 51 (14.–18. december 2026)', 'Delivery in week 51 (14–18 December 2026)'],
};

for (const s of TILSTANDE) {
  test(`statuskolonnen, tilstand ${s.nr}`, () => {
    const o = ordreI(s.nr, 'med_login', { medLaek: false });
    assert.ok(STATUS[s.nr], `tilstand ${s.nr} har en status`);
    assert.equal(statusTekst(o, s.nu, 'da'), STATUS[s.nr][0]);
    assert.equal(statusTekst(o, s.nu, 'en'), STATUS[s.nr][1]);
  });
}

test('statuskolonnen, afhentningsugen gået uden "klar" (Fable runde 4, 5)', () => {
  const o = ordreI(11, 'med_login', { medLaek: false });
  assert.equal(statusTekst(o, '2026-12-21T09:00:00.000Z', 'da'), 'Ikke klar til afhentning endnu');
  assert.equal(statusTekst(o, '2026-12-21T09:00:00.000Z', 'en'), 'Not ready for collection yet');
});

test('Min side: tre afsnit, bestillinger med link i første celle, nyeste øverst', () => {
  const h = renderMinSide({ data: minSideData(), sprog: 'da', nu: NU, designerUrl: DESIGNER, ny: true });
  const x = tekstAf(h);
  for (const k of ['side.h1', 'best.h2', 'design.h2', 'konto.h2', 'design.note', 'kode.oprettet', 'konto.emailHjaelp', 'konto.slet']) {
    assert.ok(x.includes(tekstAf(t('da', k))), k);
  }
  assert.ok(x.includes(t('da', 'side.loggetInd', { email: EMAIL })));
  assert.ok(h.includes('href="/ordre/#NI-1D078A14" aria-label="Bestilling NI-1D078A14"'), 'rigtigt link i første celle (36)');
  assert.ok(h.indexOf('NI-1D078A14') < h.indexOf('NI-7C21E0B5'), 'nyeste øverst');
  for (const k of t('da', 'best.kol').split(' · ')) assert.ok(h.includes(`>${k}</th>`), `kolonne ${k}`);
  assert.ok(!/<tr class="tot"/.test(h), 'ingen totalrække (Fable b)');
  assert.ok(!x.includes(t('en', 'best.kunDansk')));
});

test('Gemte designs: pris og link med gemt pris og dato; "Gemt uden login" uden billede, navn og pris', () => {
  const h = renderMinSide({ data: minSideData(), sprog: 'da', nu: NU, designerUrl: DESIGNER });
  assert.ok(h.includes('21.487,50 kr.'));
  assert.ok(h.includes('gemt_pris=2148750&amp;gemt_dato=2026-11-02'));
  const uden = /<tr data-design="4711"[\s\S]*?<\/tr>/.exec(h)[0];
  assert.ok(uden.includes(t('da', 'design.udenLogin')));
  assert.ok(uden.includes(t('da', 'design.udenLoginHjaelp')));
  assert.ok(uden.includes('Lockerskab'), 'produktets titel');
  assert.ok(uden.includes('>—<'), 'ingen pris → —');
  assert.ok(!uden.includes('data-handling="omdoeb"'), 'kan ikke omdøbes');
  assert.ok(uden.includes('data-handling="slet-design"'));
  assert.ok(h.indexOf('Garderobe til soveværelset') < h.indexOf('Lockerskab'), 'gemt uden login står nederst');
});

test('tom konto (Fable mockup 6): best.tom, best.tomHjaelp, design.tom og knappen', () => {
  const x = tekstAf(renderMinSide({ data: minSideData({ tom: true }), sprog: 'da', nu: NU, designerUrl: DESIGNER }));
  for (const k of ['best.tom', 'best.tomHjaelp', 'design.tom', 'design.tomKnap']) assert.ok(x.includes(t('da', k)), k);
  assert.ok(!x.includes(t('da', 'design.note')), 'noten står kun under designs');
});

test('broen nede: Bestillinger viser nede-linjen, designs og konto virker (plan §8)', () => {
  const h = renderMinSide({ data: minSideData({ nede: true }), sprog: 'da', nu: NU, designerUrl: DESIGNER });
  assert.ok(tekstAf(h).includes(t('da', 'nede')));
  assert.ok(h.includes('Garderobe til soveværelset'));
  assert.ok(h.includes('data-handling="log-ud-alle"'));
});

test('engelsk Min side: ordresiden er på dansk, beløb som DKK', () => {
  const h = renderMinSide({ data: minSideData(), sprog: 'en', nu: NU, designerUrl: DESIGNER });
  const x = tekstAf(h);
  assert.ok(x.includes('My account'));
  assert.ok(x.includes(t('en', 'best.kunDansk')));
  assert.ok(x.includes('DKK 16,012.50'));
  assert.ok(x.includes('7 November 2026'));
  assert.ok(h.includes('lang=en'), 'designerlinket på engelsk');
});

test('log ud alle steder og slet konto (Fable c6, c7)', () => {
  const a = tekstAf(renderLogUdAlle('spoerg', 'da'));
  for (const k of ['konto.logUdAlleSpoerg', 'konto.logUdAlleJa', 'konto.fortryd']) assert.ok(a.includes(t('da', k)));
  const s = renderSletTrin('kode', 'da');
  assert.ok(s.includes('inputmode="numeric"') && s.includes('autocomplete="one-time-code"'));
  assert.ok(tekstAf(s).includes(t('da', 'konto.sletKode')));
  assert.ok(tekstAf(s).includes(t('da', 'konto.sletJa')));
  assert.ok(tekstAf(renderDesignSvar('slet', 'da', { navn: 'Bænk' })).includes('Slet "Bænk"? Det kan ikke fortrydes.'));
});

test('Min side kan ikke vises: lukket og side.nede — første sætning er H1, resten brødtekst (Fable runde 4)', () => {
  const h1Af = (h) => /<h1[^>]*>(.*?)<\/h1>/s.exec(h)?.[1];
  const l = renderMinSideFejl('lukket', 'da');
  assert.equal(h1Af(l), 'Min side er ikke åben lige nu.');
  assert.equal(tekstAf(l), t('da', 'lukket'));
  assert.ok(l.includes('href="tel:+4542422684"') && l.includes('href="mailto:tilbud@neminventar.dk"'));
  const n = renderMinSideFejl('nede', 'en');
  assert.equal(h1Af(n), 'We cannot show My account right now.');
  assert.equal(tekstAf(n), t('en', 'side.nede'));
  assert.ok(!n.includes(t('en', 'nede')), '`nede` er kun rækken i Bestillinger');
});

test('log ind, flaget fra: første sætning af `lukket` er H1, resten brødtekst (Fable runde 4)', () => {
  const h = renderLoginLukket('da');
  assert.equal(/<h1[^>]*>(.*?)<\/h1>/s.exec(h)?.[1], 'Min side er ikke åben lige nu.');
  assert.ok(tekstAf(h).endsWith(t('da', 'lukket')));
  assert.ok(tekstAf(renderLoginLukket('en')).endsWith(t('en', 'lukket')));
});

test('log ind (d1): overskrift, rækker, felt med hjælp, note med privatlivspolitik', () => {
  for (const sp of ['da', 'en']) {
    const v = tekstAf(renderEmailVenstre(sp));
    const f = renderEmailForm(sp);
    for (const k of ['login.label', 'login.h1', 'login.lede', 'login.uden']) assert.ok(v.includes(t(sp, k)), `${sp} ${k}`);
    assert.ok(v.includes(sp === 'da' ? 'Leveringsuge, leveringsdag og det, du har bestilt' : 'Delivery week, delivery day and what you ordered'));
    assert.ok(f.includes('type="email"') && f.includes('autocomplete="email"'));
    assert.ok(tekstAf(f).includes(t(sp, 'login.emailHjaelp')));
    assert.ok(tekstAf(f).includes(t(sp, 'login.noteLead')), 'beslutning 11: noten nævner tilbuddet');
    assert.ok(f.includes('href="https://neminventar.dk/privatlivspolitik/"'));
    assert.ok(f.includes('role="alert"'), 'fejl læses op (36)');
  }
});

test('koden (d2): ét felt, numerisk, one-time-code, sender ikke selv; Ret e-mail', () => {
  const v = renderKodeVenstre('da', EMAIL);
  const f = renderKodeForm('da');
  assert.ok(tekstAf(v).includes(`Vi har sendt en kode på seks cifre til ${EMAIL}. Den gælder i 15 minutter.`));
  assert.ok(tekstAf(v).includes(t('da', 'kode.ret')));
  assert.ok(f.includes('inputmode="numeric"') && f.includes('autocomplete="one-time-code"'));
  assert.equal((f.match(/<input/g) ?? []).length, 1, 'ét felt, ikke seks bokse');
  assert.ok(tekstAf(f).includes(t('da', 'kode.hjaelp')), 'hjælpen står der fra start');
  assert.ok(f.includes('data-handling="ny-kode" disabled'), 'ny kode låst i 30 sek.');
  assert.ok(tekstAf(f).includes('Du kan bede om en ny kode om 30 sek.'));
});

test('fejl ved log ind → Fables tekster (c1-tabellen)', () => {
  const b = (f, x) => tekstAf(beskedHtml('da', fejlBesked(f, x)));
  assert.equal(b('email'), t('da', 'login.fejlEmail'));
  assert.equal(b('loft'), t('da', 'login.fejlLoft'));
  assert.equal(b('doegn'), t('da', 'login.fejlDoegn'));
  assert.equal(b('robot'), t('da', 'login.fejlRobot'));
  assert.equal(b('mail'), t('da', 'login.fejl'));
  assert.equal(b('netvaerk'), t('da', 'login.fejl'));
  assert.equal(b('laast'), t('da', 'kode.spaerret'));
  assert.equal(b('udloebet'), t('da', 'kode.udloebet'));
  assert.equal(b('kort'), t('da', 'kode.kort'));
  assert.equal(b('forkert', { tilbage: 4 }), t('da', 'kode.forkert'), 'første og andet forkerte forsøg: intet tal');
  assert.equal(b('forkert', { tilbage: 2 }), `${t('da', 'kode.forkert')} ${t('da', 'kode.forsoegTilbage', { n: 2 })}`, 'fra tredje forsøg');
});
