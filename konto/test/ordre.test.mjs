// Ordresiden: hver af de 16 tilstande × tre udgaver (Fable runde 3 afsnit e, tabellen "Rækkefølgen på siden").
// Renderen køres i Node mod fixtures; der tjekkes H1 (ordret), undersætningen og hvert felt, der skal vises eller skjules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOrdre, renderOrdreFejl, beskrivelsePar, udgaveAf } from '../src/lib/ordre-visning.mjs';
import { t } from '../src/lib/tekst.mjs';
import { TILSTANDE, UNDER, ordreI, LAEK, REF } from './fixtures.mjs';

const DESIGNER = 'https://designer.neminventar.dk/designer.html';
const UDGAVER = [
  { udgave: 'u1', udgivelse: 1, visning: 'uden_login' },
  { udgave: 'u2-uden', udgivelse: 2, visning: 'uden_login' },
  { udgave: 'u2-med', udgivelse: 2, visning: 'med_login' },
];

// HTML → synlig tekst (til at sammenligne med Fables ordlyd)
const tekstAf = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const h1Af = (html) => tekstAf(/<h1[^>]*>(.*?)<\/h1>/s.exec(html)?.[1] ?? '');
const underAf = (html) => tekstAf(/<p class="sub">(.*?)<\/p>/s.exec(html)?.[1] ?? '');
const har = (html, felt) => html.includes(`data-felt="${felt}"`);

test('udgaven følger udgivelsen og svaret', () => {
  assert.equal(udgaveAf(1, 'med_login'), 'u1');
  assert.equal(udgaveAf(2, 'uden_login'), 'u2-uden');
  assert.equal(udgaveAf(2, 'med_login'), 'u2-med');
});

for (const s of TILSTANDE) {
  for (const u of UDGAVER) {
    test(`tilstand ${s.nr} (${s.navn}) · ${u.udgave}`, () => {
      // Udgivelse 1 får også de fulde felter: siden må alligevel kun vise postnummer og by
      const ordre = ordreI(s.nr, u.udgave === 'u1' ? 'med_login' : u.visning);
      const r = renderOrdre({ ordre, visning: u.visning, udgivelse: u.udgivelse, nu: s.nu, designerUrl: DESIGNER });
      const h = r.html;
      const tekst = tekstAf(h);

      assert.equal(r.nr, s.grundNr ?? s.nr, 'tilstanden');
      assert.equal(h1Af(h), s.h1, 'H1 ordret (Fable e)');
      if (UNDER[s.nr]) assert.equal(underAf(h), UNDER[s.nr], 'undersætningen');
      if (s.nr === 8) assert.equal(underAf(h), UNDER[6], 'tilstand 8: som nr. 6');
      if (s.nr === 16) {
        assert.equal(underAf(h), UNDER[3], 'tilstand 16: overskrift og undersætning uændret');
        assert.ok(tekst.includes('Tilbageført 10. november 2026: 1.750,00 kr.'), 'Betaling: tilbageført');
      }
      assert.ok(tekst.includes(t('da', 'ordre.label', { ref: REF })), 'label');

      // Række 2: "← Min side" kun med login
      assert.equal(har(h, 'tilbage'), u.udgave === 'u2-med', '← Min side');
      // Række 4–7: forløb, varer, total, moms, udskriv — altid
      assert.equal((h.match(/<li class="(sket|ikke)">/g) ?? []).length, 4, 'forløbet har fire rækker');
      for (const k of ['forloeb.h2', 'varer.h2', 'varer.ialt', 'varer.moms', 'varer.udskriv', 'bet.h2', 'vilkaar.h2', 'hjaelp.h2', 'vilkaar.link']) {
        assert.ok(tekst.includes(t('da', k)), `altid: ${k}`);
      }
      assert.ok(tekst.includes('16.012,50 kr.') || s.form === 'afhentning', 'total');
      assert.ok(tekst.includes(t('da', 'varer.detaljer')), 'Mål og indretning');
      assert.ok(tekst.includes('Bøjlestang og hylde'), 'beskrivelsen');
      // Række 8: "Se designet i 3D" kun med login
      assert.equal(har(h, '3d'), u.udgave === 'u2-med', 'Se designet i 3D');
      assert.equal(tekst.includes(t('da', 'varer.design')), u.udgave === 'u2-med');
      // Række 9: Leveres til — postnummer og by; navn og gade kun med login (aldrig ved afhentning)
      assert.equal(har(h, 'leveres-til'), s.form === 'levering', 'Leveres til');
      if (s.form === 'levering') assert.ok(tekst.includes('2500 Valby'));
      assert.equal(tekst.includes('Mette Holm'), u.udgave === 'u2-med' && s.form === 'levering', 'navn');
      assert.equal(tekst.includes('Rosenvej 14'), u.udgave === 'u2-med' && s.form === 'levering', 'gade');
      // Række 10: Sådan kommer det — altid
      assert.ok(tekst.includes(t('da', 'lev.form')));
      // Række 11: Din besked til os — kun med login
      assert.equal(har(h, 'besked'), u.udgave === 'u2-med', 'Din besked til os');
      assert.equal(tekst.includes('Vi bor på 2. sal'), u.udgave === 'u2-med');
      // Række 12: Aftalt med dig — når der er aftalt noget
      const aftalt = s.nr >= 3 && s.nr !== 14 ? true : false;
      assert.equal(har(h, 'aftalt'), aftalt, 'Aftalt med dig');
      // Række 13: linjen om det, der ikke vises
      assert.equal(tekst.includes(t('da', 'lev.skjult1')), u.udgave === 'u1' && s.form === 'levering', 'lev.skjult1');
      assert.equal(tekst.includes(t('da', 'lev.skjult')), u.udgave === 'u2-uden', 'lev.skjult');
      // Række 15: tilbud om at logge ind — kun udgivelse 2 uden login
      assert.equal(har(h, 'konto-tilbud'), u.udgave === 'u2-uden', 'konto.tilbud');
      // Række 16: "Er det ikke din bestilling?" — kun med login
      assert.equal(har(h, 'ikke-min'), u.udgave === 'u2-med', 'ikkeMin');
      // Udgivelse 1: intet peger på Min side eller log ind (Fable a)
      if (u.udgave === 'u1') {
        assert.ok(!/Min side|Log ind|log ind/.test(tekst), 'udgivelse 1 nævner hverken Min side eller log ind');
        assert.ok(!h.includes('href="/?') && !h.includes('href="/min-side'), 'udgivelse 1 linker ikke til log ind');
      }
      // Aldrig: kundens telefon og e-mail, hvem hos os der har sat et trin, Stripe-id'er, interne noter
      for (const x of LAEK) assert.ok(!h.includes(x), `aldrig på siden: ${x}`);
      assert.ok(!/TODO-TEKST/.test(h), 'ingen manglende tekst i tilstanden');
      assert.ok(!/style=/.test(h), 'ingen style= (CSP)');
    });
  }
}

test('mens du venter og lev.aendre: kun mens der er noget at vente på', () => {
  for (const s of TILSTANDE) {
    const h = renderOrdre({ ordre: ordreI(s.nr), visning: 'uden_login', udgivelse: 1, nu: s.nu, designerUrl: DESIGNER }).html;
    const faerdig = [10, 12, 13, 14, 15].includes(s.nr);
    assert.equal(h.includes(t('da', 'forloeb.mens')), !faerdig, `mens du venter, tilstand ${s.nr}`);
    assert.equal(tekstAf(h).includes(t('da', 'lev.aendre')), !faerdig, `lev.aendre, tilstand ${s.nr}`);
  }
});

test('hjaelp.tekst med ordrenummeret, telefon og mail som links', () => {
  const h = renderOrdre({ ordre: ordreI(3), visning: 'uden_login', udgivelse: 1, nu: TILSTANDE[2].nu, designerUrl: DESIGNER }).html;
  assert.ok(tekstAf(h).includes(t('da', 'hjaelp.tekst', { ref: REF })));
  assert.ok(h.includes('href="tel:+4542422684"'));
  assert.ok(h.includes(`href="mailto:tilbud@neminventar.dk?subject=${REF}"`));
});

test('ingen betalingsmiddel → kun datoen (Fable d4 bet.betalt, 19)', () => {
  const o = ordreI(3);
  o.betaling.betalingsmiddel = null;
  const h = tekstAf(renderOrdre({ ordre: o, visning: 'uden_login', udgivelse: 1, nu: TILSTANDE[2].nu, designerUrl: DESIGNER }).html);
  assert.ok(h.includes('Betalt 7. november 2026'));
  assert.ok(!h.includes('Betalt 7. november 2026 med'));
});

test('fritekst escapes (Aftalt med dig, besked)', () => {
  const o = ordreI(3);
  o.forloeb.push({ trin: 'aftalt_med_dig', data: { tekst: '<img src=x onerror=alert(1)>' }, tid: '2026-11-10T08:00:00.000Z' });
  o.besked = '<script>alert(1)</script>';
  const h = renderOrdre({ ordre: o, visning: 'med_login', udgivelse: 2, nu: TILSTANDE[2].nu, designerUrl: DESIGNER }).html;
  assert.ok(!h.includes('<img src=x'));
  assert.ok(!h.includes('<script>'));
  assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('ikke betalt → ordre.ikkeBetalt (Fable d4)', () => {
  const o = { ...ordreI(3), status: 'oprettet' };
  const h = tekstAf(renderOrdre({ ordre: o, visning: 'uden_login', udgivelse: 1, nu: TILSTANDE[2].nu, designerUrl: DESIGNER }).html);
  assert.ok(h.includes(t('da', 'ordre.ikkeBetalt.h1')));
  assert.ok(h.includes(t('da', 'ordre.ikkeBetalt.tekst')));
  assert.ok(h.includes(t('da', 'ordre.ikkeBetalt.knap')));
});

test('fejlene har Fables tekster i begge udgivelser', () => {
  const tekst = (f, u) => { const h = renderOrdreFejl(f, u).html; return [h1Af(h), underAf(h)].filter(Boolean).join(' '); };
  assert.equal(tekst('ukendt', 1), t('da', 'ordre.ikkeFundet1'));
  assert.equal(tekst('ukendt', 2), t('da', 'ordre.ikkeFundet'));
  assert.equal(tekst('erstattet', 1), t('da', 'ordre.erstattet1'));
  assert.equal(tekst('erstattet', 2), t('da', 'ordre.erstattet'));
  assert.equal(tekst('nede', 1), t('da', 'ordre.nede'));
  assert.equal(tekst('lukket', 1), t('da', 'lukket'));
  assert.ok(renderOrdreFejl('ukendt', 2).html.includes('href="/"'), 'udgivelse 2: "log ind på Min side" er et link');
  assert.ok(!renderOrdreFejl('ukendt', 1).html.includes('href="/"'), 'udgivelse 1: intet link til log ind');
});

test('beskrivelsen: designerens spec-par og de tålte former', () => {
  assert.deepEqual(beskrivelsePar([['Bredde', '60 cm']]), [['Bredde', '60 cm']]);
  assert.deepEqual(beskrivelsePar({ spec: [{ k: 'Dybde', v: '40 cm' }] }), [['Dybde', '40 cm']]);
  assert.deepEqual(beskrivelsePar({ maal: 'intern' }), [], 'løse nøgler vises ikke');
  assert.deepEqual(beskrivelsePar(null), []);
});
