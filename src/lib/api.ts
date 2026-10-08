// Eget API-domæne: api.neminventar.dk er en lille proxy (api/public/_worker.js, Cloudflare Pages-projektet
// neminventar-api) foran formularen (Supabase) og Plausible. Firmanetværkenes webfiltre vurderer hvert domæne for sig,
// og supabase.co/plausible.io blokeres ofte; med proxyen rammer besøgeren kun *.neminventar.dk.
//
// API_AKTIV = false: sitet opfører sig præcis som før (supabase.co og plausible.io direkte).
// Sæt den til true, når CNAME api → neminventar-api.pages.dev ligger i M365 DNS, og domænet står som active
// (gh workflow run api-domaene.yml). Formularen falder tilbage til supabase.co ved netværksfejl, Plausible til plausible.io.
export const API_AKTIV = true;
export const API_BASE = 'https://api.neminventar.dk';

const SUPABASE = 'https://guhbrpektblabndqttgp.supabase.co';
export const FORMULAR_DIREKTE = `${SUPABASE}/functions/v1/contact-form`;
export const PLAUSIBLE_SCRIPT = 'https://plausible.io/js/pa-HNaluSTt8ee5v0U7h3J8z.js';
const UPLOAD = '/storage/v1/object/upload/sign/';

export type Via = 'api' | 'direkte';

/**
 * Kald til contact-form. Med flaget går kaldet via proxyen. Kaster fetch en TypeError (DNS, blokeret, netværk),
 * prøves supabase.co én gang. Et HTTP-svar (også 4xx/5xx) prøves aldrig igen, så intet sendes to gange.
 */
export async function formularFetch(
  init: RequestInit,
  aktiv: boolean = API_AKTIV,
  f: typeof fetch = (u, o) => fetch(u, o),
): Promise<{ res: Response; via: Via }> {
  if (!aktiv) return { res: await f(FORMULAR_DIREKTE, init), via: 'direkte' };
  try {
    return { res: await f(`${API_BASE}/contact-form`, init), via: 'api' };
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    return { res: await f(FORMULAR_DIREKTE, init), via: 'direkte' };
  }
}

/** Funktionens signerede upload-adresse peger på supabase.co. Gik kaldet via proxyen, går filen samme vej. */
export function uploadAdresse(url: string, via: Via): string {
  if (via !== 'api') return url;
  try {
    const u = new URL(url);
    if (u.origin !== SUPABASE || !u.pathname.startsWith(UPLOAD)) return url;
    return API_BASE + u.pathname + u.search;
  } catch {
    return url;
  }
}

/**
 * Plausible via proxyen (kun når API_AKTIV). Lægges FØR sitets eget Plausible-snippet, som derefter er uændret:
 * dets `plausible.init()` beholder endpointet her. Kan scriptet ikke hentes fra proxyen, hentes det fra plausible.io,
 * og events sendes også dertil.
 */
export function plausibleViaApi(api: string = API_BASE): string {
  const A = JSON.stringify(api);
  const P = JSON.stringify(PLAUSIBLE_SCRIPT);
  return `(function () {
  var ep = ${A} + "/api/event";
  var p = window.plausible = window.plausible || function () { (p.q = p.q || []).push(arguments); };
  p.init = function (i) { p.o = Object.assign({}, p.o, i, { endpoint: ep }); };
  p.init();
  var s = document.createElement("script");
  s.async = true;
  s.src = ${A} + "/js/script.js";
  s.onerror = function () {
    ep = "https://plausible.io/api/event";
    if (window.plausible && window.plausible.o) window.plausible.o.endpoint = ep;
    var f = document.createElement("script");
    f.async = true;
    f.src = ${P};
    document.head.appendChild(f);
  };
  document.head.appendChild(s);
})();`;
}
