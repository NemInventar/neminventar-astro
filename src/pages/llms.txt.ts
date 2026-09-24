// /llms.txt — kort, maskinlæsbar oversigt til AI-assistenter (ChatGPT, Claude, Perplexity …).
// Genereres ved build fra de samme views som sitet, så den aldrig driver fra indholdet.
import type { APIRoute } from 'astro';
import { getWebLandingPages, getWebCases, getWebProducts } from '../lib/supabase';

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const abs = (p: string) => new URL(base + p, site).href;
  const [pages, cases, products] = await Promise.all([getWebLandingPages(), getWebCases(), getWebProducts()]);
  const emner = pages.filter((p) => p.kind === 'emne');
  const segmenter = pages.filter((p) => p.kind === 'segment');

  const lines = [
    '# Nem Inventar ApS',
    '',
    '> Dansk leverandør af fast inventar til byggeri: skoler, daginstitutioner, idrætshaller og erhverv. Vi bygger til mål i krydsfiner, kompaktlaminat (HPL), møbellinoleum og massivt træ i egen produktion, og leverer som fagentreprise til hovedentreprenører og bygherrer i hele Danmark. Kontor: Mågevej 73, st. tv., 2400 København NV. CVR 45085473. Telefon +45 40 14 05 08, tilbud@neminventar.dk.',
    '',
    '## Det laver vi',
    ...emner.map((p) => `- [${p.nav_label}](${abs(p.slug)}): ${p.lead ?? p.seo_description}`),
    '',
    '## Målgrupper',
    ...segmenter.map((p) => `- [${p.nav_label}](${abs(p.slug)}): ${p.lead ?? p.seo_description}`),
    '',
    '## Projekter',
    ...cases.map((c) => `- [${c.name}](${abs('projekter/' + c.slug)}): ${c.web_summary ?? ''}`),
    '',
    '## Arketyper',
    ...products.map((p) => `- [${p.name}](${abs('produkter/' + p.slug)}): ${p.intro ?? p.short_description ?? ''}`),
    '',
    '## Kontakt',
    `- [Kontakt](${abs('kontakt')}): Send tegninger, snedkerbeskrivelse eller tilbudsliste til tilbud@neminventar.dk.`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
