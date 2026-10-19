// Hvor kom besøgeren fra? Kun hostname, side, utm_* og annoncernes klik-id'er — intet om besøgeren selv.
// Sitet gemmer BEVIDST intet på besøgerens enhed (ingen cookie, ingen sessionStorage/localStorage → intet
// samtykke-banner; samme beslutning som i CallbackForm). Browseren kalder derfor foersteBesoeg() UDEN lager:
// kilden er den eksterne side, der sendte besøgeren til den side, formularen står på. Kom de via en intern
// side, er den tom, og "Hvor fandt I os?" (KILDE_SVAR) er reserven. Lager-parameteren findes kun til test.
// Annoncer (Google Ads, Meta): utm_* og klik-id'erne bæres videre til designeren (designer.neminventar.dk) i selve
// linket (medKilde), ikke på enheden — ellers er de væk, når besøgeren åbner designeren.
// Ingen Astro-imports: testes med node --test.

export const KILDE_SVAR = ['Google', 'ChatGPT eller anden AI', 'Anbefaling', 'LinkedIn', 'Vi har arbejdet sammen før', 'Andet'] as const;

export type Attribution = { referrer_host: string; landingsside: string; utm: Record<string, string> };
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const KEY = 'ni_foerste_besoeg';

// Klik-id'er fra annoncer: Google Ads (gclid, gbraid, wbraid) og Meta (fbclid). Gemmes i samme objekt som utm_*.
export const KLIK_ID = ['gclid', 'gbraid', 'wbraid', 'fbclid'] as const;
export const DESIGNER_HOST = 'designer.neminventar.dk';

// utm_* og klik-id'er fra en query-streng: utm-værdier skæres til 100 tegn, klik-id'er til 200 (et afkortet gclid kan
// ikke bruges, hvis vi senere melder et salg tilbage til Google). Ét sted, så formularen (foersteBesoeg) og linket til
// designeren (medKilde) samler det samme.
export function kildeParametre(params: URLSearchParams): Record<string, string> {
  const ud: Record<string, string> = {};
  params.forEach((v, k) => {
    if (k.startsWith('utm_')) ud[k] = v.slice(0, 100);
    else if ((KLIK_ID as readonly string[]).includes(k)) ud[k] = v.slice(0, 200);
  });
  return ud;
}

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
  const utm = kildeParametre(u.searchParams);
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

// Lægger sidens utm_* og klik-id'er (search = location.search) på et link til designeren, så annoncen følger med over på
// det andet domæne. Parametre, linket allerede har, røres ikke, og alle andre links (andre domæner, mailto:, relative,
// http) returneres uændret. Parametrene sættes bag på, før et eventuelt #-anker, så resten af linket (fx ?t=) er uberørt.
export function medKilde(href: string, search: string): string {
  let u: URL;
  try { u = new URL(href); } catch { return href; } // relativt eller ugyldigt link
  if (u.protocol !== 'https:' || u.host !== DESIGNER_HOST) return href; // host = med port: kun standardporten
  const nye = Object.entries(kildeParametre(new URLSearchParams(search))).filter(([k]) => !u.searchParams.has(k));
  if (!nye.length) return href;
  const anker = href.indexOf('#');
  const foer = anker === -1 ? href : href.slice(0, anker);
  const efter = anker === -1 ? '' : href.slice(anker);
  const sep = foer.includes('?') ? (/[?&]$/.test(foer) ? '' : '&') : '?';
  return foer + sep + nye.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') + efter;
}

// Browser: kilden for den side, formularen står på (læses ved afsendelse). Intet gemmes.
export function hentKilde(): Attribution {
  return foersteBesoeg({ referrer: document.referrer, href: location.href, host: location.hostname });
}

// Browser: retter href på et link til designeren i klik-øjeblikket. Det skal ske her og ikke ved indlæsning, fordi
// linkene skifter undervejs ([slug].astro skifter hovedknappens href, når man skifter billede, og HeroPaths sætter
// designerens permalink). Browseren læser href, når klikket er færdigbehandlet, så rettelsen når med.
function rettDesignerLink(e: Event): void {
  if (!location.search) return;
  const a = (e.target as Element | null)?.closest?.('a[href]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  const ny = medKilde(href, location.search);
  if (ny !== href) a.setAttribute('href', ny);
}

// Browser: kaldes én gang pr. side fra Base.astro — giver mailto-links et emne med sidens navn og lader linkene til
// designeren tage annoncens utm_* og klik-id'er med (capture-fasen: før andre lyttere og før navigationen).
// Almindeligt klik (også ctrl/cmd-klik og Enter) og midterklik (auxclick).
export function startKilde(): void {
  const navn = (document.querySelector('h1')?.textContent || document.title).replace(/\s+/g, ' ').trim().slice(0, 60);
  document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]').forEach((el) => {
    el.setAttribute('href', mailtoMedEmne(el.getAttribute('href') || '', navn));
  });
  document.addEventListener('click', rettDesignerLink, true);
  document.addEventListener('auxclick', rettDesignerLink, true);
}
