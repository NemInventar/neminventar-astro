// Ordresidens gang, uden DOM (så node:test kan køre den med falske afhængigheder). R10, plan-teknik-v3 §4:
//   1. Fragmentet læses: #NI-XXXXXXXX er et ordrenummer (kræver login), alt andet er en statusnøgle.
//   2. Nøglen fjernes fra adresselinjen med history.replaceState — FØR noget andet sker (også før Plausible).
//   3. Plausible får origin + pathname.
//   4. Nøglen sendes i en POST-body (/api/ordre), ordrenummeret til /api/ordre-ref.
// En nøgle huskes i fanens sessionStorage, så en genindlæsning stadig viser bestillingen (adressen bærer den ikke længere).
// ?ref=NI-… (retur efter log ind; et fragment kan ikke bære en retur-adresse, R21) skrives om til #NI-….
import { renderOrdre, renderOrdreFejl } from './ordre-visning.mjs';
import { loginAdresse } from './adresser.mjs';

const REF = /^NI-[0-9A-F]{8}$/;

export function laesAdresse(hash, search) {
  const h = String(hash ?? '').replace(/^#/, '').trim();
  if (h) {
    const r = h.toUpperCase();
    return REF.test(r) ? { ref: r, noegle: null } : /^NI-/i.test(h) ? { ref: null, noegle: null } : { ref: null, noegle: h };
  }
  let q;
  try {
    q = new URLSearchParams(search ?? '');
  } catch {
    return { ref: null, noegle: null };
  }
  const r = (q.get('ref') ?? '').trim().toUpperCase();
  return { ref: REF.test(r) ? r : null, noegle: null, fraQuery: REF.test(r) };
}

/**
 * m = {
 *   hash, search, pathname, udgivelse (1|2), designerUrl, nu() → ms,
 *   rydAdresse(url)          history.replaceState til url (uden nøgle)
 *   husk: { hent(), gem(noegle), glem() }   sessionStorage (kan mangle)
 *   sporing()                Plausible: origin + pathname
 *   api(sti, body) → Promise<{status, data}>
 *   vis({titel, html, fejl?, nr?})
 *   tilLogin(url)            location.assign
 *   harHaftSession()         var hun logget ind i denne fane (login.udloebet)
 * }
 */
export async function koerOrdre(m) {
  let { ref, noegle, fraQuery } = laesAdresse(m.hash, m.search);
  if (noegle) {
    m.rydAdresse(m.pathname);
    m.husk?.gem(noegle);
  } else if (ref && fraQuery) {
    m.rydAdresse(`${m.pathname}#${ref}`);
  } else if (!ref && !m.hash) {
    noegle = m.husk?.hent() ?? null;
  }
  m.sporing();

  if (!noegle && !ref) return m.vis(renderOrdreFejl('ukendt', m.udgivelse));
  if (ref && Number(m.udgivelse) !== 2) return m.vis(renderOrdreFejl('ukendt', m.udgivelse));

  const svar = noegle ? await m.api('/ordre', { noegle }) : await m.api('/ordre-ref', { ref });
  // Kun svarets indhold tæller, ikke HTTP-status: /api/ordre svarer 200 med {fejl: 'ukendt'|'erstattet'} (kontrakter §6,
  // rettet 12-11, så konsollen ikke viser en rød linje). En ældre Worker svarede 404/410 med samme indhold — samme tekst.
  const d = svar?.data ?? {};
  if (d.ordre && typeof d.ordre === 'object') {
    return m.vis(renderOrdre({ ordre: d.ordre, visning: d.visning, udgivelse: m.udgivelse, nu: m.nu(), designerUrl: m.designerUrl }));
  }
  if (noegle && (d.fejl === 'ukendt' || d.fejl === 'erstattet')) m.husk?.glem();
  if (ref && d.fejl === 'login') {
    return m.tilLogin(loginAdresse(`/ordre/?ref=${ref}`, { udloebet: !!m.harHaftSession?.() }));
  }
  return m.vis(renderOrdreFejl(d.fejl ?? 'nede', m.udgivelse));
}
