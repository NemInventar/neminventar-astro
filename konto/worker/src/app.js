// ni-konto-backend: konto-API'et bag konto.neminventar.dk/api/* (kontrakter.md §6, plan-teknik-v3.md §4 R1–R21).
// Nås kun gennem service binding fra Pages-projektet ni-konto (konto/functions/api/[[sti]].js); ingen offentlig rute.
// haandter(req, env, ctx, deps) — deps = {fetch, db, nu, log} kan erstattes i testene (fake-db, fake Graph, Turnstile, bro).
import {
  LOFT, SESSION, DESIGNER_RUTER, PRIS_URL, origins, flag, normEmail, rensKode, rensRetur, erNoegle, normRef,
  erUuid, erMailId, erProdukt, rensNavn, rensMiniature, MINIATURE_TYPE,
} from './regler.js';
import { hmacHex, sha256Hex, nyKode, nyToken, erToken } from './krypto.js';
import { lavDb, DbFejl } from './db.js';
import { turnstileOk } from './turnstile.js';
import { sendMail, MailFejl } from './graph.js';
import { loginKodeMail, sletKodeMail, kontoSlettetMail } from './mails.js';
import { broKald, filtrerOrdre, filtrerGemtUdenLogin } from './bro.js';
import { rensT, prisVedGem } from './pris.js';
import { alarm } from './alarm.js';

const MAKS_BODY = 16 * 1024;
// "gem" bærer designerens miniature (højst 150 kB som base64 ≈ 200 kB) ud over t (højst 6.000 tegn) — kun den rute får mere
const MAKS_BODY_GEM = 224 * 1024;

// Et svar, der kastes fra en handler: {status, body}
class Svar {
  constructor(status, body) {
    this.status = status;
    this.body = body;
  }
}

// Et billede fra en handler (miniaturen): bytes og type — sendes som det er, ikke som JSON
class Billede {
  constructor(bytes, type) {
    this.bytes = bytes;
    this.type = type;
  }
}

// R17: loggen får kun type, sti, status og fejlkoder — aldrig headere, body, e-mail, kode, cookie eller nøgle
const standardLog = (type, felter = {}) => console.log(JSON.stringify({ type, ...felter }));

const erObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const kbhDag = (ms) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date(ms));

// R6: cookien præcis som i kontrakten (§6). Kun på konto-værten (__Host-: ingen Domain, Path=/, Secure).
export const lavCookie = (token, maxAge) =>
  `${SESSION.cookie}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
export const sletCookie = () => `${SESSION.cookie}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;

function laesCookie(req) {
  const h = req.headers.get('cookie');
  if (!h) return null;
  for (const del of h.split(';')) {
    const i = del.indexOf('=');
    if (i < 0) continue;
    if (del.slice(0, i).trim() === SESSION.cookie) {
      const v = del.slice(i + 1).trim();
      if (erToken(v)) return v;
    }
  }
  return null;
}

function maaSendeTil(env, email) {
  const liste = String(env.TEST_HVIDLISTE ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (env.MILJOE === 'prod' && liste.length === 0) return true;
  return liste.includes(email);         // staging: kun hvidlisten (kontrakter §8); uden liste sendes intet
}

class Kontekst {
  constructor(req, env, ctx, deps, sti) {
    this.req = req;
    this.env = env;
    this.ctx = ctx;
    this.sti = sti;
    this.fetch = deps.fetch ?? ((i, init) => fetch(i, init));
    this.nu = deps.nu ?? (() => Date.now());
    this.log = deps.log ?? standardLog;
    this.db = deps.db ?? lavDb(env.NI_KONTO_URL, env.NI_KONTO_SERVICE_KEY, this.fetch);
    this.origins = origins(env);
    const ip = req.headers.get('cf-connecting-ip');
    this.ip = ip && /^[0-9A-Fa-f:.]{2,45}$/.test(ip) ? ip : null;
    this.body = {};
    this.cookie = null;       // Set-Cookie på svaret
    this.cors = null;         // Access-Control-Allow-Origin (kun designeren, R9)
    this.ventende = [];
    this._session = undefined;
  }

  baggrund(p) {
    const q = Promise.resolve(p).catch(() => {});
    if (this.ctx && typeof this.ctx.waitUntil === 'function') this.ctx.waitUntil(q);
    else this.ventende.push(q);
  }

  // Aktiv peber (KODE_PEBER_<KODE_PEBER_V>). Mangler den, er kontoen lukket (fejler lukket).
  peber() {
    const v = Number(this.env.KODE_PEBER_V || '1');
    const noegle = this.env[`KODE_PEBER_${v}`];
    if (!Number.isInteger(v) || v < 1 || typeof noegle !== 'string' || noegle.length < 16) {
      this.log('konfig_mangler', { hvad: 'KODE_PEBER' });
      throw new Svar(503, { fejl: 'lukket' });
    }
    return { v, noegle };
  }

  logHmac(data) {
    return hmacHex(this.peber().noegle, `log:${data}`);
  }

  async ipDag() {
    if (!this.ip) return null;
    return (await this.logHmac(`ipdag:${kbhDag(this.nu())}:${this.ip}`)).slice(0, 32);
  }

  haendelse(type, emailHmac = null) {
    this.baggrund((async () => this.db.rpc('haendelse', { p_type: type, p_email_hmac: emailHmac, p_ip_dag: await this.ipDag() }))());
  }

  alarm(type, linjer) {
    this.baggrund(alarm(this.env, this.fetch, type, linjer));
  }

  // Graph-alarmen højst én gang i timen (et nedbrud må ikke give en alarm pr. kunde)
  alarmEnGangITimen(type, linjer) {
    this.baggrund((async () => {
      let ok = true;
      try {
        ok = (await this.db.rpc('loft_tael', { p_noegle: `alarm:${type}`, p_max: 1, p_periode: 'time' }))?.ok !== false;
      } catch {
        ok = true;
      }
      if (ok) await alarm(this.env, this.fetch, type, linjer);
    })());
  }

  bro(handling, ind) {
    return broKald(this.env, this.fetch, handling, ind, this.nu());
  }

  // R6: gyldig session → {kunde_id, email, sprog}, og cookien fornyes (30 dage, aldrig ud over de 90).
  // Ugyldig → null, og cookien slettes. ni-konto nede → DbFejl kastes (kalderen vælger).
  async session() {
    if (this._session !== undefined) return this._session;
    const token = laesCookie(this.req);
    if (!token) {
      if ((this.req.headers.get('cookie') ?? '').includes(`${SESSION.cookie}=`)) this.cookie = sletCookie();
      this._session = null;
      return null;
    }
    const s = await this.db.rpc('session_forny', { p_token_sha256: await sha256Hex(token) });
    const rest = s && s.udloeber_absolut ? Math.floor((Date.parse(s.udloeber_absolut) - this.nu()) / 1000) : 0;
    if (!s || !erUuid(s.kunde_id) || typeof s.email !== 'string' || rest <= 0) {
      this.cookie = sletCookie();
      this._session = null;
      return null;
    }
    this.cookie = lavCookie(token, Math.min(SESSION.inaktiv_s, rest));
    this._session = { kunde_id: s.kunde_id, email: s.email, sprog: s.sprog === 'en' ? 'en' : 'da' };
    return this._session;
  }

  async kraevSession() {
    let s;
    try {
      s = await this.session();
    } catch {
      throw new Svar(503, { fejl: 'nede' });
    }
    if (!s) throw new Svar(401, { fejl: 'login' });
    return s;
  }
}

// ---------- koder ----------

// R1, R3, R4, R5: samme regnevej, uanset om kontoen findes — intet her (og intet i kode_opret) læser kunder
async function sendKode(k, email, formaal, sprog, retur) {
  const p = k.peber();
  const [emailHmac, ipHash] = await Promise.all([k.logHmac(`email:${email}`), k.ip ? k.logHmac(`ip:${k.ip}`) : null]);
  const kodeId = crypto.randomUUID();
  const kode = nyKode();
  const kodeHmac = await hmacHex(p.noegle, `${email}:${kodeId}:${kode}`);
  let r;
  try {
    r = await k.db.rpc('kode_opret', {
      p_email: email, p_email_hmac: emailHmac, p_ip_hash: ipHash ? ipHash.slice(0, 32) : null, p_formaal: formaal,
      p_sprog: sprog, p_kode_id: kodeId, p_kode_hmac: kodeHmac, p_peber_v: p.v, p_retur: retur,
    });
  } catch {
    throw new Svar(503, { fejl: 'mail' });
  }
  if (!erObj(r)) throw new Svar(503, { fejl: 'mail' });
  if (r.fejl) {
    if (r.byge === LOFT.byge_alarm) k.alarm('byge', [`afviste i denne time: ${r.byge}`]);
    k.haendelse(r.fejl === 'doegn' ? 'kode_doegn' : 'kode_loft', emailHmac);
    throw new Svar(429, { fejl: r.fejl === 'doegn' ? 'doegn' : 'loft' });
  }
  if (r.alle === LOFT.alle_alarm) k.alarm('koder_doegn', [`koder sendt i dag: ${r.alle}`]);

  if (!maaSendeTil(k.env, email)) {
    k.log('mail_ikke_sendt', { grund: 'hvidliste' });
  } else {
    try {
      await sendMail(k.env, k.fetch, { til: email, ...(formaal === 'slet' ? sletKodeMail(kode, sprog) : loginKodeMail(kode, sprog)) }, k.nu());
    } catch (e) {
      k.log('mail_fejl', { kode: e instanceof MailFejl ? e.kode : 'ukendt' });
      k.alarmEnGangITimen('graph', [`kode: ${e instanceof MailFejl ? e.kode : 'ukendt'}`]);
      k.haendelse('mail_fejl', emailHmac);
      throw new Svar(503, { fejl: 'mail' });
    }
  }
  k.haendelse(formaal === 'slet' ? 'slet_kode_sendt' : 'kode_sendt', emailHmac);
  return { ok: true };
}

// R2: ét forsøg. kode_aktiv giver id og peberversion; uden en åben kode regnes HMAC'en alligevel (med et tilfældigt id),
// så kendt og ukendt e-mail går samme vej (R5). `rpc` er kode_tjek eller konto_slet.
async function forsoeg(k, email, formaal, kode, rpc) {
  const emailHmac = await k.logHmac(`email:${email}`);
  let aktiv;
  try {
    aktiv = await k.db.rpc('kode_aktiv', { p_email: email, p_formaal: formaal });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  const kodeId = erUuid(aktiv?.kode_id) ? aktiv.kode_id : crypto.randomUUID();
  const v = Number.isInteger(aktiv?.peber_v) ? aktiv.peber_v : k.peber().v;
  const noegle = k.env[`KODE_PEBER_${v}`] ?? k.peber().noegle;
  const kodeHmac = await hmacHex(noegle, `${email}:${kodeId}:${kode}`);
  let r;
  try {
    r = await rpc({ p_kode_id: kodeId, p_kode_hmac: kodeHmac, p_email_hmac: emailHmac });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  if (!erObj(r)) throw new Svar(503, { fejl: 'nede' });
  if (r.fejl) {
    if (r.forkerte_time === LOFT.forkerte_time_alarm + 1) k.alarm('forkerte_time', [`forkerte koder i denne time: ${r.forkerte_time}`]);
    k.haendelse(`kode_${r.fejl}`, emailHmac);
    if (r.fejl === 'forkert') throw new Svar(400, { fejl: 'forkert', tilbage: Number.isInteger(r.tilbage) ? r.tilbage : 0 });
    if (r.fejl === 'laast' || r.fejl === 'udloebet') throw new Svar(400, { fejl: r.fejl });
    if (r.fejl === 'doegn') throw new Svar(429, { fejl: 'doegn' });
    throw new Svar(503, { fejl: 'nede' });
  }
  return { ...r, emailHmac };
}

async function kode(k) {
  const b = k.body;
  if (b.formaal !== undefined && b.formaal !== 'log_ind') throw new Svar(400, { fejl: 'formaal' });
  const email = normEmail(b.email);
  if (!email) throw new Svar(400, { fejl: 'email' });
  const sprog = b.sprog === 'en' ? 'en' : 'da';
  const retur = rensRetur(b.retur, k.origins);
  k.peber();
  const vaert = new URL(k.origins.konto).hostname;
  if (!(await turnstileOk(k.env.TURNSTILE_SECRET, b.turnstile, k.ip, vaert, k.fetch))) {
    k.haendelse('robot');
    throw new Svar(403, { fejl: 'robot' });
  }
  return sendKode(k, email, 'log_ind', sprog, retur);
}

async function kodeTjek(k) {
  const email = normEmail(k.body.email);
  if (!email) throw new Svar(400, { fejl: 'email' });
  const kode = rensKode(k.body.kode);
  if (!kode) throw new Svar(400, { fejl: 'kort' });
  const token = nyToken();
  const tokenSha = await sha256Hex(token);
  const r = await forsoeg(k, email, 'log_ind', kode, (a) => k.db.rpc('kode_tjek', { ...a, p_token_sha256: tokenSha }));
  if (r.ok !== true) throw new Svar(503, { fejl: 'nede' });
  k.cookie = lavCookie(token, SESSION.inaktiv_s);
  k.haendelse('login', r.emailHmac);
  return { ok: true, retur: typeof r.retur === 'string' ? r.retur : null, ny: r.ny === true };
}

// ---------- session og konto ----------

async function mig(k) {
  const konto = flag(k.env, 'KONTO_AKTIV');
  const ordrestatus = flag(k.env, 'ORDRESTATUS_AKTIV');
  let s = null;
  if (konto) {
    try {
      s = await k.session();
    } catch {
      s = null;
    }
  }
  return s
    ? { logget_ind: true, email: s.email, konto_aktiv: konto, ordrestatus_aktiv: ordrestatus }
    : { logget_ind: false, konto_aktiv: konto, ordrestatus_aktiv: ordrestatus };
}

async function logUd(k) {
  const token = laesCookie(k.req);
  k.cookie = sletCookie();
  const alle = k.body.alle === true;
  if (token) {
    try {
      await k.db.rpc(alle ? 'session_luk_alle' : 'session_luk', { p_token_sha256: await sha256Hex(token) });
    } catch {
      throw new Svar(503, { fejl: 'nede' });
    }
    k.haendelse(alle ? 'log_ud_alle' : 'log_ud');
  }
  return { ok: true };
}

async function sletKode(k) {
  const s = await k.kraevSession();
  return sendKode(k, s.email, 'slet', s.sprog, null);
}

async function slet(k) {
  const s = await k.kraevSession();
  const kode = rensKode(k.body.kode);
  if (!kode) throw new Svar(400, { fejl: 'kort' });
  const r = await forsoeg(k, s.email, 'slet', kode, (a) => k.db.rpc('konto_slet', { p_kunde_id: s.kunde_id, ...a }));
  if (r.ok !== true) throw new Svar(503, { fejl: 'nede' });
  k.cookie = sletCookie();
  k.haendelse('konto_slettet', r.emailHmac);
  k.alarm('konto_slettet', []);
  // Fable c6.4: én mail. "[har ordrer]"-linjen kun, når broen svarer med mindst én bestilling.
  k.baggrund((async () => {
    let harOrdrer = false;
    try {
      const b = await k.bro('ordrer_for_email', { email: s.email });
      harOrdrer = Array.isArray(b.ordrer) && b.ordrer.length > 0;
    } catch {
      harOrdrer = false;
    }
    if (!maaSendeTil(k.env, s.email)) return;
    try {
      await sendMail(k.env, k.fetch, { til: s.email, ...kontoSlettetMail(harOrdrer, s.sprog) }, k.nu());
    } catch (e) {
      k.log('mail_fejl', { kode: e instanceof MailFejl ? e.kode : 'ukendt' });
      k.alarmEnGangITimen('graph', [`kode: ${e instanceof MailFejl ? e.kode : 'ukendt'}`]);
    }
  })());
  return { ok: true };
}

// ---------- ordrer (gennem broen) ----------

// Ukendt og erstattet nøgle er et svar, ikke en HTTP-fejl (kontrakter §6, rettet 12-11): status 200 med {fejl}, så
// browserens konsol ikke viser en rød linje for et gammelt eller forkert link. Siden læser kun fejl-feltet (ordre-start.mjs).
async function ordre(k) {
  const noegle = k.body.noegle;
  // R10: kun en statusnøgle (22 tegn). Et ordrenummer går gennem /api/ordre-ref med login.
  if (!erNoegle(noegle)) return { fejl: 'ukendt' };
  // Plan §8: loftet på visning fejler åbent (ordresiden virker, selv om ni-konto eller peberen mangler)
  let fuldt = false;
  if (k.ip) {
    try {
      const l = await k.db.rpc('loft_tael', { p_noegle: `visning:${(await k.logHmac(`ip:${k.ip}`)).slice(0, 32)}`, p_max: LOFT.visning_ip_time, p_periode: 'time' });
      fuldt = l?.ok === false;
    } catch {
      fuldt = false;
    }
  }
  if (fuldt) throw new Svar(429, { fejl: 'loft' });
  let b;
  try {
    b = await k.bro('ordre_for_noegle', { noegle });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  if (b.fejl === 'erstattet') return { fejl: 'erstattet' };
  const uden = filtrerOrdre(b.ordre, 'uden_login');
  if (!uden) return { fejl: 'ukendt' };
  // Med session og passende e-mail → med login (broen afgør, om e-mailen passer)
  if (flag(k.env, 'KONTO_AKTIV')) {
    let s = null;
    try {
      s = await k.session();
    } catch {
      s = null;
    }
    if (s) {
      try {
        const m = filtrerOrdre((await k.bro('ordre_for_ref', { email: s.email, ref: uden.ref })).ordre, 'med_login');
        if (m) return { visning: 'med_login', ordre: m };
      } catch {
        // broen svarede på nøglen, men ikke her: vis uden login
      }
    }
  }
  return { visning: 'uden_login', ordre: uden };
}

async function ordreRef(k) {
  const s = await k.kraevSession();
  const ref = normRef(k.body.ref);
  if (!ref) throw new Svar(404, { fejl: 'ukendt' });
  let b;
  try {
    b = await k.bro('ordre_for_ref', { email: s.email, ref });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  const m = filtrerOrdre(b.ordre, 'med_login');
  if (!m) throw new Svar(404, { fejl: 'ukendt' });
  return { visning: 'med_login', ordre: m };
}

async function ikkeMin(k) {
  const s = await k.kraevSession();
  const ref = normRef(k.body.ref);
  if (!ref) throw new Svar(404, { fejl: 'ukendt' });
  try {
    await k.bro('ikke_min', { email: s.email, ref });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  return { ok: true };
}

async function skjul(k) {
  const s = await k.kraevSession();
  const id = k.body.id;
  if (!erMailId(id)) throw new Svar(404, { fejl: 'ukendt' });
  try {
    await k.bro('skjul_design', { email: s.email, id });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  return { ok: true };
}

// ---------- Min side og designs ----------

async function minSide(k) {
  const s = await k.kraevSession();
  const [designs, b] = await Promise.all([
    k.db.rpc('design_liste', { p_kunde_id: s.kunde_id }).catch(() => null),
    k.bro('ordrer_for_email', { email: s.email }).catch(() => null),
  ]);
  if (!Array.isArray(designs)) throw new Svar(503, { fejl: 'nede' });
  // Plan §8: broen nede → {fejl:'nede'} på ordrer; designs og konto virker
  const ordrer = b && Array.isArray(b.ordrer)
    ? b.ordrer.map((o) => filtrerOrdre(o, 'med_login')).filter(Boolean)
    : { fejl: 'nede' };
  return {
    email: s.email,
    ordrer,
    designs: designs.filter(erObj).map((d) => ({
      id: d.id, produkt: d.produkt, navn: d.navn ?? null, titel: typeof d.titel === 'string' ? d.titel : null, t: d.t,
      // miniaturen (R4): adressen på konto-værten, når designet har et billede — ellers null (siden viser produktets ikon)
      pris_oere: d.pris_oere ?? null, gemt: d.gemt, miniature: d.har_miniature === true && erUuid(d.id) ? miniatureUd(miniatureSti(d.id)) : null,
      // Rumbilledet (Fable port 3, nr. 15): designeren sender endnu ikke rumbilledets id med ved gem — indtil da null
      rumbillede: null,
    })),
    gemt_uden_login: b ? filtrerGemtUdenLogin(b.gemt_uden_login) : [],
  };
}

// Miniaturen (kontrakter §6, Fable port 3, nr. 15): kun en sti på konto-værten (/api/…, sidens CSP har img-src 'self').
// Alt andet — også en sti i en bucket — bliver null, og siden viser produktets ikon.
export const miniatureUd = (m) => (typeof m === 'string' && /^\/api\/[A-Za-z0-9/_?=&.%-]{1,300}$/.test(m) && !m.includes('..') ? m : null);
export const miniatureSti = (id) => `/api/design/miniature?id=${id}`;

async function gem(k) {
  const s = await k.kraevSession();
  const b = k.body;
  if (!erProdukt(b.produkt)) throw new Svar(400, { fejl: 'design' });
  const t = rensT(b.t);                                 // R11: uden eget foto
  if (!t) throw new Svar(400, { fejl: 'design' });
  let navn = null;
  if (b.navn !== undefined && b.navn !== null && b.navn !== '') {
    navn = rensNavn(b.navn);
    if (!navn) throw new Svar(400, { fejl: 'navn' });
  }
  // Miniaturen (R4): en JPEG under loftet gemmes med designet; en ugyldig afvises stille — designet gemmes uden billede
  const mini = b.miniature === undefined || b.miniature === null ? null : rensMiniature(b.miniature);
  if (b.miniature != null && !mini) k.log('miniature_afvist', {});
  const prisUrl = k.env.MILJOE !== 'prod' && k.env.PRIS_URL ? k.env.PRIS_URL : PRIS_URL;
  const pris = await prisVedGem(prisUrl, k.fetch, b.produkt, t);
  let r;
  try {
    // titel = designets opsummering, som /pris regner den (samme tekst som designerens gem-dialog) — vises under navnet
    r = await k.db.rpc('design_gem', {
      p_kunde_id: s.kunde_id, p_produkt: b.produkt, p_tilstand: t, p_navn: navn ?? pris.titel, p_pris_oere: pris.pris_oere,
      p_titel: pris.titel, p_miniature: mini ? mini.b64 : null, p_miniature_type: mini ? MINIATURE_TYPE : null,
    });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  if (r?.fejl === 'loft') throw new Svar(429, { fejl: 'loft' });
  if (r?.ok !== true || !erUuid(r.id)) throw new Svar(503, { fejl: 'nede' });
  // Beslutning 11 (ja): et gem med login giver også en henvendelse; samme e-mail inden for 30 dage samles i broen
  k.baggrund(k.bro('design_gemt', { email: s.email, produkt: b.produkt, t, pris_oere: pris.pris_oere }));
  k.haendelse('design_gemt');
  return { ok: true, id: r.id, pris_oere: pris.pris_oere };
}

// GET /api/design/miniature?id=… (R4, kontrakter §6): billedet af et design, kun til kontoens egen session (ejerskabet ligger i
// forespørgslen, design_miniature). Fra konto-værten selv (sidens CSP img-src 'self'), aldrig fra designeren. Et andet designs id,
// et design uden billede og et ugyldigt id giver samme 404.
async function designMiniature(k) {
  const s = await k.kraevSession();
  const id = new URL(k.req.url).searchParams.get('id');
  if (!erUuid(id)) throw new Svar(404, { fejl: 'ukendt' });
  let r;
  try {
    r = await k.db.rpc('design_miniature', { p_kunde_id: s.kunde_id, p_id: id });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  const b64 = typeof r?.b64 === 'string' ? r.b64.replace(/\s+/g, '') : '';   // Postgres' encode(…, 'base64') bryder linjerne
  const mini = r?.type === MINIATURE_TYPE ? rensMiniature(b64) : null;
  if (!mini) throw new Svar(404, { fejl: 'ukendt' });
  return new Billede(mini.bytes, MINIATURE_TYPE);
}

async function designSlet(k) {
  const s = await k.kraevSession();
  if (!erUuid(k.body.id)) throw new Svar(404, { fejl: 'ukendt' });
  let r;
  try {
    r = await k.db.rpc('design_slet', { p_kunde_id: s.kunde_id, p_id: k.body.id });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  if (r?.ok !== true) throw new Svar(404, { fejl: 'ukendt' });
  return { ok: true };
}

async function designNavn(k) {
  const s = await k.kraevSession();
  if (!erUuid(k.body.id)) throw new Svar(404, { fejl: 'ukendt' });
  const navn = rensNavn(k.body.navn);
  if (!navn) throw new Svar(400, { fejl: 'navn' });
  let r;
  try {
    r = await k.db.rpc('design_navn', { p_kunde_id: s.kunde_id, p_id: k.body.id, p_navn: navn });
  } catch {
    throw new Svar(503, { fejl: 'nede' });
  }
  if (r?.ok !== true) throw new Svar(r?.fejl === 'navn' ? 400 : 404, { fejl: r?.fejl === 'navn' ? 'navn' : 'ukendt' });
  return { ok: true };
}

// ---------- router ----------

// flag: R14 — fra = 503 {fejl:'lukket'}
export const RUTER = {
  '/api/mig': { metode: 'GET', flag: null, h: mig },
  '/api/ordre': { metode: 'POST', flag: 'ORDRESTATUS_AKTIV', h: ordre },
  '/api/ordre-ref': { metode: 'POST', flag: 'KONTO_AKTIV', h: ordreRef },
  '/api/kode': { metode: 'POST', flag: 'KONTO_AKTIV', h: kode },
  '/api/kode/tjek': { metode: 'POST', flag: 'KONTO_AKTIV', h: kodeTjek },
  '/api/min-side': { metode: 'GET', flag: 'KONTO_AKTIV', h: minSide },
  '/api/gem': { metode: 'POST', flag: 'KONTO_AKTIV', h: gem, maksBody: MAKS_BODY_GEM },
  '/api/design/miniature': { metode: 'GET', flag: 'KONTO_AKTIV', h: designMiniature },
  '/api/design/slet': { metode: 'POST', flag: 'KONTO_AKTIV', h: designSlet },
  '/api/design/navn': { metode: 'POST', flag: 'KONTO_AKTIV', h: designNavn },
  '/api/gemt-uden-login/skjul': { metode: 'POST', flag: 'KONTO_AKTIV', h: skjul },
  '/api/ikke-min': { metode: 'POST', flag: 'KONTO_AKTIV', h: ikkeMin },
  '/api/log-ud': { metode: 'POST', flag: null, h: logUd },
  '/api/slet/kode': { metode: 'POST', flag: 'KONTO_AKTIV', h: sletKode },
  '/api/slet': { metode: 'POST', flag: 'KONTO_AKTIV', h: slet },
};

// Sikkerhedsheaderne på hvert API-svar. Pages' _headers gælder ikke for svar fra Pages Functions (/api/* går gennem
// konto/functions/api/[[sti]].js til denne Worker), så de sættes her — ét sted, også på fejl, 404 og preflight.
export const SIKKERHEDSHEADERE = Object.freeze({
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
});

// R18: alle svar er JSON med Cache-Control: private, no-store (+ sikkerhedsheaderne, som intet kan overskrive)
function lavSvar(k, status, body, ekstra = {}) {
  const h = new Headers({
    'content-type': 'application/json; charset=utf-8',
    vary: 'Origin, Cookie',
    ...ekstra,
    'cache-control': 'private, no-store',
    ...SIKKERHEDSHEADERE,
  });
  if (k?.cors) {
    h.set('access-control-allow-origin', k.cors);
    h.set('access-control-allow-credentials', 'true');
  }
  if (k?.cookie) h.append('set-cookie', k.cookie);
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: h });
}

// Et billede (miniaturen, R4): privat cache i et døgn — kun i kundens egen browser (designet ændrer aldrig billede; slettes
// designet, står det højst et døgn i browserens cache) — og sikkerhedsheaderne som på alle svar. Kun samme origin må vise det.
function lavBilledSvar(k, b) {
  const h = new Headers({
    'content-type': b.type,
    vary: 'Cookie',
    'cache-control': 'private, max-age=86400',
    'cross-origin-resource-policy': 'same-origin',
    ...SIKKERHEDSHEADERE,
  });
  if (k?.cookie) h.append('set-cookie', k.cookie);
  return new Response(b.bytes, { status: 200, headers: h });
}

async function laesBody(req, maks = MAKS_BODY) {
  const ct = req.headers.get('content-type') ?? '';
  if (!/^application\/json\s*(;|$)/i.test(ct)) throw new Svar(415, { fejl: 'type' });
  const len = Number(req.headers.get('content-length'));
  if (Number.isFinite(len) && len > maks) throw new Svar(413, { fejl: 'stor' });
  const tekst = await req.text();
  if (tekst.length > maks) throw new Svar(413, { fejl: 'stor' });
  let b;
  try {
    b = JSON.parse(tekst || '{}');
  } catch {
    throw new Svar(400, { fejl: 'json' });
  }
  if (!erObj(b)) throw new Svar(400, { fejl: 'json' });
  return b;
}

export async function haandter(req, env, ctx, deps = {}) {
  const url = new URL(req.url);
  const sti = url.pathname;
  const rute = Object.hasOwn(RUTER, sti) ? RUTER[sti] : null;
  const k = new Kontekst(req, env, ctx, deps, sti);
  const start = k.nu();
  let res;
  try {
    if (!rute) throw new Svar(404, { fejl: 'ukendt_sti' });
    const origin = req.headers.get('origin');
    const fraDesigner = DESIGNER_RUTER.has(sti) && origin === k.origins.designer;   // R9

    if (req.method === 'OPTIONS') {
      if (!fraDesigner) throw new Svar(403, { fejl: 'origin' });
      k.cors = origin;
      res = lavSvar(k, 204, null, {
        'access-control-allow-methods': rute.metode,
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '600',
      });
      return res;
    }
    if (req.method !== rute.metode) throw new Svar(405, { fejl: 'metode' });

    // R8: Sec-Fetch-Site afvises kun, hvis den findes og er cross-site (Safari før 16.4 sender den ikke)
    if ((req.headers.get('sec-fetch-site') ?? '').toLowerCase() === 'cross-site') throw new Svar(403, { fejl: 'origin' });
    // R8/R9: præcis Origin. En ændring (POST) skal have den; en GET fra samme origin sender den ikke.
    if (origin !== null && origin !== k.origins.konto && !fraDesigner) throw new Svar(403, { fejl: 'origin' });
    if (origin === null && req.method !== 'GET') throw new Svar(403, { fejl: 'origin' });
    if (fraDesigner) k.cors = origin;
    if (req.method === 'POST') k.body = await laesBody(req, rute.maksBody ?? MAKS_BODY);   // R8: kun application/json (ellers 415)

    if (rute.flag && !flag(env, rute.flag)) throw new Svar(503, { fejl: 'lukket' });   // R14

    const ud = await rute.h(k);
    res = ud instanceof Billede ? lavBilledSvar(k, ud) : lavSvar(k, 200, ud);
  } catch (e) {
    if (e instanceof Svar) {
      res = lavSvar(k, e.status, e.body);
    } else {
      k.log('fejl', { sti, navn: e?.name ?? 'ukendt', kode: e instanceof DbFejl ? e.kode : undefined });
      res = lavSvar(k, 500, { fejl: 'fejl' });
    }
  } finally {
    k.log('svar', { sti: rute ? sti : 'ukendt', metode: req.method, status: res?.status, ms: k.nu() - start });
    if (deps.ventende) deps.ventende.push(...k.ventende);
  }
  return res;
}
