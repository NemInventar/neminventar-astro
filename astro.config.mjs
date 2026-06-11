// @ts-check
import { defineConfig, envField } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// site + base sættes via env i CI (GitHub Pages projekt-side vs. custom domain).
// Lokalt: base '/', site neminventar.dk.
export default defineConfig({
  site: process.env.SITE_URL || 'https://neminventar.dk',
  base: process.env.BASE_PATH || '/',

  integrations: [react(), sitemap()],

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
