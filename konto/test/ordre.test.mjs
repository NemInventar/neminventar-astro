// Ordresiden: hver af de 16 tilstande × tre udgaver (Fable runde 3 afsnit e, tabellen "Rækkefølgen på siden").
// Renderen køres i Node mod fixtures; der tjekkes H1 (ordret), undersætningen og hvert felt, der skal vises eller skjules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOrdre, renderOrdreFejl, beskrivelsePar, udgaveAf } from '../src/lib/ordre-visning.mjs';
import { t } from '../src/lib/tekst.mjs';
import { TILSTANDE, UNDER, ordreI, LAEK, REF, UGE_VARIANTER, MAAL_VARIANTER } from './fixtures.mjs';

const DESIGNER = 'https://designer.neminventar.dk/designer.html';
const UDGAVER = [
  { udgave: 'u1', udgivelse: 1, visning: 'uden_login' },
  { udgave: 'u2-uden', udgivelse: 2, visning: 'uden_login' },
  { udgave: 'u2-med', udgivelse: 2, visning: 'med_login' },
];

// HTML → synlig tekst (til at sammenligne med Fables ordlyd)
const tekstAf = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
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
      // annulleret og fortrudt: kun de skete trin og en række med flueben til sidst (Fable port 3, nr. 4)
      const slut = s.nr === 14 || s.nr === 15;
      assert.equal((h.match(/<li class="(sket|ikke)"/g) ?? []).length, s.nr === 14 ? 2 : s.nr === 15 ? 5 : 4, 'forløbets rækker');   // 14: betalt + annulleret · 15: betalt, uge, dag, leveret + fortrudt
      if (slut) assert.ok(!h.includes('<li class="ikke"'), 'ingen tomme ringe efter annulleret/fortrudt');
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
      // tilstand 14: hele afsnittet "Levering" er skjult (Fable port 3, nr. 4)
      assert.equal(h.includes(`>${t('da', 'lev.h2')}</h2>`), s.nr !== 14, 'afsnittet Levering');
      assert.equal(har(h, 'leveres-til'), s.form === 'levering' && s.nr !== 14, 'Leveres til');
      if (s.form === 'levering' && s.nr !== 14) assert.ok(tekst.includes('2500 Valby'));
      assert.equal(tekst.includes('Mette Holm'), u.udgave === 'u2-med' && s.form === 'levering' && s.nr !== 14, 'navn');
      assert.equal(tekst.includes('Rosenvej 14'), u.udgave === 'u2-med' && s.form === 'levering' && s.nr !== 14, 'gade');
      // Række 10: Sådan kommer det — altid (undtagen annulleret)
      assert.equal(tekst.includes(t('da', 'lev.form')), s.nr !== 14);
      // Række 11: Din besked til os — kun med login (og ikke ved annulleret)
      assert.equal(har(h, 'besked'), u.udgave === 'u2-med' && s.nr !== 14, 'Din besked til os');
      assert.equal(tekst.includes('Vi bor på 2. sal'), u.udgave === 'u2-med' && s.nr !== 14);
      // Række 12: Aftalt med dig — når der er aftalt noget
      const aftalt = s.nr >= 3 && s.nr !== 14 ? true : false;
      assert.equal(har(h, 'aftalt'), aftalt, 'Aftalt med dig');
      // Række 13: linjen om det, der ikke vises
      assert.equal(tekst.includes(t('da', 'lev.skjult1')), u.udgave === 'u1' && s.form === 'levering' && s.nr !== 14, 'lev.skjult1');
      assert.equal(tekst.includes(t('da', 'lev.skjult')), u.udgave === 'u2-uden' && s.form === 'levering' && s.nr !== 14, 'lev.skjult');
      assert.equal(tekst.includes(t('da', 'lev.skjultAfhentning')), u.udgave === 'u2-uden' && s.form === 'afhentning', 'lev.skjultAfhentning (runde 4, 11)');
      // Vilkår: annulleret eller fortrudt → kun linket (Fable port 3, nr. 3)
      assert.equal(/fortrydelsesret|reklamationsret|fortryde til og med/i.test(tekst.slice(tekst.indexOf(t('da', 'vilkaar.h2')))), !slut, 'vilkår');
      // Leveringslinjen: siden skriver selv "Levering: …" uden antal (Fable port 3, nr. 5)
      assert.ok(!tekst.includes('Levering, båret ind · 4 skabe'), 'ordrens egen leveringslinje står ikke');
      // Runde 2, R7: rækkens første celle spænder over Vare og Antal (ingen tom Antal-celle, der presser teksten på telefon)
      if (s.form === 'levering') assert.match(h, /<tr data-felt="levering-linje"><td colspan="2">Levering: samlet, båret ind<\/td><td class="n">1\.750,00&nbsp;kr\.<\/td><\/tr>/);
      else assert.match(h, /<tr data-felt="levering-linje"><td colspan="2">Levering: flatpack, afhentning på Mågevej<\/td><td class="n">0,00&nbsp;kr\.<\/td><\/tr>/);
      // Udskriften: ordmærket øverst, kun i print (Fable port 3, nr. 25)
      assert.ok(h.includes('<p class="kun-print ordmaerke">NEM<b>·</b>INVENTAR</p>'));
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

// ---------- Fable port 3 ----------
test('port 3 nr. 1: uge og datoer bindes med hårde mellemrum — parentesen kan brydes efter stregen', () => {
  const html = (id) => renderOrdre({ ordre: ordreI(id), visning: 'uden_login', udgivelse: 1, nu: '2026-11-12T10:00:00.000Z', designerUrl: DESIGNER }).html;
  const h1 = (id) => /<h1[^>]*>(.*?)<\/h1>/s.exec(html(id))[1];
  assert.equal(h1('03w49'), 'Vi leverer i uge&nbsp;49 (30.&nbsp;november–4.&nbsp;december&nbsp;2026)');
  assert.equal(h1('03w53'), 'Vi leverer i uge&nbsp;53 (28.&nbsp;december&nbsp;2026–1.&nbsp;januar&nbsp;2027)');
  assert.equal(h1('11w53'), 'Klar til afhentning i uge&nbsp;53 (28.&nbsp;december&nbsp;2026–1.&nbsp;januar&nbsp;2027)');
  for (const v of UGE_VARIANTER) assert.equal(h1Af(html(v.id)), v.h1, v.id);
  assert.ok(!/class="nob">\(/.test(html('03w53')), 'parentesen er ikke længere nowrap');
});

// Runde 2, R6: forløbets underlinje binder ugen som H1'en; ligger ugen i én måned, brydes parentesen slet ikke
test('runde 2, R6: forløbets underlinje — "uge 49" og datoerne bundet; én måned står i nowrap', () => {
  const html = (id, nu = '2026-11-12T10:00:00.000Z') => renderOrdre({ ordre: ordreI(id), visning: 'uden_login', udgivelse: 1, nu, designerUrl: DESIGNER }).html;
  const uge = (h) => /<li class="sket" data-trin="uge">.*?<small>(.*?)<\/small>/s.exec(h)[1];
  assert.equal(uge(html('03w49')), 'Uge&nbsp;49 (30.&nbsp;november–4.&nbsp;december&nbsp;2026)', 'to måneder: kun brud efter stregen');
  assert.equal(uge(html(3, TILSTANDE[2].nu)), 'Uge&nbsp;51 <span class="nw">(14.–18.&nbsp;december&nbsp;2026)</span>', 'én måned: hele parentesen');
  assert.match(html(3, TILSTANDE[2].nu), /<span class="fl-tekst">9\.&nbsp;november&nbsp;2026<small>/, 'datoen holdes samlet');
  // H1'en er uændret (parentesen kan brydes efter stregen, aldrig nowrap — port 3, nr. 1)
  assert.equal(/<h1[^>]*>(.*?)<\/h1>/s.exec(html(3, TILSTANDE[2].nu))[1], 'Vi leverer i uge&nbsp;51 (14.–18.&nbsp;december&nbsp;2026)');
});

// Runde 2, R1: designeren skriver antallet i linjens tekst ("2 × Lockers 4 × 2, 8 rum"), og broen sender antal 1. Siden viser
// "Lockers 4 × 2, 8 rum" · 2 · linjens beløb — testet med 1, 2 og 3 stk. Rækken "Vare" i "Mål og indretning" er uændret.
test('runde 2, R1: to (og tre) af samme vare — antallet i Antal, ikke i navnet; én er som før', () => {
  const vare = (tekst, beloeb_oere, beskrivelse = null) => {
    const o = { ...ordreI(3), linjer: [{ tekst, antal: 1, beloeb_oere }, { tekst: 'Levering til kantsten · 2 elementer', antal: 1, beloeb_oere: 68750 }], levering: { form: 'kantsten', tekst: 'Samlet, til kantsten' }, beskrivelse };
    const h = renderOrdre({ ordre: o, visning: 'uden_login', udgivelse: 1, nu: TILSTANDE[2].nu, designerUrl: DESIGNER }).html;
    return /<tbody><tr><td>(.*?)<\/td><td class="n">(.*?)<\/td><td class="n">(.*?)<\/td><\/tr>/s.exec(h).slice(1).map((x) => x.replace(/&nbsp;/g, ' '));
  };
  assert.deepEqual(vare('Lockers 4 × 2, 8 rum', 2520000), ['Lockers 4 × 2, 8 rum', '1', '25.200,00 kr.']);
  assert.deepEqual(vare('2 × Lockers 4 × 2, 8 rum', 5040000), ['Lockers 4 × 2, 8 rum', '2', '50.400,00 kr.']);
  assert.deepEqual(vare('3 × Lockers 4 × 2, 8 rum', 7560000), ['Lockers 4 × 2, 8 rum', '3', '75.600,00 kr.']);
  // "Mål og indretning" står som designeren frøs den — rækken "Vare" med "2 × …" er uændret
  const o = { ...ordreI(3), linjer: [{ tekst: '2 × Lockers 4 × 2, 8 rum', antal: 1, beloeb_oere: 5040000 }], beskrivelse: [['Vare', '2 × Lockers 4 × 2'], ['Rum', '8']] };
  assert.match(renderOrdre({ ordre: o, visning: 'uden_login', udgivelse: 1, nu: TILSTANDE[2].nu, designerUrl: DESIGNER }).html, /<dt>Vare<\/dt><dd>2 × Lockers 4 × 2<\/dd>/);
});

test('port 3 nr. 2: flyttet uge og dag — rækken har datoen for ændringen og siger "ændret fra"', () => {
  const r = (nr) => tekstAf(renderOrdre({ ordre: ordreI(nr), visning: 'uden_login', udgivelse: 1, nu: TILSTANDE[nr - 1].nu, designerUrl: DESIGNER }).html);
  assert.ok(r(4).includes('Leveringsuge bekræftet2. december 2026Uge 2 (11.–15. januar 2027), ændret fra uge 51'));
  assert.ok(r(7).includes('Leveringsdag aftalt10. december 2026Torsdag 17. december, ændret fra tirsdag 15. december'));
});

test('port 3 nr. 4: annulleret slutter med "Annulleret" og beløbet; uden tilbageførsel uden dato og beløb', () => {
  const h = (o, nu) => renderOrdre({ ordre: o, visning: 'uden_login', udgivelse: 1, nu, designerUrl: DESIGNER }).html;
  const med = tekstAf(h(ordreI(14), TILSTANDE[13].nu));
  assert.ok(med.includes('Annulleret10. november 202616.012,50 kr. tilbageført'));
  const uden = h(ordreI('14u'), TILSTANDE[13].nu);
  assert.match(uden, /<li class="sket" data-trin="annulleret">.*?<span class="fl-navn">Annulleret<\/span><span class="fl-tekst"><\/span><\/li><\/ol>/s);
  const fortrudt = tekstAf(h(ordreI(15), TILSTANDE[14].nu));
  assert.ok(fortrudt.includes('Fortrudt22. december 202614.262,50 kr. tilbageført'));
});

test('port 3 nr. 6: ingen tomme felter i forløbet', () => {
  const tx = (nr, nu = TILSTANDE[nr - 1].nu) => tekstAf(renderOrdre({ ordre: ordreI(nr), visning: 'uden_login', udgivelse: 1, nu, designerUrl: DESIGNER }).html);
  assert.ok(tx(2).includes('Leveringsuge bekræftetIkke bekræftet endnu.'));
  assert.ok(tx(11).includes('HentetPå Mågevej 73, st. tv., 2400 København NV, efter aftale.'));
  assert.ok(tx(12).includes('HentetRing på +45 42 42 26 84 og aftal et tidspunkt.'));
  assert.ok(tekstAf(renderOrdre({ ordre: ordreI('05a'), visning: 'uden_login', udgivelse: 1, nu: '2026-12-21T09:00:00.000Z', designerUrl: DESIGNER }).html)
    .includes('HentetPå Mågevej 73, st. tv., 2400 København NV, efter aftale.'));
});

test('port 3 nr. 11: "Mål og indretning" for tre forskellige ordrer — designerens beskrivelse, åben i udskriften', () => {
  for (const v of MAAL_VARIANTER) {
    const o = ordreI(v.id);
    const h = renderOrdre({ ordre: o, visning: 'uden_login', udgivelse: 1, nu: v.nu, designerUrl: DESIGNER }).html;
    assert.match(h, /<details class="mere" data-print-aaben data-felt="maal">/, v.id);
    for (const [k, x] of o.beskrivelse) assert.ok(tekstAf(h).includes(`${k}${x}`), `${v.id}: ${k}`);
    assert.match(tekstAf(h), /Levering: (samlet|flatpack), til kantsten/);
  }
});

test('port 3 nr. 21: den sidste række i Levering har ingen bundstreg, når intet følger', () => {
  const h = (nr, u) => renderOrdre({ ordre: ordreI(nr), visning: u === 'u1' ? 'uden_login' : 'med_login', udgivelse: u === 'u1' ? 1 : 2, nu: TILSTANDE[nr - 1].nu, designerUrl: DESIGNER }).html;
  assert.ok(h(12, 'u2-med').includes('<dl class="kv sidst">'), 'afhentning, klar, med login: intet følger');
  assert.ok(h(3, 'u1').includes('<dl class="kv">'), 'lev.skjult1 og lev.aendre følger');
});

test('port 3 nr. 22: "Betalt …" med punktum', () => {
  const tx = tekstAf(renderOrdre({ ordre: ordreI(3), visning: 'uden_login', udgivelse: 1, nu: TILSTANDE[2].nu, designerUrl: DESIGNER }).html);
  assert.ok(tx.includes('Betalt 7. november 2026 med kort.'));
});

test('port 3 nr. 9, 24 og 30: overskrift uden punktum, "Prøv igen" ved nede, "log ind" brydes ikke', () => {
  const nede = renderOrdreFejl('nede', 1).html;
  assert.equal(h1Af(nede), 'Vi kan ikke vise bestillingen lige nu');
  assert.match(nede, /<p class="igen-link"><a class="lnk" href="" data-handling="igen">Prøv igen<\/a><\/p>/);
  for (const f of ['ukendt', 'erstattet', 'lukket']) assert.ok(!renderOrdreFejl(f, 2).html.includes('data-handling="igen"'), f);
  assert.ok(renderOrdreFejl('erstattet', 2).html.includes('>log&nbsp;ind</a>'));
  assert.ok(renderOrdreFejl('ukendt', 2).html.includes('>log&nbsp;ind&nbsp;på&nbsp;Min&nbsp;side</a>'));
});

test('mens du venter og lev.aendre: kun mens der er noget at vente på — ikke på leveringsdagen og efter (G)', () => {
  for (const s of TILSTANDE) {
    const h = renderOrdre({ ordre: ordreI(s.nr), visning: 'uden_login', udgivelse: 1, nu: s.nu, designerUrl: DESIGNER }).html;
    const ingen = [8, 9, 10, 12, 13, 14, 15].includes(s.nr);
    assert.equal(h.includes(t('da', 'forloeb.mens')), !ingen, `mens du venter, tilstand ${s.nr}`);
    assert.equal(tekstAf(h).includes(t('da', 'lev.aendre')), !ingen, `lev.aendre, tilstand ${s.nr}`);
    // Afhentning har sin egen tekst (Fable runde 4, afsnit 11)
    if (!ingen) {
      assert.equal(tekstAf(h).includes(t('da', 'forloeb.mensTekstAfhentning')), s.form === 'afhentning', `mensTekstAfhentning, tilstand ${s.nr}`);
      assert.equal(tekstAf(h).includes(t('da', 'forloeb.mensTekst')), s.form === 'levering', `mensTekst, tilstand ${s.nr}`);
    }
  }
});

test('afhentningsugen gået uden "klar" (Fable runde 4, afsnit 6): H1 og undersætning fra kernen', () => {
  const h = renderOrdre({ ordre: ordreI(11), visning: 'uden_login', udgivelse: 1, nu: '2026-12-21T09:00:00.000Z', designerUrl: DESIGNER }).html;
  assert.equal(h1Af(h), 'Din bestilling er ikke klar til afhentning endnu');
  assert.equal(underAf(h), 'Den skulle have stået klar i uge 51. Ring på +45 42 42 26 84, eller svar på ordrebekræftelsen.');
  assert.ok(tekstAf(h).includes(t('da', 'forloeb.mensTekstAfhentning')));
});

test('annulleret uden registreret tilbageførsel (Fable runde 4, afsnit 7)', () => {
  const o = { ...ordreI(3), status: 'annulleret' };
  const h = renderOrdre({ ordre: o, visning: 'uden_login', udgivelse: 1, nu: TILSTANDE[2].nu, designerUrl: DESIGNER }).html;
  assert.equal(h1Af(h), 'Bestillingen er annulleret');
  assert.equal(underAf(h), 'Beløbet og datoen står her, når vi har tilbageført pengene. Er der noget, så ring på +45 42 42 26 84.');
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
  // overskriften står uden sit punktum (port 3, nr. 9): det sættes på igen for at sammenligne med Fables hele tekst
  const tekst = (f, u) => { const h = renderOrdreFejl(f, u).html; return [`${h1Af(h)}.`, underAf(h)].filter(Boolean).join(' '); };
  assert.equal(tekst('ukendt', 1), t('da', 'ordre.ikkeFundet1'));
  assert.equal(tekst('ukendt', 2), t('da', 'ordre.ikkeFundet'));
  assert.equal(tekst('erstattet', 1), t('da', 'ordre.erstattet1'));
  assert.equal(tekst('erstattet', 2), t('da', 'ordre.erstattet'));
  assert.equal(tekst('nede', 1), t('da', 'ordre.nede'));
  assert.equal(h1Af(renderOrdreFejl('nede', 1).html), 'Vi kan ikke vise bestillingen lige nu');   // uden punktum (port 3, nr. 9)
  // Egen nøgle på ordresiden: udgivelse 1 må ikke nævne Min side (Fable runde 4, afsnit 2)
  for (const u of [1, 2]) {
    assert.equal(tekst('lukket', u), t('da', 'ordre.lukket'));
    assert.ok(!/Min side/.test(tekst('lukket', u)));
  }
  assert.equal(h1Af(renderOrdreFejl('lukket', 1).html), 'Siden er ikke åben lige nu');
  assert.ok(renderOrdreFejl('ukendt', 2).html.includes('href="/"'), 'udgivelse 2: "log ind på Min side" er et link');
  assert.ok(!renderOrdreFejl('ukendt', 1).html.includes('href="/"'), 'udgivelse 1: intet link til log ind');
});

test('beskrivelsen: designerens spec-par og de tålte former', () => {
  assert.deepEqual(beskrivelsePar([['Bredde', '60 cm']]), [['Bredde', '60 cm']]);
  assert.deepEqual(beskrivelsePar({ spec: [{ k: 'Dybde', v: '40 cm' }] }), [['Dybde', '40 cm']]);
  assert.deepEqual(beskrivelsePar({ maal: 'intern' }), [], 'løse nøgler vises ikke');
  assert.deepEqual(beskrivelsePar(null), []);
});
