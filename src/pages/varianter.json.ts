// /varianter.json — alle typer og deres varianter, som sitet viser dem (samme regler som typesiderne: lib/varianter).
// Læses af oversigten i ni-apps (/web-varianter), så den aldrig har sin egen kopi af paletterne. Genereres ved build.
import type { APIRoute } from 'astro';
import { getWebProducts, getWebColors } from '../lib/supabase';
import { varianterAf, MATERIALEFARVER, SPOR, sporAf } from '../lib/varianter';
import { designerLink } from '../lib/forside';
import { FAM, famOf } from '../lib/catalog';

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const abs = (p: string) => new URL(base + p, site).href;
  const [products, colors] = await Promise.all([getWebProducts(), getWebColors()]);
  const olie = [...colors].sort((a, b) => a.sort_order - b.sort_order).map((c) => ({ kuloer: c.slug, label: c.label, hex: c.swatch_hex }));
  const paletter: Record<string, { kuloer: string; label: string; hex: string | null }[]> = { olie, hpl: [], kompakt: [], stof: [] };
  for (const [k, label] of Object.entries(MATERIALEFARVER)) paletter[sporAf(k)].push({ kuloer: k, label, hex: null });
  const typer = products.map((p) => {
    const v = varianterAf(p, colors);
    return {
      slug: p.slug, navn: p.name, familie: FAM[famOf(p)], url: abs(`produkter/${p.slug}`),
      spor: v[0] ? sporAf(v[0].kuloer) : null,
      designer: designerLink(p.slug), billeder_uden_kuloer: (p.images_meta ?? []).filter((m) => !m.color).length,
      varianter: v.map((x) => ({ kuloer: x.kuloer, label: x.label, img: x.img, url: abs(`produkter/${p.slug}#${x.id}`), ifc: designerLink(p.slug, x.kuloer, 'ifc') })),
    };
  });
  return new Response(JSON.stringify({ genereret: new Date().toISOString(), spor: SPOR, paletter, typer }, null, 1), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
