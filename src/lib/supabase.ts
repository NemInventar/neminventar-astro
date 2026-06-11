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
}

// Kort label til produktkort ud fra ERP-kategori.
export const categoryLabel: Record<string, string> = {
  baenk: 'Bænk',
  garderobeskab: 'Garderobeskab',
  vaegbeklaedning: 'Vægbeklædning',
  doer: 'Dør',
  akustik: 'Akustik',
  lockers: 'Lockers',
};

export async function getWebProducts(): Promise<WebProduct[]> {
  const { data, error } = await supabase
    .from('v_web_products')
    .select('*')
    .order('web_display_order', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Supabase v_web_products: ${error.message}`);
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
