// Rewriter en Supabase storage object-URL til render/image-transform-endpointet
// (resizer + auto-webp via browserens Accept-header). Reducerer payload markant.
// Lader ikke-Supabase-URLs være urørte.
export function cdn(url: string | null | undefined, width = 1000, quality = 72): string {
  if (!url) return '';
  if (!url.includes('/storage/v1/object/public/')) return url;
  const t = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = t.includes('?') ? '&' : '?';
  return `${t}${sep}width=${width}&quality=${quality}`;
}
