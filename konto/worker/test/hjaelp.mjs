// Testverdenen: fake ni-konto (fake-db.mjs), fake Graph, Turnstile, bro, /pris og alarm-webhook bag én fetch.
// verden.kald(metode, sti, {body, origin, cookie, …}) kører Workeren (src/app.js haandter) som Pages-funktionen ville.
import { haandter } from '../src/app.js';
import { glemTokens } from '../src/graph.js';
import { broSignatur } from '../src/bro.js';
import { lavFakeDb } from './fake-db.mjs';

export const KONTO = 'https://konto.neminventar.dk';
export const DESIGNER = 'https://designer.neminventar.dk';
export const PEBER = 'test-peber-0123456789abcdef-0123456789abcdef';
export const BRO_HEMMELIGHED = 'bro-hemmelighed-til-test-0123456789';
export const SECRETS = {
  KODE_PEBER_1: PEBER,
  BRO_HEMMELIGHED_1: BRO_HEMMELIGHED,
  TURNSTILE_SECRET: 'turnstile-hemmelighed-test',
  GRAPH_CLIENT_SECRET: 'graph-hemmelighed-test',
  NI_KONTO_SERVICE_KEY: 'sb_secret_test',
};
export const NOEGLE = 'AbCdEfGhIjKlMnOpQrStUv';          // 22 tegn
export const NOEGLE_ERSTATTET = 'ZZCdEfGhIjKlMnOpQrStUv';
export const REF = 'NI-1A2B3C4D';
export const EJER = 'mette.holm@example.com';

export function miljoe(over = {}) {
  return {
    MILJOE: 'prod',
    ORDRESTATUS_AKTIV: 'true',
    KONTO_AKTIV: 'true',
    NI_KONTO_URL: 'https://ni-konto.test',
    BRO_URL: 'https://bro.test/functions/v1/konto-bro',
    BRO_V: '1',
    KODE_PEBER_V: '1',
    MAIL_FRA: 'konto@neminventar.dk',
    MAIL_SVAR_TIL: 'tilbud@neminventar.dk',
    GRAPH_TENANT: 'tenant.test',
    GRAPH_CLIENT_ID: 'klient-id',
    TEAMS_ALARM_URL: 'https://alarm.test/hook',
    ...SECRETS,
    ...over,
  };
}

// En ordre som broen kunne sende den — med felter, der ALDRIG må nå kunden (Workerens egen hvidliste skal fjerne dem)
export function broOrdre(over = {}) {
  return {
    ref: REF,
    bestilt: '2026-11-06T09:12:00.000Z',
    status: 'betalt',
    sprog: 'da',
    produkt: 'hoejskab',
    linjer: [{ tekst: 'Højskab', antal: 1, beloeb_oere: 1601250, intern: 'x' }],
    levering: { form: 'baaret_ind', tekst: 'Samlet, båret ind', lastbil: 'intern' },
    total: { ex_oere: 1281000, moms_oere: 320250, inkl_oere: 1601250, valuta: 'DKK' },
    beskrivelse: { maal: 'Bredde 60', felter: [{ k: 'Dybde', v: '60', sat_af: 'milot@neminventar.dk' }] },
    forloeb: [
      { trin: 'uge_bekraeftet', data: { aar: 2026, uge: 51, praecis: false, aftalt: { tekst: 'Uden sokkel', kundens_ja: 'mail 9/11' } }, tid: '2026-11-09T08:00:00.000Z', sat_af: 'milot@neminventar.dk' },
      { trin: 'email_rettet', data: { gammel: 'a@b.dk', ny: 'c@d.dk', aarsag: 'tastefejl' }, tid: '2026-11-09T09:00:00.000Z' },
      { trin: 'ordreside_aabnet', data: {}, tid: '2026-11-09T10:00:00.000Z' },
    ],
    betaling: { betalt_at: '2026-11-06T09:13:00.000Z', betalingsmiddel: 'card', refunderet_oere: 0, refunderet_at: null, stripe_pi: 'pi_123' },
    fortrydelsesret: false,
    uge_frist_at: '2026-11-09T22:59:59.000Z',
    adresse: { postnr: '2500', by: 'Valby', navn: 'Mette Holm', gade: 'Rosenvej 14, 2. th.', telefon: '12345678' },
    besked: 'Ring før levering',
    permalink: 'https://designer.neminventar.dk/designer?p=hoejskab&t=eyJ9',
    telefon: '12345678',
    email: EJER,
    ansvarlig: 'kontakt@neminventar.dk',
    stripe_session: 'cs_123',
    fejl: null,
    ip_dag: 'abc',
    ...over,
  };
}

// Et design-t som designeren laver det (base64url-JSON), evt. med et billede-valg fra kundens eget foto
export const kodT = (st) => Buffer.from(JSON.stringify(st), 'utf8').toString('base64url');
export const afkodT = (t) => JSON.parse(Buffer.from(t, 'base64url').toString('utf8'));

// standardLog: true → Workerens egen log (console.log) bruges, så R17-testen kan fange den
export function lavVerden({ start = Date.parse('2026-11-12T10:00:00Z'), env = {}, standardLog = false } = {}) {
  glemTokens();
  let t = start;
  const v = {
    env: miljoe(env),
    nu: () => t,
    frem(ms) { t += ms; },
    saet(ms) { t = ms; },
    mails: [],
    graph: { nede: false, kald: 0, tokenKald: 0, sidste: null },
    turnstile: { svar: { success: true, action: 'konto-kode', hostname: 'konto.neminventar.dk' }, kald: 0, sidste: null },
    bro: { nede: false, kald: [], nonces: new Set(), ordrer: [broOrdre()], gemtUdenLogin: [], skjulte: [], ikkeMin: [], leads: [] },
    // Som designer-ordre linkPris svarer: standardformen først, leveringen som sidste linje (afhentning = 0 kr.)
    pris: { kald: [], status: 200, svar: { ok: true, produkt: 'hoejskab', titel: 'Højskab 60 × 220', varianter: [
      { form: 'flatpack', trin: 'afhent', inkl: 12200, ex: 9760, linjer: [{ t: 'Højskab', ex: 9760 }, { t: 'Afhentning på Mågevej efter aftale', ex: 0 }] },
      { form: 'flatpack', trin: 'kantsten', inkl: 12767.5, ex: 10214, linjer: [{ t: 'Højskab', ex: 9760 }, { t: 'Levering til kantsten', ex: 454 }] },
      { form: 'samlet', trin: 'kantsten', inkl: 13400, ex: 10720, linjer: [{ t: 'Højskab', ex: 10100 }, { t: 'Levering til kantsten', ex: 620 }] },
    ] } },
    alarmer: [],
    fremmede: [],
    ventende: [],
    logs: [],
  };
  v.db = lavFakeDb(v.nu);

  async function broSvar(init) {
    const h = new Headers(init.headers);
    const tid = h.get('x-bro-tid');
    const nonce = h.get('x-bro-nonce');
    const sig = h.get('x-bro-sig');
    const body = init.body;
    v.bro.kald.push(JSON.parse(body));
    if (v.bro.nede) return new Response('nede', { status: 503 });
    // Broens egne tjek (kontrakter §5): signatur, ±5 min, nonce bruges kun én gang
    const forventet = await broSignatur(BRO_HEMMELIGHED, tid, nonce, body);
    if (sig !== forventet || h.get('x-bro-v') !== '1' || Math.abs(Number(tid) - t) > 5 * 60_000 || v.bro.nonces.has(nonce)) {
      return new Response(null, { status: 401 });
    }
    v.bro.nonces.add(nonce);
    const b = JSON.parse(body);
    const json = (x) => Response.json(x);
    const mine = (email) => v.bro.ordrer.filter((o) => o.email === email);
    switch (b.handling) {
      case 'ordre_for_noegle':
        if (b.noegle === NOEGLE_ERSTATTET) return json({ fejl: 'erstattet' });
        if (b.noegle === NOEGLE && v.bro.ordrer[0]) return json({ ordre: v.bro.ordrer[0] });
        return json({ fejl: 'ukendt' });
      case 'ordre_for_ref': {
        const o = mine(b.email).find((x) => x.ref === b.ref);
        return json(o ? { ordre: o } : { fejl: 'ukendt' });
      }
      case 'ordrer_for_email':
        return json({ ordrer: mine(b.email), gemt_uden_login: v.bro.gemtUdenLogin.filter((g) => g.email === b.email) });
      case 'ikke_min':
        v.bro.ikkeMin.push({ email: b.email, ref: b.ref });
        return json({ ok: true });
      case 'skjul_design':
        v.bro.skjulte.push({ email: b.email, id: b.id });
        return json({ ok: true });
      case 'design_gemt':
        v.bro.leads.push(b);
        return json({ ok: true });
      default:
        return new Response(null, { status: 400 });
    }
  }

  v.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname === 'login.microsoftonline.com') {
      v.graph.tokenKald += 1;
      if (v.graph.nede) return new Response(JSON.stringify({ error: 'temporarily_unavailable' }), { status: 503 });
      return Response.json({ access_token: 'graph-token', expires_in: 3600 });
    }
    if (url.hostname === 'graph.microsoft.com') {
      v.graph.kald += 1;
      if (v.graph.nede) return new Response(JSON.stringify({ error: { code: 'ServiceUnavailable' } }), { status: 503 });
      const b = JSON.parse(init.body);
      v.graph.sidste = { url: url.href, body: b, headers: new Headers(init.headers) };
      v.mails.push({
        til: b.message.toRecipients[0].emailAddress.address,
        emne: b.message.subject,
        tekst: b.message.body.content,
        fra: decodeURIComponent(url.pathname.split('/')[3]),
        svarTil: b.message.replyTo?.[0]?.emailAddress?.address,
        saveToSentItems: b.saveToSentItems,
      });
      return new Response(null, { status: 202 });
    }
    if (url.hostname === 'challenges.cloudflare.com') {
      v.turnstile.kald += 1;
      v.turnstile.sidste = new URLSearchParams(init.body);
      if (v.turnstile.svar === 'nede') throw new TypeError('fetch failed');
      return Response.json(v.turnstile.svar);
    }
    if (url.hostname === 'bro.test') return broSvar(init);
    if (url.hostname === 'api.neminventar.dk' && url.pathname === '/pris') {
      v.pris.kald.push(url);
      if (v.pris.status !== 200) return new Response('nede', { status: v.pris.status });
      return Response.json(v.pris.svar);
    }
    if (url.hostname === 'alarm.test') {
      v.alarmer.push({ body: JSON.parse(init.body), headers: new Headers(init.headers) });
      return new Response(null, { status: 200 });
    }
    v.fremmede.push(url.href);
    throw new TypeError('ukendt vært i testen');
  };

  // Ét kald gennem Workeren. Standard: fra konto-siden selv (Origin = konto, Sec-Fetch-Site = same-origin).
  v.kald = async (metode, sti, o = {}) => {
    const headers = new Headers({ 'cf-connecting-ip': o.ip ?? '203.0.113.7' });
    const origin = o.origin === undefined ? (metode === 'GET' ? null : KONTO) : o.origin;
    if (origin) headers.set('origin', origin);
    if (o.sfs !== null) headers.set('sec-fetch-site', o.sfs ?? (origin === DESIGNER ? 'same-site' : 'same-origin'));
    if (o.cookie) headers.set('cookie', o.cookie.includes('=') ? o.cookie : `__Host-ni_konto=${o.cookie}`);
    let body;
    if (metode === 'POST') {
      headers.set('content-type', o.type ?? 'application/json');
      body = o.raa ?? JSON.stringify(o.body ?? {});
    }
    for (const [k, val] of Object.entries(o.headers ?? {})) headers.set(k, val);
    const req = new Request(`${KONTO}${sti}`, { method: metode, headers, body });
    const ventende = [];
    const res = await haandter(req, v.env, { waitUntil: (p) => ventende.push(p) }, {
      fetch: v.fetch, db: v.db, nu: v.nu, ...(standardLog ? {} : { log: (type, f) => v.logs.push({ type, ...f }) }),
    });
    await Promise.all(ventende);
    // Et billede (miniaturen) kommer som bytes; alt andet er JSON
    const erJson = /^application\/json/.test(res.headers.get('content-type') ?? '') || !res.headers.get('content-type');
    const bytes = erJson ? null : new Uint8Array(await res.arrayBuffer());
    const tekst = erJson ? await res.text() : '';
    return {
      status: res.status,
      json: tekst ? JSON.parse(tekst) : null,
      bytes,
      headers: res.headers,
      setCookie: res.headers.getSetCookie(),
    };
  };

  // Hele log ind: kode → mailen → tjek. Giver sessionens token.
  v.logInd = async (email = EJER, o = {}) => {
    const a = await v.kald('POST', '/api/kode', { body: { email, turnstile: 'tok', formaal: 'log_ind', ...o.kode } });
    if (a.status !== 200) throw new Error(`kode: ${a.status} ${JSON.stringify(a.json)}`);
    const kode = senesteKode(v, email);
    const b = await v.kald('POST', '/api/kode/tjek', { body: { email, kode } });
    if (b.status !== 200) throw new Error(`tjek: ${b.status} ${JSON.stringify(b.json)}`);
    return { token: tokenAf(b.setCookie), svar: b };
  };
  return v;
}

export function senesteKode(v, email) {
  const m = [...v.mails].reverse().find((x) => x.til === email);
  if (!m) throw new Error('ingen mail');
  return /(\d{3}) (\d{3})/.exec(m.tekst).slice(1).join('');
}

export function tokenAf(setCookie) {
  const c = setCookie.find((x) => x.startsWith('__Host-ni_konto='));
  return c ? c.slice('__Host-ni_konto='.length).split(';')[0] : null;
}
