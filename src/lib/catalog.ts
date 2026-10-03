// Fælles regler for, hvordan katalog og projekter vises på sitet (forside, produkt-, projekt- og landingssider).
// Ét sted, så familier, tal og foto-mærker er ens overalt. Indholdet kommer stadig fra Supabase-views.
import type { WebCase, WebProduct } from './supabase';

// ---------- Familier (kataloget grupperes i seks) ----------
export const FAM: Record<string, string> = {
  garderober: 'Garderober og lockers',
  skabe: 'Højskabe og opbevaring',
  nicher: 'Nicher og bænke',
  koekken: 'Tekøkkener',
  omklaedning: 'Omklædning og vådrum',
  vaegge: 'Vægge, døre og akustik',
};
export const FAM_ORDER = Object.keys(FAM);
export const famOf = (p: WebProduct): string =>
  /^(garderobe|skohylde)/.test(p.slug) ? 'garderober'
  : /^(opbevaringsskab|hoejskab)/.test(p.slug) ? 'skabe'
  : p.category === 'baenk' ? 'nicher'
  : p.category === 'koekken' ? 'koekken'
  : p.category === 'omklaedning' ? 'omklaedning'
  : p.category === 'lockers' ? 'garderober'
  : 'vaegge';

// ---------- Fotos fra leverancen ----------
// Et foto er noget, vi selv har lagt i public/ (eller det ligger på vores eget domæne). Alt andet er renders.
export const isPhoto = (src: string | null | undefined): boolean => !!src && (src.startsWith('/') || src.includes('neminventar.dk/'));
export const morkhoj = (file: string) => `/billeder/morkhoj/${file}`;
// Sagen, fotografens fotos kommer fra. Navnet slås op i cases, så det følger case_web.
export const PHOTO_PROJECT_SLUG = 'morkhoj-skole';
export const photoProjectName = (cases: WebCase[]) => cases.find((c) => c.slug === PHOTO_PROJECT_SLUG)?.name ?? 'leverancen';
// Arketyper, hvor et foto viser netop den type. Garderobeskabene har allerede fotoet som hero i product_web;
// de tre andre skal samme vej (product_web.hero_image_id), så listen her kan forsvinde.
export const PHOTO: Record<string, { file: string; pos: string }> = {
  'garderobeskab-perforerede-lager': { file: '33_lockere-roede-ved-doer-til-klasserum.jpg', pos: '40% 55%' },
  'hoejskab-krydsfiner': { file: '32_hoejskabe-blaa-og-siddeplads-ved-vindue.jpg', pos: '40% 45%' },
  'opbevaringsskab-bejdset-krydsfiner': { file: '27_hoejskab-blaa-krydsfiner-og-siddepladser.jpg', pos: '50% 50%' },
  'koekkenvaeg-bejdset-krydsfiner': { file: '24_tekoekken-blaa-fronter-staalbordplade.jpg', pos: '40% 55%' },
};
export const productImage = (p: WebProduct) => {
  const o = PHOTO[p.slug];
  const img = o ? morkhoj(o.file) : (p.primary_image ?? '');
  return { img, pos: o?.pos ?? '50% 60%', foto: isPhoto(img) };
};
export const fotoTag = (foto: boolean, projectName: string) => (foto ? `Foto · ${projectName}` : '3D-visualisering');

// ---------- Tal fra leverancen ----------
// "342 lockers" → 342 + lockers; "ca. 300 m² akustik" → "ca. 300 m²" + akustik. Ingen match → null.
export const splitTal = (s: string) => {
  const m = s.trim().match(/^((?:ca\.\s*)?[\d.,]+(?:\s*m²|\s*m\b)?)\s+(.+)$/);
  return m ? { b: m[1], t: m[2] } : null;
};
export const leverance = (c?: WebCase | null) => (c?.delivery_label ?? '').split(' · ').map((s) => s.trim()).filter(Boolean);
// korte mærkater til talgitre (leverancens fulde ord står i teksten)
const SHORT: Record<string, string> = { 'bejdsede sideafskærmninger': 'sideafskærmninger', 'polstrede nicher og siddemøbler': 'nicher og siddemøbler' };
export const tal = (c?: WebCase | null) =>
  leverance(c).map(splitTal).filter((x): x is { b: string; t: string } => !!x).map((x) => ({ b: x.b, t: SHORT[x.t] ?? x.t }));

// ---------- Datarækker på et projekt ----------
// Pladsholderen "Hovedentreprenør" (uden tilladelse til navn) vises ikke som en oplysning.
export const caseMeta = (c: WebCase) => [
  { k: 'Leverance', v: c.delivery_label },
  ...(c.contractor_label && c.contractor_label !== 'Hovedentreprenør' ? [{ k: 'Entreprenør', v: c.contractor_label }] : []),
  ...(c.architect_label ? [{ k: 'Arkitekt', v: c.architect_label }] : []),
  { k: 'Status', v: c.status_label },
].filter((m): m is { k: string; v: string } => !!m.v);

export const imgLabel = (kind: string) =>
  kind === 'foto' ? 'Foto fra leverancen' : kind === 'tegning' ? 'Tegning' : kind === 'video' ? 'Video' : 'Visualisering';
