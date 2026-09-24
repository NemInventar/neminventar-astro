// Rewriter en Supabase storage object-URL til render/image-transform-endpointet
// (resizer + auto-webp via browserens Accept-header). Reducerer payload markant.
// Lader ikke-Supabase-URLs være urørte.
// Stier i public/ ('/billeder/...') gøres base-bevidste, så de også virker på en projekt-side.
export function cdn(url: string | null | undefined, width = 1000, quality = 72): string {
  if (!url) return '';
  if (url.startsWith('/')) return import.meta.env.BASE_URL + url.slice(1);
  if (!url.includes('/storage/v1/object/public/')) return url;
  const t = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = t.includes('?') ? '&' : '?';
  return `${t}${sep}width=${width}&quality=${quality}`;
}
