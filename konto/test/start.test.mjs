// R10 (plan-teknik-v3 §4): nøglen i fragmentet fjernes med history.replaceState, før Plausible kaldes, og Plausible får
// kun origin + pathname. Ordresidens gang køres med falske afhængigheder, der skriver hændelserne i rækkefølge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { koerOrdre, laesAdresse } from '../src/lib/ordre-start.mjs';
import { sidevisningData, sidevisning, PLAUSIBLE_EVENT } from '../src/lib/adresser.mjs';
import { ordreI, TILSTANDE, REF } from './fixtures.mjs';

const NOEGLE = 'k7Qm2xVt9dRw4LpZ8nYc_A';

function verden({ hash = '', search = '', udgivelse = 1, svar = null, gemt = null } = {}) {
  const log = [];
  const loc = { origin: 'https://konto.neminventar.dk', pathname: '/ordre/', hash, search };
  let husket = gemt;
  const m = {
    hash, search, pathname: '/ordre/', udgivelse, designerUrl: 'https://designer.neminventar.dk/designer.html',
    nu: () => Date.parse(TILSTANDE[2].nu),
    rydAdresse: (url) => {
      log.push(['ryd', url]);
      const u = new URL(url, loc.origin);
      loc.pathname = u.pathname; loc.hash = u.hash; loc.search = u.search;
    },
    husk: { hent: () => husket, gem: (n) => { husket = n; log.push(['husk', '***']); }, glem: () => { husket = null; log.push(['glem']); } },
    sporing: () => sidevisning(loc, (url, init) => { log.push(['plausible', url, init.body, `${loc.pathname}${loc.search}${loc.hash}`]); return Promise.resolve(); }),
    api: async (sti, body) => { log.push(['api', sti, JSON.stringify(body)]); return svar ?? { status: 200, data: { visning: 'uden_login', ordre: ordreI(3, 'uden_login') } }; },
    vis: (r) => log.push(['vis', r.titel, r.fejl ?? r.nr]),
    tilLogin: (url) => log.push(['login', url]),
    harHaftSession: () => false,
  };
  return { m, log, loc, husk: () => husket };
}

test('fragmentet: #NI-… er et ordrenummer, alt andet en nøgle; ?ref= er retur efter log ind', () => {
  assert.deepEqual(laesAdresse(`#${NOEGLE}`, ''), { ref: null, noegle: NOEGLE });
  assert.deepEqual(laesAdresse('#ni-1d078a14', ''), { ref: REF, noegle: null });
  assert.deepEqual(laesAdresse('#NI-xyz', ''), { ref: null, noegle: null }, 'et forkert ordrenummer er hverken ref eller nøgle');
  assert.deepEqual(laesAdresse('', `?ref=${REF}`), { ref: REF, noegle: null, fraQuery: true });
  assert.equal(laesAdresse('', '?ref=evil').ref, null);
});

test('R10: nøglen fjernes fra adressen FØR Plausible, og Plausible får kun origin + pathname', async () => {
  const { m, log, loc } = verden({ hash: `#${NOEGLE}` });
  await koerOrdre(m);
  const i = (navn) => log.findIndex((x) => x[0] === navn);
  assert.ok(i('ryd') >= 0 && i('ryd') < i('plausible'), 'replaceState før Plausible');
  assert.ok(i('plausible') < i('api'), 'Plausible før API-kaldet (nøglen er allerede væk)');
  assert.deepEqual(log[i('ryd')], ['ryd', '/ordre/'], 'adressen uden fragment');
  assert.equal(loc.hash, '');
  const [, url, body, adresse] = log[i('plausible')];
  assert.equal(url, PLAUSIBLE_EVENT);
  assert.equal(adresse, '/ordre/', 'adresselinjen havde ingen nøgle, da Plausible blev kaldt');
  assert.ok(!body.includes(NOEGLE), 'Plausible får ikke nøglen');
  assert.deepEqual(JSON.parse(body), { name: 'pageview', url: 'https://konto.neminventar.dk/ordre/', domain: 'neminventar.dk', referrer: null });
  const api = log.find((x) => x[0] === 'api');
  assert.deepEqual(api, ['api', '/ordre', JSON.stringify({ noegle: NOEGLE })], 'nøglen går i en POST-body');
  assert.deepEqual(log.at(-1), ['vis', 'Bestilling NI-1D078A14 · Nem Inventar', 3]);
});

test('sidevisningData skærer query og fragment fra', () => {
  const d = sidevisningData({ origin: 'https://konto.neminventar.dk', pathname: '/ordre/', search: '?retur=x', hash: '#hemmelig' });
  assert.equal(d.url, 'https://konto.neminventar.dk/ordre/');
  assert.equal(d.referrer, null);
});

test('genindlæsning: nøglen huskes i fanen, ikke i adressen', async () => {
  const a = verden({ hash: `#${NOEGLE}` });
  await koerOrdre(a.m);
  assert.equal(a.husk(), NOEGLE);
  const b = verden({ gemt: a.husk() });
  await koerOrdre(b.m);
  assert.deepEqual(b.log.find((x) => x[0] === 'api'), ['api', '/ordre', JSON.stringify({ noegle: NOEGLE })]);
  assert.ok(!b.log.some((x) => x[0] === 'ryd'), 'intet at rydde');
});

test('erstattet og ukendt: nøglen glemmes, Fables tekst vises', async () => {
  for (const fejl of ['erstattet', 'ukendt']) {
    const { m, log, husk } = verden({ hash: `#${NOEGLE}`, svar: { status: fejl === 'erstattet' ? 410 : 404, data: { fejl } } });
    await koerOrdre(m);
    assert.equal(husk(), null);
    assert.deepEqual(log.at(-1), ['vis', 'Nem Inventar', fejl]);
  }
});

test('ingen nøgle → ikke fundet, intet API-kald', async () => {
  const { m, log } = verden();
  await koerOrdre(m);
  assert.ok(!log.some((x) => x[0] === 'api'));
  assert.deepEqual(log.at(-1), ['vis', 'Nem Inventar', 'ukendt']);
});

test('#NI-… i udgivelse 1 kræver login, som ikke findes → ikke fundet', async () => {
  const { m, log } = verden({ hash: `#${REF}`, udgivelse: 1 });
  await koerOrdre(m);
  assert.ok(!log.some((x) => x[0] === 'api'));
  assert.deepEqual(log.at(-1), ['vis', 'Nem Inventar', 'ukendt']);
});

test('#NI-… i udgivelse 2 uden session → log ind med retur til ordren (R21: retur i query, ikke fragment)', async () => {
  const { m, log } = verden({ hash: `#${REF}`, udgivelse: 2, svar: { status: 401, data: { fejl: 'login' } } });
  await koerOrdre(m);
  assert.deepEqual(log.find((x) => x[0] === 'api'), ['api', '/ordre-ref', JSON.stringify({ ref: REF })]);
  assert.deepEqual(log.at(-1), ['login', `/?retur=${encodeURIComponent(`/ordre/?ref=${REF}`)}`]);
});

test('?ref= efter log ind skrives om til #NI-…', async () => {
  const { m, log } = verden({ search: `?ref=${REF}`, udgivelse: 2, svar: { status: 200, data: { visning: 'med_login', ordre: ordreI(3) } } });
  await koerOrdre(m);
  assert.deepEqual(log[0], ['ryd', `/ordre/#${REF}`]);
  assert.deepEqual(log.at(-1), ['vis', 'Bestilling NI-1D078A14 · Nem Inventar', 3]);
});

test('broen nede og flaget fra → nede/lukket', async () => {
  for (const fejl of ['nede', 'lukket']) {
    const { m, log } = verden({ hash: `#${NOEGLE}`, svar: { status: 503, data: { fejl } } });
    await koerOrdre(m);
    assert.deepEqual(log.at(-1), ['vis', 'Nem Inventar', fejl]);
  }
});
