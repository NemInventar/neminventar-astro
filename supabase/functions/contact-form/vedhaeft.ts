// Tekst ud af en vedhæftet fil til mailen (v10, 23-11-2026): .docx, .odt, .txt og .csv. Ingen imports og intet netværk,
// så det testes med node --test (vedhaeft.test.ts) og kører uændret i Supabase Edge (Deno). Docx og odt er zip-filer:
// den lille zip-læser herunder finder ét dokument og pakker det ud med DecompressionStream('deflate-raw'), som både
// Deno og Node har. PDF er ikke med: teksten ligger i skrifternes egne tegnkoder og kræver et rigtigt PDF-bibliotek.
// Fejler noget, giver funktionerne null, og mailen viser kun linket.

export const TEKST_EXT = new Set(['docx', 'odt', 'txt', 'csv']);
export const MAX_FIL_BYTES = 5 * 1024 * 1024;      // større filer hentes ikke for at blive læst
export const MAX_TEGN = 1500;                      // så meget tekst står i mailen; resten ligger i filen
const MAX_UDPAKKET = 20 * 1024 * 1024;             // et dokument over 20 MB udpakket er ikke et brev (zip-bombe)

export const extAf = (n: string) => (String(n).match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? '').toLowerCase();

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

// Ét navngivet medlem af en zip-fil, udpakket. null, hvis det ikke findes eller ikke kan læses.
export async function zipFil(zip: Uint8Array, navn: string): Promise<Uint8Array | null> {
  // End of central directory: sidst i filen, efter højst 65.535 bytes kommentar
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--) {
    if (u32(zip, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const antal = u16(zip, eocd + 10);
  let p = u32(zip, eocd + 16);
  const dec = new TextDecoder();
  for (let n = 0; n < antal && p + 46 <= zip.length; n++) {
    if (u32(zip, p) !== 0x02014b50) return null;
    const metode = u16(zip, p + 10), csize = u32(zip, p + 20), usize = u32(zip, p + 24);
    const nl = u16(zip, p + 28), el = u16(zip, p + 30), kl = u16(zip, p + 32), lokal = u32(zip, p + 42);
    const fn = dec.decode(zip.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + el + kl;
    if (fn !== navn) continue;
    if (usize > MAX_UDPAKKET || lokal + 30 > zip.length || u32(zip, lokal) !== 0x04034b50) return null;
    const start = lokal + 30 + u16(zip, lokal + 26) + u16(zip, lokal + 28);
    const data = zip.subarray(start, start + csize);
    if (metode === 0) return data;
    if (metode === 8) return await inflate(data, MAX_UDPAKKET);
    return null;
  }
  return null;
}

async function inflate(data: Uint8Array, maks: number): Promise<Uint8Array | null> {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  w.write(data).catch(() => {});
  w.close().catch(() => {});
  const r = ds.readable.getReader();
  const dele: Uint8Array[] = [];
  let samlet = 0;
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    samlet += value.length;
    if (samlet > maks) { r.cancel().catch(() => {}); return null; }
    dele.push(value);
  }
  const ud = new Uint8Array(samlet);
  let o = 0;
  for (const d of dele) { ud.set(d, o); o += d.length; }
  return ud;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const entiteter = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') {
    const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
  }
  return ENT[e.toLowerCase()] ?? m;
});

// word/document.xml → tekst: et afsnit pr. linje, tabelceller adskilt af tabulator
export function docxXmlTilTekst(xml: string): string {
  return entiteter(String(xml)
    .replace(/<w:tab\/>|<\/w:tc>/g, '\t')
    .replace(/<w:br[^>]*\/>|<w:cr\/>|<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, ''));
}

// content.xml (OpenDocument) → tekst
export function odtXmlTilTekst(xml: string): string {
  return entiteter(String(xml)
    .replace(/<text:tab\/>|<\/table:table-cell>/g, '\t')
    .replace(/<text:line-break\/>|<\/text:p>|<\/text:h>/g, '\n')
    .replace(/<text:s(?: text:c="(\d+)")?\/>/g, (_, c) => ' '.repeat(Math.min(Number(c) || 1, 20)))
    .replace(/<[^>]+>/g, ''));
}

// Ren tekst: UTF-8, ellers Windows-1252 (Excel og Notesblok gemmer ofte sådan på danske maskiner)
export function txtTilTekst(b: Uint8Array): string {
  const utf = new TextDecoder('utf-8').decode(b);
  if (!utf.includes('�')) return utf.replace(/^﻿/, '');
  try { return new TextDecoder('windows-1252').decode(b); } catch { return utf; }
}

// Ryd op og skær ved maks tegn (ved et ordskifte, når det er tæt på)
export function kortTekst(s: string, maks = MAX_TEGN): { tekst: string; afkortet: boolean } {
  const t = String(s).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length <= maks) return { tekst: t, afkortet: false };
  const cut = t.slice(0, maks);
  const sp = cut.lastIndexOf(' ');
  return { tekst: (sp > maks - 80 ? cut.slice(0, sp) : cut).trimEnd(), afkortet: true };
}

// Filens tekst (de første maks tegn), eller null for en filtype, vi ikke læser, eller en fil, der ikke kan læses
export async function tekstAf(navn: string, bytes: Uint8Array, maks = MAX_TEGN): Promise<{ tekst: string; afkortet: boolean } | null> {
  try {
    const ext = extAf(navn);
    let raa: string | null = null;
    if (ext === 'txt' || ext === 'csv') raa = txtTilTekst(bytes);
    else if (ext === 'docx') {
      const xml = await zipFil(bytes, 'word/document.xml');
      raa = xml ? docxXmlTilTekst(new TextDecoder().decode(xml)) : null;
    } else if (ext === 'odt') {
      const xml = await zipFil(bytes, 'content.xml');
      raa = xml ? odtXmlTilTekst(new TextDecoder().decode(xml)) : null;
    }
    if (raa == null) return null;
    const k = kortTekst(raa, maks);
    return k.tekst ? k : null;
  } catch {
    return null;
  }
}
