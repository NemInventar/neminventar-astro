// Adresser og sporing på konto.neminventar.dk. Rene funktioner (node:test kører dem).
//
// sikkerRetur — R21 (plan-teknik-v3 §4, review nr. 46): efter log ind sendes kunden kun tilbage til en sti på
//   konto-værten eller designer-værten. Alt andet (fremmede domæner, //evil, javascript:, bruger:kode@, backslash,
//   kontroltegn) giver null, og hun lander på Min side. Fragmentet fjernes altid (det kan bære en statusnøgle, R10).
// sidevisning — R10: Plausible kaldes manuelt med origin + pathname (aldrig fragment, aldrig query), ingen referrer,
//   og først når siden har fjernet nøglen fra adressen. Via vores egen proxy api.neminventar.dk (src/lib/api.ts).
export const DESIGNER_ORIGIN = 'https://designer.neminventar.dk';
export const PLAUSIBLE_EVENT = 'https://api.neminventar.dk/api/event';
export const PLAUSIBLE_DOMAENE = 'neminventar.dk';

export function sikkerRetur(x, kontoOrigin, designerOrigin = DESIGNER_ORIGIN) {
  if (typeof x !== 'string' || !x || x.length > 2000) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(x)) return null;
  let u;
  try {
    u = new URL(x, `${kontoOrigin}/`);
  } catch {
    return null;
  }
  if (u.username || u.password) return null;
  if (u.origin === kontoOrigin) return u.pathname + u.search;
  if (u.origin === designerOrigin && u.protocol === 'https:') {
    u.hash = '';
    return u.href;
  }
  return null;
}

// Log ind-siden med retur-adresse (og evt. "du er blevet logget ud", Fable c1 login.udloebet)
export function loginAdresse(retur, { sprog = 'da', udloebet = false } = {}) {
  const q = new URLSearchParams();
  if (retur) q.set('retur', retur);
  if (udloebet) q.set('udloebet', '1');
  const s = q.toString();
  return `${sprog === 'en' ? '/en/' : '/'}${s ? `?${s}` : ''}`;
}

export const minSideAdresse = (sprog = 'da') => (sprog === 'en' ? '/en/min-side/' : '/min-side/');

// Plausibles event-API: kun sidens origin + sti. domaene = sitet i Plausible-kontoen.
export function sidevisningData(location, domaene = PLAUSIBLE_DOMAENE) {
  return { name: 'pageview', url: `${location.origin}${location.pathname}`, domain: domaene, referrer: null };
}

export function sidevisning(location, fetcher, domaene = PLAUSIBLE_DOMAENE) {
  try {
    const p = fetcher(PLAUSIBLE_EVENT, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(sidevisningData(location, domaene)),
    });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // statistikken må aldrig vælte siden
  }
}

// "Åbn i designeren" (Fable c4): designet + den gemte pris og dato som to ekstra parametre, så designeren kan vise
// forskellen uden at spørge konto-værten. Kopiér link = kun designet (alle med linket kan åbne det).
export function designerLink(designerUrl, { produkt, t, permalink, prisOere, dato, sprog = 'da', medGemt = true }) {
  let u;
  try {
    u = permalink ? new URL(permalink) : new URL(designerUrl);
  } catch {
    return null;
  }
  if (u.origin !== DESIGNER_ORIGIN && !(designerUrl && u.origin === new URL(designerUrl).origin)) return null;
  if (!permalink) {
    if (!produkt || !t) return null;
    u.searchParams.set('p', produkt);
    u.searchParams.set('t', t);
  }
  if (sprog === 'en') u.searchParams.set('lang', 'en');
  if (medGemt) {
    if (Number.isSafeInteger(prisOere)) u.searchParams.set('gemt_pris', String(prisOere));
    if (typeof dato === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dato)) u.searchParams.set('gemt_dato', dato);
  }
  u.hash = '';
  return u.href;
}
