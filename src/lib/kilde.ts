// Hvor kom besøgeren fra? Fanges ved FØRSTE sidevisning i besøget, fordi referreren ved afsendelse af en
// formular er vores egen side. Kun hostname, landingsside og utm_* — ingen persondata, ingen cookie.
// Gemmes i sessionStorage (slettes, når fanen lukkes) og sendes kun med, hvis besøgeren selv skriver til os.
// Uden storage (privat vindue, blokeret) bruges blot den aktuelle side. Ingen Astro-imports: testes med node --test.

export const KILDE_SVAR = ['Google', 'ChatGPT eller anden AI', 'Anbefaling', 'LinkedIn', 'Vi har arbejdet sammen før', 'Andet'] as const;

export type Attribution = { referrer_host: string; landingsside: string; utm: Record<string, string> };
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const KEY = 'ni_foerste_besoeg';

export function foersteBesoeg(loc: { referrer: string; href: string; host: string }, store?: Store): Attribution {
  try {
    const s = store?.getItem(KEY);
    if (s) return JSON.parse(s) as Attribution;
  } catch { /* blokeret storage */ }
  let referrer_host = '';
  try {
    const h = loc.referrer ? new URL(loc.referrer).hostname : '';
    if (h && h !== loc.host) referrer_host = h;
  } catch { /* ugyldig referrer */ }
  const u = new URL(loc.href);
  const utm: Record<string, string> = {};
  u.searchParams.forEach((v, k) => { if (k.startsWith('utm_')) utm[k] = v.slice(0, 100); });
  const a: Attribution = { referrer_host, landingsside: u.pathname.slice(0, 200), utm };
  try { store?.setItem(KEY, JSON.stringify(a)); } catch { /* blokeret storage */ }
  return a;
}

// "Forespørgsel fra neminventar.dk – <side>" på mailto-links, så en mail sendt direkte også viser siden.
// Et link, der allerede har et emne, røres ikke.
export function mailtoMedEmne(href: string, sidenavn: string): string {
  if (!href.startsWith('mailto:') || /[?&]subject=/i.test(href)) return href;
  const emne = `Forespørgsel fra neminventar.dk – ${sidenavn}`.slice(0, 120);
  return href + (href.includes('?') ? '&' : '?') + 'subject=' + encodeURIComponent(emne);
}

function sessionLager(): Store | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}

// Browser: besøgets første side (læses af formularerne ved afsendelse)
export function hentKilde(): Attribution {
  return foersteBesoeg({ referrer: document.referrer, href: location.href, host: location.hostname }, sessionLager());
}

// Browser: kaldes én gang pr. side fra Base.astro
export function startKilde(): void {
  hentKilde();
  const navn = (document.querySelector('h1')?.textContent || document.title).replace(/\s+/g, ' ').trim().slice(0, 60);
  document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]').forEach((el) => {
    el.setAttribute('href', mailtoMedEmne(el.getAttribute('href') || '', navn));
  });
}
