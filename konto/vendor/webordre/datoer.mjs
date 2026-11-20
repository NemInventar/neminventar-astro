// Kernen for Min side og ordrestatus: datoer, uger og frister. Alt regnes i Europe/Copenhagen (kontrakter.md §7, R20).
// Rene funktioner uden I/O og uden afhængigheder — kører i Node 22, Deno, browser og Cloudflare Workers. Kanonisk i
// ni-apps lib/webordre/; kopierne laves af scripts/webordre-kopier.mjs og må ikke rettes i hånden.
//
// En "dato" er altid en dansk kalenderdato 'YYYY-MM-DD'. Et tidsstempel (ISO-streng, Date eller ms) laves om til dansk
// dato med kbhDato. Dato-regning (plusDage, ugedag, ISO-uger) sker i UTC på kalenderdatoen, så sommertid aldrig rykker en dag.

const TZ = 'Europe/Copenhagen';
const DAG_MS = 86_400_000;
const DATO = /^(\d{4})-(\d{2})-(\d{2})$/;

const MAANED = {
  da: ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
// getUTCDay(): 0 = søndag
const UGEDAG = {
  da: ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const sprogAf = (s) => (s === 'en' ? 'en' : 'da');
const pad = (n) => String(n).padStart(2, '0');

// ---------- tidsstempler → dansk tid ----------
let _fmt = null;
const fmt = () => (_fmt ??= new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}));
function tilMs(ts) {
  const ms = ts instanceof Date ? ts.getTime() : typeof ts === 'number' ? ts : Date.parse(String(ts ?? ''));
  if (!Number.isFinite(ms)) throw new TypeError(`ikke et tidspunkt: ${ts}`);
  return ms;
}
// Vægur-tiden i København for et øjeblik: {year, month, day, hour, minute, second} som tal
function vaegur(ms) {
  const p = {};
  for (const { type, value } of fmt().formatToParts(new Date(ms))) if (type !== 'literal') p[type] = Number(value);
  if (p.hour === 24) p.hour = 0;   // ældre motorer skriver midnat som 24 trods h23
  return p;
}
// Københavns forskydning fra UTC (ms) i et givet øjeblik: +1 t om vinteren, +2 t om sommeren
function forskydning(ms) {
  const s = Math.floor(ms / 1000) * 1000;
  const p = vaegur(s);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - s;
}

/** Tidsstempel (ISO, Date, ms) → dansk kalenderdato 'YYYY-MM-DD'. En ren dato 'YYYY-MM-DD' gives uændret tilbage. */
export function kbhDato(ts) {
  if (typeof ts === 'string' && DATO.test(ts)) return gyldig(ts);
  const p = vaegur(tilMs(ts));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Dansk dato + klokkeslæt (dansk tid) → ISO-tidsstempel i UTC ('…Z'). Fx ('2026-11-09', 23, 59, 59) → '2026-11-09T22:59:59.000Z'. */
export function kbhTilIso(dato, time = 0, minut = 0, sekund = 0) {
  const [y, m, d] = dele(dato);
  const lokal = Date.UTC(y, m - 1, d, time, minut, sekund);
  let ms = lokal - forskydning(lokal);
  ms = lokal - forskydning(ms);           // anden runde: rammer rigtigt på dage med skift mellem sommer- og vintertid
  return new Date(ms).toISOString();
}

// ---------- kalenderdatoer ----------
function dele(dato) {
  const m = DATO.exec(String(dato ?? ''));
  if (!m) throw new TypeError(`ikke en dato (YYYY-MM-DD): ${dato}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
const utcMs = (dato) => { const [y, m, d] = dele(dato); return Date.UTC(y, m - 1, d); };
const fraUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
function gyldig(dato) {
  if (fraUtc(utcMs(dato)) !== dato) throw new TypeError(`ugyldig dato: ${dato}`);
  return dato;
}
/** dato + n dage → 'YYYY-MM-DD' (kalenderdage, uden sommertid). */
export const plusDage = (dato, n) => fraUtc(utcMs(kbhDato(dato)) + n * DAG_MS);
/** Ugedag: 0 = søndag … 6 = lørdag. */
export const ugedag = (dato) => new Date(utcMs(kbhDato(dato))).getUTCDay();

// ---------- ISO-uger (mandag–søndag; uge 1 er ugen med årets første torsdag) ----------
/** Dato → ISO-uge {aar, uge}. aar er ugens år, som kan afvige fra datoens: 1. januar 2027 ligger i 2026, uge 53. */
export function isoUge(dato) {
  const ms = utcMs(kbhDato(dato));
  const fraMandag = (new Date(ms).getUTCDay() + 6) % 7;
  const torsdag = ms + (3 - fraMandag) * DAG_MS;
  const aar = new Date(torsdag).getUTCFullYear();
  return { aar, uge: 1 + Math.floor((torsdag - Date.UTC(aar, 0, 1)) / (7 * DAG_MS)) };
}
/** Antal ISO-uger i året: 52 eller 53 (28. december ligger altid i årets sidste uge). 2026 har 53. */
export const ugerIAar = (aar) => isoUge(`${aar}-12-28`).uge;

/** ISO-uge → {mandag, fredag} som 'YYYY-MM-DD'. Vi leverer på hverdage, så ugen skrives mandag–fredag (Fable e). */
export function ugeDatoer(aar, uge) {
  if (!Number.isInteger(aar) || aar < 1970 || aar > 9999) throw new RangeError(`ugyldigt år: ${aar}`);
  if (!Number.isInteger(uge) || uge < 1 || uge > ugerIAar(aar)) throw new RangeError(`${aar} har ikke uge ${uge}`);
  const jan4 = Date.UTC(aar, 0, 4);
  const mandag = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAG_MS + (uge - 1) * 7 * DAG_MS;
  return { mandag: fraUtc(mandag), fredag: fraUtc(mandag + 4 * DAG_MS) };
}

/**
 * Den ene form for uger alle steder — side, statuskolonne, mail og emne (Fable e, R20):
 * 'uge 51 (14.–18. december 2026)' · 'uge 49 (30. november–4. december 2026)' · 'uge 53 (28. december 2026–1. januar 2027)'.
 * Engelsk (kun Min side): 'week 51 (14–18 December 2026)'.
 */
export function ugeTekst(aar, uge, sprog = 'da') {
  const { mandag, fredag } = ugeDatoer(aar, uge);
  const [y1, m1, d1] = dele(mandag), [y2, m2, d2] = dele(fredag);
  if (sprogAf(sprog) === 'en') {
    const M = MAANED.en;
    const fra = y1 !== y2 ? `${d1} ${M[m1 - 1]} ${y1}` : m1 !== m2 ? `${d1} ${M[m1 - 1]}` : `${d1}`;
    return `week ${uge} (${fra}–${d2} ${M[m2 - 1]} ${y2})`;
  }
  const M = MAANED.da;
  const fra = y1 !== y2 ? `${d1}. ${M[m1 - 1]} ${y1}` : m1 !== m2 ? `${d1}. ${M[m1 - 1]}` : `${d1}.`;
  return `uge ${uge} (${fra}–${d2}. ${M[m2 - 1]} ${y2})`;
}

function aarTil(dato, iDag) {
  if (iDag == null) throw new TypeError('iDag mangler (årstallet skrives kun, når dagen ligger i et andet år end i dag)');
  const y = dele(dato)[0];
  return y !== dele(kbhDato(iDag))[0] ? ` ${y}` : '';
}
/** En dag: 'tirsdag 15. december' (+ ' 2027', når året ≠ iDags år). Engelsk: 'Tuesday 15 December'. */
export function dagTekst(dato, iDag, sprog = 'da') {
  const d = kbhDato(dato);
  const [, m, dd] = dele(d);
  const w = new Date(utcMs(d)).getUTCDay();
  return sprogAf(sprog) === 'en'
    ? `${UGEDAG.en[w]} ${dd} ${MAANED.en[m - 1]}${aarTil(d, iDag)}`
    : `${UGEDAG.da[w]} ${dd}. ${MAANED.da[m - 1]}${aarTil(d, iDag)}`;
}
/** Dato med år: '10. november 2026'. Engelsk: '10 November 2026'. */
export function datoTekst(dato, sprog = 'da') {
  const [y, m, d] = dele(kbhDato(dato));
  return sprogAf(sprog) === 'en' ? `${d} ${MAANED.en[m - 1]} ${y}` : `${d}. ${MAANED.da[m - 1]} ${y}`;
}
/**
 * Dato uden ugedag og (i år) uden år: '2. december' (+ ' 2027', når året ≠ iDags år). Bruges, hvor Fable e skriver datoen
 * sådan: "Ændret 2. december fra uge 51", "Vi har tilbageført … den 10. november". Tilføjet ud over kontrakter §7.
 */
export function kortDatoTekst(dato, iDag, sprog = 'da') {
  const d = kbhDato(dato);
  const [, m, dd] = dele(d);
  return sprogAf(sprog) === 'en' ? `${dd} ${MAANED.en[m - 1]}${aarTil(d, iDag)}` : `${dd}. ${MAANED.da[m - 1]}${aarTil(d, iDag)}`;
}

// ---------- helligdage (samme liste som tabellen helligdage_2026_11_12, der er seedet fra denne funktion) ----------
/** Påskedag (gregoriansk, Meeus/Jones/Butcher). 2026 → '2026-04-05', 2027 → '2027-03-28'. */
export function paaskedag(aar) {
  const a = aar % 19, b = Math.floor(aar / 100), c = aar % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maaned = Math.floor((h + l - 7 * m + 114) / 31), dag = ((h + l - 7 * m + 114) % 31) + 1;
  return `${aar}-${pad(maaned)}-${pad(dag)}`;
}
/**
 * Årets danske helligdage + grundlovsdag, juleaftensdag og nytårsaftensdag (forbrugeraftalelovens § 19, stk. 3).
 * Store bededag findes ikke længere (afskaffet fra 2024). → [{dato, navn}] sorteret efter dato.
 */
export function helligdageAar(aar) {
  const p = paaskedag(aar);
  return [
    [`${aar}-01-01`, 'Nytårsdag'],
    [plusDage(p, -3), 'Skærtorsdag'],
    [plusDage(p, -2), 'Langfredag'],
    [p, 'Påskedag'],
    [plusDage(p, 1), '2. påskedag'],
    [plusDage(p, 39), 'Kristi himmelfartsdag'],
    [plusDage(p, 49), 'Pinsedag'],
    [plusDage(p, 50), '2. pinsedag'],
    [`${aar}-06-05`, 'Grundlovsdag'],
    [`${aar}-12-24`, 'Juleaftensdag'],
    [`${aar}-12-25`, 'Juledag'],
    [`${aar}-12-26`, '2. juledag'],
    [`${aar}-12-31`, 'Nytårsaftensdag'],
  ].reduce((liste, [dato, navn]) => {   // samme dato to gange (2028: 2. pinsedag = grundlovsdag) → én række, begge navne
    const f = liste.find((h) => h.dato === dato);
    if (f) f.navn += ` og ${navn.toLowerCase()}`; else liste.push({ dato, navn });
    return liste;
  }, []).sort((x, y) => (x.dato < y.dato ? -1 : x.dato > y.dato ? 1 : 0));
}
/** Helligdagene for fraAar…tilAar som Set af 'YYYY-MM-DD'. */
export function helligdageSet(fraAar, tilAar = fraAar) {
  const s = new Set();
  for (let a = fraAar; a <= tilAar; a++) for (const h of helligdageAar(a)) s.add(h.dato);
  return s;
}
const _aar = new Map();
function erHelligdag(dato, helligdage) {
  if (helligdage != null) {
    if (typeof helligdage.has === 'function') return helligdage.has(dato);
    if (Array.isArray(helligdage)) return helligdage.includes(dato);
    throw new TypeError('helligdage skal være et Set eller en liste af datoer');
  }
  const y = dele(dato)[0];
  if (!_aar.has(y)) _aar.set(y, helligdageSet(y));
  return _aar.get(y).has(dato);
}

/** Hverdag = ikke lørdag, ikke søndag, ikke i helligdage. Uden helligdage bruges helligdageAar (samme liste som tabellen). */
export function erHverdag(dato, helligdage) {
  const d = kbhDato(dato);
  const w = new Date(utcMs(d)).getUTCDay();
  return w !== 0 && w !== 6 && !erHelligdag(d, helligdage);
}
/** Første hverdag EFTER dato (aldrig dato selv). */
export function naesteHverdag(dato, helligdage) {
  let d = plusDage(dato, 1);
  for (let i = 0; i < 30 && !erHverdag(d, helligdage); i++) d = plusDage(d, 1);
  return d;
}

/**
 * Fristen for at bekræfte leveringsugen: 23:59:59 dansk tid på første hverdag EFTER betalingsdagen (dansk dato).
 * Regnes ÉN gang ved betalt og gemmes i uge_frist_at (R20; SQL: fn_webordre_frist). → ISO i UTC.
 */
export function ugeFrist(betaltAtIso, helligdage) {
  return kbhTilIso(naesteHverdag(kbhDato(betaltAtIso), helligdage), 23, 59, 59);
}
/**
 * Fortrydelsesfristen: leveret + 14 dage; falder dagen på lørdag, søndag eller en helligdag (inkl. 5/6, 24/12, 31/12),
 * løber fristen til næste hverdag (Fable e regel 9; SQL: fn_fortryd_frist). → 'YYYY-MM-DD'.
 */
export function fortrydFrist(leveretDato, helligdage) {
  const d = plusDage(kbhDato(leveretDato), 14);
  return erHverdag(d, helligdage) ? d : naesteHverdag(d, helligdage);
}
/** Ugen efter iDags uge → {aar, uge} (forudfyldning af "Bekræft uge" i /webordrer). */
export const naesteUge = (iDag) => isoUge(plusDage(kbhDato(iDag), 7));
/** Klokkeslæt 'HH:MM' → '8' (hel time) eller '8.30' (dansk form). Siden, mailen og /webordrer skriver det ens. */
export function klTekst(s) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(s ?? ''));
  if (!m) throw new Error(`klokkeslæt ${s}`);
  const t = String(Number(m[1]));
  return m[2] === '00' ? t : `${t}.${m[2]}`;
}
