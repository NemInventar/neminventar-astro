// Reglerne R1–R21 (plan-teknik-v3.md §4) som tal og rene funktioner. Ingen I/O.
// Tallene i lofterne står også i konto/sql/002_funktioner.sql; test/regler.test.mjs tjekker, at de passer sammen.

export const KODE_CIFRE = 6;                                   // R1
export const KODE_LEVETID_MIN = { log_ind: 15, slet: 10 };     // R1
export const FORSOEG_PR_KODE = 5;                              // R2

// R3 (+ R19 alarmer). Gem- og visningsloftet er værn mod en løbsk klient og mod oversvømmelse af broen.
export const LOFT = {
  email_15min: 3,
  forkerte_doegn: 20,
  ip_time: 10,
  alle_doegn: 150,
  alle_alarm: 75,
  forkerte_time_alarm: 50,
  byge_alarm: 20,
  gem_doegn: 50,
  visning_ip_time: 300,
};

// R6
export const SESSION = {
  cookie: '__Host-ni_konto',
  inaktiv_s: 30 * 24 * 3600,     // 2592000 = Max-Age
  absolut_s: 90 * 24 * 3600,
};

export const PROD_ORIGINS = Object.freeze({
  konto: 'https://konto.neminventar.dk',
  designer: 'https://designer.neminventar.dk',
});

// R9: designerens origin må kun kalde disse to
export const DESIGNER_RUTER = new Set(['/api/mig', '/api/gem']);

// S10: handlingen i Turnstile-widgetten på konto-værten (data-action="konto-kode")
export const TURNSTILE_ACTION = 'konto-kode';

export const PRIS_URL = 'https://api.neminventar.dk/pris';
export const DESIGNER_LINK = 'https://designer.neminventar.dk/designer';

// I produktion er origins faste; i staging (Pages-preview på *.ni-konto.pages.dev) kommer de fra miljøet.
export function origins(env) {
  if (env.MILJOE === 'prod') return PROD_ORIGINS;
  return {
    konto: gyldigOrigin(env.KONTO_ORIGIN) ?? PROD_ORIGINS.konto,
    designer: gyldigOrigin(env.DESIGNER_ORIGIN) ?? PROD_ORIGINS.designer,
  };
}

function gyldigOrigin(x) {
  if (typeof x !== 'string' || !x) return null;
  try {
    const u = new URL(x);
    return u.protocol === 'https:' && u.origin === x ? x : null;
  } catch {
    return null;
  }
}

export const flag = (env, navn) => env[navn] === 'true';

// E-mail: små bogstaver (kontrakter §5), HTML5-formen, højst 254 tegn. null = ugyldig.
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
export function normEmail(x) {
  if (typeof x !== 'string') return null;
  const e = x.trim().toLowerCase();
  if (e.length < 3 || e.length > 254 || !EMAIL.test(e)) return null;
  return e;
}

// Koden: seks cifre; mellemrum og bindestreger fra indsat tekst tages væk (fable c1.4). null = ikke seks cifre.
export function rensKode(x) {
  if (typeof x !== 'string' && typeof x !== 'number') return null;
  const k = String(x).replace(/[\s-]/g, '');
  return /^\d{6}$/.test(k) ? k : null;
}

// R21: retur kun til en sti på konto- eller designer-værten (https). Fragmentet fjernes altid (det kan bære en
// statusnøgle, R10). Ugyldig → null (så lander kunden på Min side).
export function rensRetur(x, o) {
  if (typeof x !== 'string' || !x || x.length > 2000) return null;
  if (/[\u0000-\u001f\u007f]/.test(x)) return null;
  let u;
  try {
    u = new URL(x, `${o.konto}/`);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if (u.origin !== o.konto && u.origin !== o.designer) return null;
  u.hash = '';
  return u.href;
}

// Statusnøglen: 22 tegn base64url (128 bit, kontrakter §4). Alt andet er ukendt — også et ordrenummer (R10).
export const erNoegle = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{22}$/.test(x);

// Ordrenummer NI-XXXXXXXX (kontrakter §4)
export function normRef(x) {
  if (typeof x !== 'string') return null;
  const r = x.trim().toUpperCase();
  return /^NI-[0-9A-F]{8}$/.test(r) ? r : null;
}

export const erUuid = (x) => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

// Id på et design gemt uden login (designer_mails i ERP): uuid eller et heltal
export const erMailId = (x) => erUuid(x) || (typeof x === 'number' && Number.isSafeInteger(x) && x > 0)
  || (typeof x === 'string' && /^[1-9]\d{0,17}$/.test(x));

export const erProdukt = (x) => typeof x === 'string' && /^[a-z][a-z0-9_-]{0,39}$/.test(x);

// Designnavn: 1–80 tegn, ingen kontroltegn, mellemrum samlet
export function rensNavn(x) {
  if (typeof x !== 'string') return null;
  const n = x.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return n.length >= 1 && n.length <= 80 ? n : null;
}
