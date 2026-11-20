// Turnstile-nøglen til log ind-siden (sikkerhedsgennemgangen 12-11 nr. 9). Ren funktion af byggemiljøet (node:test kører den).
//
// Uden KONTO_TURNSTILE_SITEKEY bruges Cloudflares testnøgle (består altid, usynlig) — fint på staging og i udgivelse 1, hvor
// log ind ikke findes. Men produktionen må aldrig udgive log ind med testnøglen: med KONTO_UDGIVELSE=2 og
// KONTO_KRAEV_TURNSTILE=1 (sat af .github/workflows/konto.yml på main) fejler buildet, hvis den rigtige nøgle mangler.
export const TURNSTILE_TEST = '1x00000000000000000000BB';

// env = process.env → { sitekey, test } · kaster, når produktionens krav ikke er opfyldt
export function turnstileNoegle(env = {}) {
  const sitekey = String(env.KONTO_TURNSTILE_SITEKEY ?? '').trim();
  if (sitekey) return { sitekey, test: false };
  if (env.KONTO_UDGIVELSE === '2' && env.KONTO_KRAEV_TURNSTILE === '1') {
    throw new Error('[konto] KONTO_TURNSTILE_SITEKEY mangler: udgivelse 2 i produktion (KONTO_KRAEV_TURNSTILE=1) bygges ikke med Cloudflares testnøgle');
  }
  return { sitekey: TURNSTILE_TEST, test: true };
}
