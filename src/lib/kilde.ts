// Hvor kom besøgeren fra? Kun hostname, side og utm_* — ingen persondata.
// Sitet gemmer BEVIDST intet på besøgerens enhed (ingen cookie, ingen sessionStorage/localStorage → intet
// samtykke-banner; samme beslutning som i CallbackForm). Browseren kalder derfor foersteBesoeg() UDEN lager:
// kilden er den eksterne side, der sendte besøgeren til den side, formularen står på. Kom de via en intern
// side, er den tom, og "Hvor fandt I os?" (KILDE_SVAR) er reserven. Lager-parameteren findes kun til test.
// Ingen Astro-imports: testes med node --test.

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

// Browser: kilden for den side, formularen står på (læses ved afsendelse). Intet gemmes.
export function hentKilde(): Attribution {
  return foersteBesoeg({ referrer: document.referrer, href: location.href, host: location.hostname });
}

// Browser: kaldes én gang pr. side fra Base.astro — giver mailto-links et emne med sidens navn.
export function startKilde(): void {
  const navn = (document.querySelector('h1')?.textContent || document.title).replace(/\s+/g, ' ').trim().slice(0, 60);
  document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]').forEach((el) => {
    el.setAttribute('href', mailtoMedEmne(el.getAttribute('href') || '', navn));
  });
}
