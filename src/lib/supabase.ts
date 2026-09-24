import { createClient } from '@supabase/supabase-js';
// astro:env/server => læses ved BUILD (Node), valider.
// SUPABASE_ANON_KEY er en server-secret: havner aldrig i klient-bundtet og aldrig i koden.
// Kommer fra .env lokalt (gitignored) og fra GitHub Actions secret i CI.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from 'astro:env/server';

// Vi læser KUN de kuraterede read-only views (v_web_products / v_web_cases) — aldrig rå ERP-tabeller.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export interface WebProduct {
  slug: string;
  name: string;
  category: string;
  hero_tagline: string | null;
  intro: string;
  story: string;
  seo_title: string;
  seo_description: string;
  web_display_order: number | null;
  color_order: string[] | null;
  materials: string[] | null;
  finishes: string[] | null;
  applications: string[] | null;
  short_description: string | null;
  primary_image: string | null;
  images: string[] | null;
  images_meta: { url: string; color: string | null }[] | null;
}

export interface WebColor {
  slug: string;
  label: string;
  swatch_hex: string;
  sort_order: number;
}

export interface WebCase {
  slug: string;
  name: string;
  hero_tagline: string | null;
  web_summary: string | null;
  web_story: string | null;
  seo_title: string;
  seo_description: string | null;
  web_display_order: number | null;
  hero_image_url: string | null;
  delivery_label: string | null;
  contractor_label: string | null;
  show_customer_name: boolean;
  status_label: string | null;
  status_live: boolean;
  architect_label: string | null; // NULL medmindre show_architect_name (godkendt)
  gallery: WebImage[] | null;
}

// Billede med ærlig mærkning: 'foto' = fra leverancen, 'visualisering' = render/stand-in,
// 'tegning' = udsnit af vores egne 3D-/værkstedstegninger, 'video' = mp4 i public/video (poster = stillbillede).
export interface WebImage {
  src: string; // Supabase-URL eller sti i public/ (fx '/billeder/morkhoj/01.jpg')
  alt: string;
  kind: 'foto' | 'visualisering' | 'tegning' | 'video';
  caption?: string | null;
  poster?: string | null;
}

// Landingsside pr. emne (materiale/produkt), målgruppe eller guide (forklarende artikel) — v_web_landing_pages.
export interface WebLanding {
  slug: string;
  kind: 'emne' | 'segment' | 'guide';
  nav_label: string;
  kicker: string | null;
  h1: string;
  lead: string | null;
  body: string | null;
  highlights: { k: string; v: string }[];
  faq: { q: string; a: string }[];
  keywords: string[];
  case_slugs: string[];
  product_slugs: string[];
  related_slugs: string[];
  images: WebImage[];
  seo_title: string;
  seo_description: string;
  web_display_order: number | null;
  updated_at: string;
}

// Memoiseret: footeren henter listen på hver side under build.
let landingCache: Promise<WebLanding[]> | null = null;
export function getWebLandingPages(): Promise<WebLanding[]> {
  landingCache ??= (async () => {
    const { data, error } = await supabase
      .from('v_web_landing_pages')
      .select('*')
      .order('web_display_order', { ascending: true, nullsFirst: false });
    if (error) throw new Error(`Supabase v_web_landing_pages: ${error.message}`);
    return data ?? [];
  })();
  return landingCache;
}

// Kort label til produktkort ud fra ERP-kategori.
export const categoryLabel: Record<string, string> = {
  baenk: 'Bænk',
  garderobeskab: 'Garderobeskab',
  vaegbeklaedning: 'Vægbeklædning',
  doer: 'Dør',
  akustik: 'Akustik',
  lockers: 'Lockers',
  omklaedning: 'Omklædning',
  koekken: 'Køkken',
};

export async function getWebProducts(): Promise<WebProduct[]> {
  const { data, error } = await supabase
    .from('v_web_products')
    .select('*')
    .order('web_display_order', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Supabase v_web_products: ${error.message}`);
  return data ?? [];
}

export async function getWebColors(): Promise<WebColor[]> {
  const { data, error } = await supabase
    .from('v_web_colors')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`Supabase v_web_colors: ${error.message}`);
  return data ?? [];
}

export async function getWebCases(): Promise<WebCase[]> {
  const { data, error } = await supabase
    .from('v_web_cases')
    .select('*')
    .order('web_display_order', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Supabase v_web_cases: ${error.message}`);
  return data ?? [];
}
