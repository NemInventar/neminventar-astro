// Fælles for siderne på konto.neminventar.dk (browser). Ingen inline-script: alt kommer som moduler fra /_astro/.
// Opsætningen står som data-attributter på <body> (KontoLayout.astro), sat ved build.
import { sidevisning } from '../lib/adresser.mjs';

const d = document.body.dataset;
export const cfg = Object.freeze({
  udgivelse: Number(d.udgivelse) === 2 ? 2 : 1,
  sprog: d.sprog === 'en' ? 'en' : 'da',
  designerUrl: d.designer || 'https://designer.neminventar.dk/designer.html',
  turnstile: d.turnstile || '',
  plausible: d.plausible || 'neminventar.dk',
});

// sessionStorage: kun bekvemmeligheder i denne fane (kan mangle i privat vindue)
export const lager = {
  hent(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  gem(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ingen lager */ } },
  slet(k) { try { sessionStorage.removeItem(k); } catch { /* ingen lager */ } },
};
export const SESSION = 'ni-konto-session';   // hun har været logget ind i denne fane (→ login.udloebet ved 401)
export const BESKED = 'ni-konto-besked';     // en bekræftelse til log ind-siden (logget ud, slettet)

// Konto-API'et (kontrakter §6): samme origin, JSON, aldrig cache. → {status, data}; netværksfejl = status 0.
export async function api(sti, body) {
  const init = { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${sti}`, init);
  } catch {
    return { status: 0, data: { fejl: 'netvaerk' } };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!data || typeof data !== 'object') data = { fejl: res.status === 503 ? 'nede' : 'svar' };
  return { status: res.status, data };
}

// R10: Plausible med origin + pathname — kaldes først, når siden har ryddet adressen
export const spor = () => sidevisning(location, (u, i) => fetch(u, i), cfg.plausible);

export function vis(rod, html) {
  rod.innerHTML = html;
  rod.removeAttribute('aria-busy');
}

// Fable c1 (36) nr. 4: fokus flytter til det, der åbnes
export function fokusVedFoldUd(rod) {
  rod.addEventListener('toggle', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLDetailsElement) || !el.open) return;
    const maal = el.querySelector(':scope > :not(summary) :is(button:not([disabled]), a[href], input)');
    if (maal) maal.focus();
  }, true);
}
