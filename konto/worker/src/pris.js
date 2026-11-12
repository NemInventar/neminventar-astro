// "Gem design" (fable c3, c4): tilstanden renses for eget foto (R11), og prisen regnes af serveren via
// api.neminventar.dk/pris (designer-ordre linkPris) — aldrig af klienten (kontrakter §6).
// /pris?p=<produkt>&t=<t>&format=json → {ok, titel, varianter: [{form, trin, inkl, …}], …}. "Pris da du gemte" er
// den pris, designeren viser i bjælken: flatpack til kantsten (core/levering.js), ellers samlet til kantsten.
import { b64url, fraB64url } from './krypto.js';

export const MAX_T = 6000;              // samme loft som designerens permalink (core/permalink.js MAX_T)
const TIMEOUT_MS = 8_000;
const erObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export function afkod(t) {
  if (typeof t !== 'string' || !t || t.length > MAX_T || !/^[A-Za-z0-9_-]+$/.test(t)) return null;
  try {
    const x = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fraB64url(t)));
    return erObj(x) ? x : null;
  } catch {
    return null;
  }
}

export const kod = (st) => b64url(new TextEncoder().encode(JSON.stringify(st)));

// Et billede-valg (core/billede.js): {b, h, z} eller det gamle {b, h, data} — et gråtonegitter fra kundens eget foto
const erBillede = (v) => erObj(v) && Number.isInteger(v.b) && Number.isInteger(v.h)
  && (typeof v.z === 'string' || typeof v.data === 'string');

function utenFoto(x, dybde = 0) {
  if (dybde > 4) return x;
  if (Array.isArray(x)) return x.map((v) => utenFoto(v, dybde + 1));
  if (!erObj(x)) return x;
  const ud = {};
  for (const [k, v] of Object.entries(x)) ud[k] = erBillede(v) ? null : utenFoto(v, dybde + 1);
  return ud;
}

// R11: t uden eget foto (billede-valg sættes til null, som designeren selv gør uden billede). null = ikke en tilstand.
export function rensT(t) {
  const st = afkod(t);
  return st ? kod(utenFoto(st)) : null;
}

export function valgtVariant(varianter) {
  if (!Array.isArray(varianter) || !varianter.length) return null;
  return varianter.find((v) => v?.form === 'flatpack' && v?.trin === 'kantsten')
    ?? varianter.find((v) => v?.trin === 'kantsten')
    ?? varianter[0];
}

// → {pris_oere: heltal i øre inkl. moms | null, titel: string | null}. Fejler aldrig: kan prisen ikke regnes,
// gemmes designet med "—" (pris null).
export async function prisVedGem(prisUrl, fetcher, produkt, t) {
  const tom = { pris_oere: null, titel: null };
  let res;
  try {
    res = await fetcher(`${prisUrl}?p=${encodeURIComponent(produkt)}&t=${t}&format=json`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return tom;
  }
  if (res.status !== 200) return tom;
  let d;
  try {
    d = await res.json();
  } catch {
    return tom;
  }
  const titel = typeof d?.titel === 'string' ? d.titel.slice(0, 80) : null;
  if (!erObj(d) || d.ok !== true) return { ...tom, titel };
  const v = valgtVariant(d.varianter);
  const inkl = Number(v?.inkl);
  if (!Number.isFinite(inkl) || inkl < 0 || inkl > 10_000_000) return { ...tom, titel };
  return { pris_oere: Math.round(inkl * 100), titel };
}
