// "Gem design" (fable c3, c4): tilstanden renses for eget foto (R11), og prisen regnes af serveren via
// api.neminventar.dk/pris (designer-ordre linkPris) — aldrig af klienten (kontrakter §6).
//
// GRUNDLAGET for pris_oere (hovedsessionen 12-11-2026): samme tal som designerens bjælke — designets egen pris inkl. moms
// UDEN levering (produkternes PR.vare(st, {kunde: 'privat'}).inkl, momsTekst "inkl. moms, ekskl. levering"), i øre som
// heltal. Ellers viser banneret ved genåbning (fable c4) en falsk prisforskel.
// /pris?p=<produkt>&t=<t>&format=json giver kun varianter MED levering: {varianter: [{form, trin, inkl, linjer: [{t, ex}]}]},
// hvor formerne står i designerens rækkefølge (standardformen først: flatpack, hvis produktet kan fladpakkes, ellers
// samlet). Varens pris uden levering findes sådan:
//   1. Standardformen med trinnet "afhent" (Afhentning på Mågevej): leveringslinjen er 0 kr. (core/levering.js), så
//      variantens inkl er præcis varens pris i bjælken.
//   2. Uden afhentning (fx lockers, kun samlet): standardformen til kantsten minus den ene leveringslinje, som
//      ordre() altid lægger til sidst (core/levering.js linjer(): kantsten = én linje). Moms 25 %.
// Begge er efterprøvet mod produkternes vare() for hoejskab, baenk og locker (rapporten 12-11-2026).
import { b64url, fraB64url } from './krypto.js';

export const MOMS = 1.25;

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

const tal = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

// Varens pris inkl. moms uden levering (kroner, ikke afrundet) ud fra /pris-svarets varianter. null = kan ikke afgøres.
export function prisUdenLevering(varianter) {
  if (!Array.isArray(varianter) || !varianter.length || !erObj(varianter[0])) return null;
  const std = varianter[0].form;
  const afhent = varianter.find((v) => erObj(v) && v.form === std && v.trin === 'afhent');
  if (afhent) {
    const leveringen = Array.isArray(afhent.linjer) ? afhent.linjer.at(-1) : null;
    if (!erObj(leveringen) || leveringen.ex !== 0) return null;      // afhentningen skal stå til 0 kr.
    return tal(afhent.inkl);
  }
  const kant = varianter.find((v) => erObj(v) && v.form === std && v.trin === 'kantsten');
  if (!kant || !Array.isArray(kant.linjer) || kant.linjer.length < 2) return null;
  const ex = kant.linjer.slice(0, -1).reduce((a, l) => (a === null || tal(l?.ex) === null ? null : a + l.ex), 0);
  return ex === null ? null : ex * MOMS;
}

// → {pris_oere: heltal i øre inkl. moms uden levering | null, titel: string | null}. Fejler aldrig: kan prisen ikke
// regnes, gemmes designet med "—" (pris null).
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
  const inkl = prisUdenLevering(d.varianter);
  if (inkl === null || inkl < 0 || inkl > 10_000_000) return { ...tom, titel };
  return { pris_oere: Math.round(inkl * 100), titel };
}
