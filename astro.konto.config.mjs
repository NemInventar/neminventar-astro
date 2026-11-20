// @ts-check
// konto.neminventar.dk — kundefladen (ordresiden, log ind, Min side). Eget build ved siden af sitet: `npm run build:konto`
// → dist-konto/, som Pages-projektet ni-konto udgiver (konto/wrangler.toml). Kontrakter: docs i ni-apps
// docs/superpowers/specs/2026-11-12-min-side/ (kontrakter.md §1, plan-teknik-v3.md §2 "Kundeflade", review-samlet nr. 3).
//
// Streng CSP uden 'unsafe-inline' (konto/public/_headers). Derfor:
//   build.inlineStylesheets = 'never'  → al CSS i .css-filer, ingen <style> i HTML'en
//   vite.build.assetsInlineLimit = 0   → Astro inliner hverken scripts eller filer (fonte, ikoner) som data:/inline
// Ingen integrationer, der henter fra Supabase: konto-værten skal ikke kende ERP'et (Footer.astro's 40 landingssider er
// skiftet ud med KontoFooter). konto/test/build.test.mjs scanner dist-konto for inline <script>, <style> og style=.
//
// Udgivelsen vælges ved build (Fable runde 3 afsnit a): KONTO_UDGIVELSE=1 (standard) = kun ordresiden, intet om Min side
// eller log ind. KONTO_UDGIVELSE=2 = log ind, Min side og "Min side" i header og footer.
// KONTO_TURNSTILE_SITEKEY = Turnstile-widgettens offentlige nøgle (kun udgivelse 2). Uden den bruges Cloudflares
// testnøgle, der altid består, og buildet skriver en advarsel.
// KONTO_OUT = anden mappe end dist-konto (kun skærmbillederne, der bygger begge udgivelser).
import { defineConfig } from 'astro/config';
import { writeFileSync } from 'node:fs';

const UDGIVELSE = process.env.KONTO_UDGIVELSE === '2' ? 2 : 1;

// Udgivelse 1 har ingen log ind-side: forsiden og Min side-adresserne sender videre til neminventar.dk.
// _redirects skrives efter buildet, fordi indholdet afhænger af udgivelsen (Pages læser den fra dist-roden).
function kontoViderestilling() {
  return {
    name: 'konto-viderestilling',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const linjer = UDGIVELSE === 1
          ? [
            '/ https://neminventar.dk/ 302',
            '/en/ https://neminventar.dk/en/ 302',
            '/min-side/ https://neminventar.dk/ 302',
            '/en/min-side/ https://neminventar.dk/en/ 302',
          ]
          : [];
        writeFileSync(new URL('_redirects', dir), linjer.length ? `${linjer.join('\n')}\n` : '');
      },
    },
  };
}

export default defineConfig({
  site: 'https://konto.neminventar.dk',
  srcDir: './konto/src',
  publicDir: './konto/public',
  outDir: process.env.KONTO_OUT || './dist-konto',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'never', format: 'directory' },
  devToolbar: { enabled: false },
  integrations: [kontoViderestilling()],
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
