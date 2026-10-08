// @ts-check
import { defineConfig, envField } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import lokaleBilleder from './src/integrations/lokale-billeder.mjs';
import skraastreg from './src/integrations/skraastreg.mjs';

// site + base sættes via env i CI (GitHub Pages projekt-side vs. custom domain).
// Lokalt: base '/', site neminventar.dk.
export default defineConfig({
  site: process.env.SITE_URL || 'https://neminventar.dk',
  base: process.env.BASE_PATH || '/',

  // lokaleBilleder: Supabase-billederne hentes ned i dist/_b efter build, så alt kundevendt kommer fra neminventar.dk
  // (firmafiltre vurderer hvert domæne for sig). Se src/integrations/lokale-billeder.mjs.
  // skraastreg: interne links får afsluttende skråstreg, så GitHub Pages ikke skal omdirigere (Search Console 08-10-2026).
  integrations: [react(), sitemap(), lokaleBilleder(), skraastreg()],

  // Typer, der er taget af sitet (Joachim 06-10-2026: ikke noget vi laver), peger videre til det nærmeste.
  redirects: {
    '/produkter/vaegbeklaedning-vertikale-traelister': '/produkter/vaegbeklaedning-krydsfiner/',
    '/produkter/skydedoer-massiv-krydsfiner': '/inventar/',
    // Joachim 07-10-2026: "det er bare lockers" — typen hedder nu Lockers i krydsfiner
    '/produkter/skohylde-med-locker': '/produkter/lockers-krydsfiner/',
  },

  // Build-time secrets. SUPABASE_ANON_KEY er KRÆVET (ingen default => ligger aldrig i koden).
  // Hentes fra .env lokalt (gitignored) og fra GitHub Actions secret i CI.
  env: {
    schema: {
      SUPABASE_URL: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        default: 'https://guhbrpektblabndqttgp.supabase.co',
      }),
      SUPABASE_ANON_KEY: envField.string({ context: 'server', access: 'secret' }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
