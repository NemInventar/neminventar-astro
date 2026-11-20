// Klienten til broen `konto-bro` i ERP'et (kontrakter.md §5). Workeren har ingen nøgle til ERP'et, kun
// HMAC-hemmeligheden: x-bro-sig = base64url(HMAC-SHA256(BRO_HEMMELIGHED_<v>, "POST\n/konto-bro\n<tid>\n<nonce>\n<body>")).
// Body = {handling, ...ind}. Alt andet end et 200-svar med et JSON-objekt er "nede" (plan §8).
// filtrerOrdre er et ekstra værn (R12, R13): kun felterne i hvidlisten §4b kommer videre, også hvis broen en dag sender mere.
import { b64url, hmacBytes, tilfaeldigeBytes } from './krypto.js';

export class BroNede extends Error {
  constructor(kode) {
    super(kode);
    this.name = 'BroNede';
    this.kode = kode;
  }
}

export const BRO_STI = '/konto-bro';
const TIMEOUT_MS = 8_000;

export async function broSignatur(hemmelighed, tid, nonce, body) {
  return b64url(await hmacBytes(hemmelighed, `POST\n${BRO_STI}\n${tid}\n${nonce}\n${body}`));
}

export async function broKald(env, fetcher, handling, ind, nu = Date.now()) {
  const v = env.BRO_V || '1';
  const hemmelighed = env[`BRO_HEMMELIGHED_${v}`];
  if (!env.BRO_URL || !hemmelighed) throw new BroNede('konfig');
  const body = JSON.stringify({ handling, ...ind });
  const tid = String(nu);
  const nonce = b64url(tilfaeldigeBytes(16));
  const sig = await broSignatur(hemmelighed, tid, nonce, body);
  let res;
  try {
    res = await fetcher(env.BRO_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bro-tid': tid, 'x-bro-nonce': nonce, 'x-bro-v': v, 'x-bro-sig': sig },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new BroNede('netvaerk');
  }
  if (res.status !== 200) throw new BroNede(`http_${res.status}`);
  let d;
  try {
    d = await res.json();
  } catch {
    throw new BroNede('svar');
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new BroNede('svar');
  return d;
}

// ---------- hvidlisten (kontrakter §5, plan §4b) ----------

const SKJULTE_TRIN = new Set(['email_rettet', 'noegle_fornyet', 'ikke_min', 'ordreside_aabnet']);
const FJERN_NOEGLER = new Set(['kundens_ja', 'sat_af']);
const erObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const tekst = (x) => (typeof x === 'string' ? x : null);
const tal = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

function uden(x, dybde = 0) {
  if (dybde > 6) return null;
  if (Array.isArray(x)) return x.map((v) => uden(v, dybde + 1));
  if (!erObj(x)) return x;
  const ud = {};
  for (const [k, v] of Object.entries(x)) if (!FJERN_NOEGLER.has(k)) ud[k] = uden(v, dybde + 1);
  return ud;
}

function plukket(x, felter) {
  if (!erObj(x)) return null;
  const ud = {};
  for (const [k, slags] of Object.entries(felter)) {
    if (!(k in x)) continue;
    ud[k] = slags === 'tekst' ? tekst(x[k]) : slags === 'tal' ? tal(x[k]) : slags === 'bool' ? x[k] === true : x[k];
  }
  return ud;
}

// visning: 'uden_login' | 'med_login'. → den rensede ordre, eller null (ikke en ordre, der må vises: R12)
export function filtrerOrdre(o, visning) {
  if (!erObj(o) || (o.status !== 'betalt' && o.status !== 'annulleret')) return null;
  const ud = {
    ref: tekst(o.ref),
    bestilt: tekst(o.bestilt),
    status: o.status,
    sprog: tekst(o.sprog),
    produkt: tekst(o.produkt),
    linjer: Array.isArray(o.linjer) ? o.linjer.map((l) => plukket(l, { tekst: 'tekst', antal: 'tal', beloeb_oere: 'tal' })).filter(Boolean) : [],
    levering: plukket(o.levering, { form: 'tekst', tekst: 'tekst' }),
    total: plukket(o.total, { ex_oere: 'tal', moms_oere: 'tal', inkl_oere: 'tal', valuta: 'tekst' }),
    beskrivelse: erObj(o.beskrivelse) || Array.isArray(o.beskrivelse) ? uden(o.beskrivelse) : null,
    forloeb: Array.isArray(o.forloeb)
      ? o.forloeb.filter((f) => erObj(f) && typeof f.trin === 'string' && !SKJULTE_TRIN.has(f.trin))
        .map((f) => ({ trin: f.trin, data: erObj(f.data) ? uden(f.data) : {}, tid: tekst(f.tid) }))
      : [],
    betaling: plukket(o.betaling, { betalt_at: 'tekst', betalingsmiddel: 'tekst', refunderet_oere: 'tal', refunderet_at: 'tekst' }),
    fortrydelsesret: o.fortrydelsesret === true,
    uge_frist_at: tekst(o.uge_frist_at),
    adresse: plukket(o.adresse, visning === 'med_login'
      ? { postnr: 'tekst', by: 'tekst', navn: 'tekst', gade: 'tekst' }
      : { postnr: 'tekst', by: 'tekst' }),
  };
  if (!ud.ref) return null;
  if (visning === 'med_login') {
    ud.besked = tekst(o.besked);
    ud.permalink = tekst(o.permalink);
  }
  return ud;
}

export function filtrerGemtUdenLogin(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.filter(erObj).map((d) => ({
    id: typeof d.id === 'number' || typeof d.id === 'string' ? d.id : null,
    produkt: tekst(d.produkt),
    titel: tekst(d.titel),
    dato: tekst(d.dato),
    permalink: tekst(d.permalink),
    pris_oere: tal(d.pris_oere),
  })).filter((d) => d.id !== null);
}
