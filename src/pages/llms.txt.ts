// /llms.txt — kort, maskinlæsbar oversigt til AI-assistenter (ChatGPT, Claude, Perplexity …).
// Genereres ved build fra de samme views som sitet, så den aldrig driver fra indholdet.
import type { APIRoute } from 'astro';
import { getWebLandingPages, getWebCases, getWebProducts } from '../lib/supabase';
import { guidesFor, guidePath } from '../lib/guides-i18n';

// Designerens egen llms.txt (ni-apps scripts/designer/llms.mjs, Joachim 27-10-2026): hvordan en AI-assistent skriver et
// læsbart link til kundens eget skab (?p=hoejskab&antal=3&bredde=80&materiale=eg). Teksten bygges af designerens kontrakt
// og hentes her ved build, så der kun findes én udgave. Kan den ikke hentes, står kun linket i "Til private".
const DESIGNER_LLMS = 'https://designer.neminventar.dk/llms.txt';
async function designerSektioner(): Promise<string[]> {
  try {
    const r = await fetch(DESIGNER_LLMS, { signal: AbortSignal.timeout(10000) });
    const t = r.ok ? await r.text() : '';
    const i = t.indexOf('\n## ');
    return t.startsWith('# Nem Inventars designer') && i > 0 ? [...t.slice(i + 1).trimEnd().split('\n'), ''] : [];
  } catch {
    return [];
  }
}

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const abs = (p: string) => new URL(base + p, site).href;
  const [pages, cases, products, designer] = await Promise.all([getWebLandingPages(), getWebCases(), getWebProducts(), designerSektioner()]);
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
    `- [Link til kundens eget skab](${DESIGNER_LLMS}): Et link kan bære et helt design, fx https://designer.neminventar.dk/designer?p=hoejskab&antal=3&bredde=80&hoejde=240&materiale=eg. Så åbner designeren med netop det skab tegnet og prisen regnet. Navnene og værdierne står i designerens llms.txt.`,
    '',
    ...designer,
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
    '## Guides in English',
    ...guidesFor('en', pages).map((g) => `- [${g.h1}](${abs(guidePath('en', g.slug))}): ${g.lead ?? g.seo_description}`),
    '',
    '## Deutsch',
    `- [Spind mit Sitzbank für Schulen](${abs('de/')}): Spinde mit Sitzbank und Schuhregal aus Sperrholz nach Maß für Schulen, Sporthallen und Schwimmbäder. Lieferung aus Dänemark, Montage in Deutschland derzeit nicht im Angebot.`,
    ...guidesFor('de', pages).map((g) => `- [${g.h1}](${abs(guidePath('de', g.slug))}): ${g.lead ?? g.seo_description}`),
    '',
    '## Kontakt',
    `- [Kontakt](${abs('kontakt')}): Send tegninger, snedkerbeskrivelse eller tilbudsliste til tilbud@neminventar.dk.`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
