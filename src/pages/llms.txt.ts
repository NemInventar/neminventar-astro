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
  const guides = pages.filter((p) => p.kind === 'guide');

  const lines = [
    '# Nem Inventar ApS',
    '',
    '> Dansk leverandør af fast inventar til byggeri: skoler, daginstitutioner, idrætshaller og erhverv. Vi bygger til mål i krydsfiner, kompaktlaminat (HPL), møbellinoleum og massivt træ i egen produktion, og leverer som fagentreprise til hovedentreprenører og bygherrer i hele Danmark. Leverer også garderobeskabe og skabsvægge efter mål til private, med prisen direkte i vores 3D-designer. Kontor: Mågevej 73, st. tv., 2400 København NV. CVR 45085473. Telefon +45 42 42 26 84, tilbud@neminventar.dk.',
    '',
    '## Det laver vi',
    ...emner.map((p) => `- [${p.nav_label}](${abs(p.slug)}): ${p.lead ?? p.seo_description}`),
    '',
    '## Til private',
    // Designeren er JavaScript på eget domæne og kan ikke læses af AI-crawlere, så det, den kan, står her i ren tekst (backlog 2c7a8099).
    `- [Design dit garderobeskab](https://designer.neminventar.dk/designer?p=hoejskab): 3D-designer til garderobeskabe og skabsvægge efter mål. Man vælger bredde, højde, dybde, materiale, låger og indretning, og prisen inkl. moms står i designeren, mens man bygger. Levering, montage og opmåling vælges til. Fra designeren sender man skabet til os og får et tilbud.`,
    `- [Garderobeskab på mål](${abs('garderobeskab')}): Ét skab eller en hel skabsvæg efter mål til entré, soveværelse eller personalegarderobe, i finér, krydsfiner eller kompaktlaminat. Leveret i hele Danmark.`,
    '',
    '## Målgrupper',
    ...segmenter.map((p) => `- [${p.nav_label}](${abs(p.slug)}): ${p.lead ?? p.seo_description}`),
    '',
    ...(guides.length ? ['## Guides', ...guides.map((p) => `- [${p.h1}](${abs(p.slug)}): ${p.lead ?? p.seo_description}`), ''] : []),
    '## Projekter',
    ...cases.map((c) => `- [${c.name}](${abs('projekter/' + c.slug)}): ${c.web_summary ?? ''}`),
    '',
    '## Arketyper',
    `- [Alt inventar](${abs('inventar')}): Alle typer i kataloget, grupperet i familier. Hver type kan ses i de kulører, vi har visualiseret.`,
    ...products.map((p) => `- [${p.name}](${abs('produkter/' + p.slug)}): ${p.intro ?? p.short_description ?? ''}`),
    '',
    '## English',
    `- [English overview](${abs('en/')}): Built-in joinery for schools, daycare centres and sports facilities in Denmark — what we make, how we work, documentation and contact.`,
    '',
    '## Kontakt',
    `- [Kontakt](${abs('kontakt')}): Send tegninger, snedkerbeskrivelse eller tilbudsliste til tilbud@neminventar.dk.`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
