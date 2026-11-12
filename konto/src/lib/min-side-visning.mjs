// Min side (konto.neminventar.dk/min-side/, engelsk /en/min-side/) som HTML — Fable runde 3 b ("Min side"), c3–c7, d3.
// Data = GET /api/min-side (kontrakter §6): {email, ordrer: OrdreMedLogin[] | {fejl:'nede'}, designs, gemt_uden_login}.
// Statuskolonnen bygger på kernens tilstand(); datoer og uger skrives af kernen (dansk og engelsk).
import { tilstand } from '../../vendor/webordre/tilstand.mjs';
import { kbhDato, ugeFrist, ugeTekst, dagTekst, datoTekst } from '../../vendor/webordre/datoer.mjs';
import { t, tHtml, esc, kolonner, beloeb, sprogAf } from './tekst.mjs';
import { designerLink } from './adresser.mjs';

export const PRODUKT_IKON = '<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M5 3h14v18H5zM12 3v18M9 11v2M15 11v2"/></svg>';

const tekst = (x) => (typeof x === 'string' ? x.trim() : '');
const tid = (x) => { const ms = Date.parse(x ?? ''); return Number.isFinite(ms) ? ms : 0; };

/** Statuskolonnen for én bestilling (Fable d3 best.status.*). */
export function statusTekst(ordre, nu, sprog = 'da') {
  const sp = sprogAf(sprog);
  const s = tilstand(ordre, nu);
  if (!s) return '';
  const lev = s.forloeb.find((r) => (r.trin === 'leveret' || r.trin === 'hentet') && r.sket);
  switch (s.nr) {
    case 1: {
      const frist = ordre.uge_frist_at ?? (ordre.betaling?.betalt_at ? ugeFrist(ordre.betaling.betalt_at) : null);
      return frist ? t(sp, 'best.status.frist', { dag: dagTekst(kbhDato(frist), s.iDag, sp) }) : t(sp, 'best.status.fristOver');
    }
    case 2: return t(sp, 'best.status.fristOver');
    case 3: case 4: return t(sp, 'best.status.uge', { uge: ugeTekst(s.uge.aar, s.uge.uge, sp) });
    case 5: return s.form === 'afhentning' ? t(sp, 'best.status.afhentUgeOver') : t(sp, 'best.status.ugeOver', { nr: s.uge.uge });
    case 6: case 7: return t(sp, 'best.status.dag', { dag: dagTekst(s.dag.dato, s.iDag, sp) });
    case 8: return t(sp, 'best.status.idag');
    case 9: return t(sp, 'best.status.dagOver');
    case 10: return t(sp, 'best.status.leveret', { dato: lev ? datoTekst(lev.iso, sp) : '' });
    case 11: return t(sp, 'best.status.afhentUge');
    case 12: return t(sp, 'best.status.afhent');
    case 13: return t(sp, 'best.status.hentet', { dato: lev ? datoTekst(lev.iso, sp) : '' });
    case 14: return t(sp, 'best.status.annulleret');
    case 15: return t(sp, 'best.status.fortrudt');
    default: return '';
  }
}

// Ugen i parentes brydes ikke midt i (som i mockuppen)
const statusHtml = (s) => esc(s).replace(/\(([^)]*)\)/g, '<span class="nob">($1)</span>');

function bestillingerHtml(ordrer, sprog, nu) {
  const kol = kolonner(sprog, 'best.kol');
  const hoved = `<thead><tr>${kol.map((k, i) => `<th scope="col"${i === 3 ? ' class="n"' : ''}>${esc(k)}</th>`).join('')}</tr></thead>`;
  let krop;
  if (!Array.isArray(ordrer)) {
    krop = `<tr class="tom"><td colspan="5"><p>${tHtml(sprog, 'nede')}</p></td></tr>`;
  } else if (!ordrer.length) {
    krop = `<tr class="tom"><td colspan="5"><p>${esc(t(sprog, 'best.tom'))}</p><p>${esc(t(sprog, 'best.tomHjaelp'))}</p></td></tr>`;
  } else {
    krop = [...ordrer].sort((a, b) => tid(b.bestilt) - tid(a.bestilt)).map((o) => {
      const ref = tekst(o.ref);
      const linje = Array.isArray(o.linjer) && o.linjer[0] ? tekst(o.linjer[0].tekst) : '';
      const lev = tekst(o.levering?.tekst);
      const inkl = o.total?.inkl_oere;
      return `<tr><td class="nw"><a class="lnk" href="/ordre/#${esc(ref)}" aria-label="${esc(t(sprog, 'best.linkLabel', { ref }))}"><b>${esc(ref)}</b></a></td>`
        + `<td class="nw">${o.bestilt ? esc(datoTekst(o.bestilt, sprog)) : ''}</td>`
        + `<td>${esc(linje)}${lev ? `<small>${esc(lev)}</small>` : ''}</td>`
        + `<td class="n">${Number.isSafeInteger(inkl) ? esc(beloeb(inkl, sprog)) : ''}</td>`
        + `<td class="bst">${statusHtml(statusTekst(o, nu, sprog))}</td></tr>`;
    }).join('');
  }
  const kunDansk = t(sprog, 'best.kunDansk');
  return `<section aria-labelledby="h-best"><h2 class="sec-h" id="h-best">${esc(t(sprog, 'best.h2'))}</h2>`
    + `<div class="tb"><table class="best">${hoved}<tbody>${krop}</tbody></table></div>`
    + (kunDansk && Array.isArray(ordrer) && ordrer.length ? `<p class="under">${esc(kunDansk)}</p>` : '')
    + '</section>';
}

function designRaekke(d, sprog, designerUrl) {
  const uden = d.slags === 'uden';
  const navn = uden ? tekst(d.titel) : tekst(d.navn);
  const dato = uden ? tekst(d.dato) : tekst(d.gemt);
  const datoKbh = dato ? kbhDato(dato) : null;
  const pris = Number.isSafeInteger(d.pris_oere) ? beloeb(d.pris_oere, sprog) : '—';
  const aabn = designerLink(designerUrl, {
    produkt: d.produkt, t: d.t, permalink: uden ? d.permalink : null, prisOere: d.pris_oere, dato: datoKbh, sprog,
  });
  const mere = `<details class="mere" data-mere><summary>${esc(t(sprog, 'design.mere'))}</summary><div class="ind">`
    + (uden ? '' : `<button type="button" class="lnk knap-lnk" data-handling="omdoeb">${esc(t(sprog, 'design.omdoeb'))}</button>`
      + `<button type="button" class="lnk knap-lnk" data-handling="kopier">${esc(t(sprog, 'design.link'))}</button>`)
    + `<button type="button" class="lnk knap-lnk" data-handling="slet-design">${esc(t(sprog, 'design.slet'))}</button>`
    + '</div><div class="mere-svar" data-svar></div></details>';
  return `<tr data-design="${esc(String(d.id))}" data-slags="${uden ? 'uden' : 'konto'}" data-navn="${esc(navn)}"${uden ? '' : ` data-kopi="${esc(designerLink(designerUrl, { produkt: d.produkt, t: d.t, sprog, medGemt: false }) ?? '')}"`}>`
    + `<td class="th-c"><span class="th ikon">${PRODUKT_IKON}</span></td>`
    + `<td><b class="d-navn">${esc(navn || '—')}</b>${uden ? `<span class="ml-m">${esc(t(sprog, 'design.udenLogin'))}</span><small>${esc(t(sprog, 'design.udenLoginHjaelp'))}</small>` : ''}${mere}</td>`
    + `<td class="nw">${datoKbh ? esc(datoTekst(datoKbh, sprog)) : ''}</td>`
    + `<td class="n">${esc(pris)}</td>`
    + `<td class="n">${aabn ? `<a class="go" href="${esc(aabn)}">${esc(t(sprog, 'design.aabn'))}<i aria-hidden="true">→</i></a>` : ''}</td></tr>`;
}

function designsHtml(designs, udenLogin, sprog, designerUrl) {
  const kol = kolonner(sprog, 'design.kol');
  const hoved = `<thead><tr><td></td><th scope="col">${esc(kol[0])}</th><th scope="col">${esc(kol[1])}</th><th scope="col" class="n">${esc(kol[2])}</th><td></td></tr></thead>`;
  const alle = [
    ...(Array.isArray(designs) ? designs : []).map((d) => ({ ...d, slags: 'konto' })).sort((a, b) => tid(b.gemt) - tid(a.gemt)),
    ...(Array.isArray(udenLogin) ? udenLogin : []).map((d) => ({ ...d, slags: 'uden' })).sort((a, b) => tid(b.dato) - tid(a.dato)),
  ];
  const krop = alle.length
    ? alle.map((d) => designRaekke(d, sprog, designerUrl)).join('')
    : `<tr class="tom"><td colspan="5"><p>${esc(t(sprog, 'design.tom'))}</p><a class="btn btn-primary btn-s" href="${esc(`${designerUrl}${sprog === 'en' ? '?lang=en' : ''}`)}">${esc(t(sprog, 'design.tomKnap'))} <span aria-hidden="true">→</span></a></td></tr>`;
  return `<section aria-labelledby="h-design"><h2 class="sec-h" id="h-design" tabindex="-1">${esc(t(sprog, 'design.h2'))}</h2>`
    + '<p class="form-msg ok" role="status" data-design-besked hidden></p>'
    + `<div class="tb"><table class="des">${hoved}<tbody>${krop}</tbody></table></div>`
    + (alle.length ? `<p class="under">${esc(t(sprog, 'design.note'))}</p>` : '')
    + '</section>';
}

function kontoHtml(email, sprog) {
  return `<section aria-labelledby="h-konto"><h2 class="sec-h" id="h-konto">${esc(t(sprog, 'konto.h2'))}</h2><div class="tb konto">`
    + `<div class="rk"><span class="rk-k">${esc(t(sprog, 'konto.email'))}</span><span class="rk-v">${esc(email)}<small>${tHtml(sprog, 'konto.emailHjaelp')}</small></span><span></span></div>`
    + `<div class="rk"><span class="rk-k">${esc(t(sprog, 'konto.logUd'))}</span><span class="rk-v muted">${esc(t(sprog, 'konto.logUdTekst'))}</span><span class="rk-h"><button type="button" class="btn btn-ghost btn-s" data-handling="log-ud">${esc(t(sprog, 'konto.logUd'))}</button></span></div>`
    + `<div class="rk" data-rk="alle">${renderLogUdAlle('start', sprog)}</div>`
    + `<details class="slet" data-slet><summary>${esc(t(sprog, 'konto.slet'))}</summary><div class="slet-in">`
    + `<p>${esc(t(sprog, 'konto.slet1'))}</p><p>${esc(t(sprog, 'konto.slet2'))}</p><p>${esc(t(sprog, 'konto.slet3'))}</p>`
    + `<div data-slet-trin>${renderSletTrin('start', sprog)}</div>`
    + '<p class="form-msg err" role="alert" data-slet-besked hidden></p>'
    + '</div></details></div></section>';
}

/** "Log ud alle steder" (Fable c7): start → spørgsmålet i rækken. */
export function renderLogUdAlle(trin, sprog) {
  if (trin === 'spoerg') {
    return `<span class="rk-k">${esc(t(sprog, 'konto.logUdAlle'))}</span><span class="rk-v">${esc(t(sprog, 'konto.logUdAlleSpoerg'))}</span>`
      + `<span class="rk-h knapper"><button type="button" class="btn btn-primary btn-s" data-handling="log-ud-alle-ja">${esc(t(sprog, 'konto.logUdAlleJa'))}</button><button type="button" class="btn btn-ghost btn-s" data-handling="log-ud-alle-fortryd">${esc(t(sprog, 'konto.fortryd'))}</button></span>`;
  }
  return `<span class="rk-k">${esc(t(sprog, 'konto.logUdAlle'))}</span><span class="rk-v muted">${esc(t(sprog, 'konto.logUdAlleTekst'))}</span>`
    + `<span class="rk-h"><button type="button" class="btn btn-ghost btn-s" data-handling="log-ud-alle">${esc(t(sprog, 'konto.logUdAlle'))}</button></span>`;
}

/** "Slet konto" (Fable c6): start → kodefeltet i rækken. */
export function renderSletTrin(trin, sprog) {
  if (trin === 'kode') {
    return `<p class="slet-lbl"><label for="slet-kode">${esc(t(sprog, 'konto.sletKode'))}</label></p>`
      + '<div class="slet-trin"><div class="field"><input id="slet-kode" class="kode" inputmode="numeric" autocomplete="one-time-code" maxlength="11" spellcheck="false"></div>'
      + `<button type="button" class="btn btn-primary btn-s" data-handling="slet-ja">${esc(t(sprog, 'konto.sletJa'))}</button>`
      + `<button type="button" class="btn btn-ghost btn-s" data-handling="slet-fortryd">${esc(t(sprog, 'konto.fortryd'))}</button></div>`;
  }
  return `<button type="button" class="btn btn-ghost btn-s" data-handling="slet-kode">${esc(t(sprog, 'konto.sletKnap'))}</button>`;
}

/** Omdøb og slet i en designrække (Fable d3). */
export function renderDesignSvar(trin, sprog, { navn = '' } = {}) {
  if (trin === 'omdoeb') {
    return `<form class="omdoeb" data-omdoeb novalidate><label class="sr" for="omdoeb-felt">${esc(t(sprog, 'design.omdoeb'))}</label>`
      + `<input id="omdoeb-felt" type="text" maxlength="80" value="${esc(navn)}" autocomplete="off">`
      + `<button type="submit" class="btn btn-primary btn-s">${esc(t(sprog, 'design.omdoebGem'))}</button></form>`;
  }
  if (trin === 'slet') {
    return `<p>${esc(t(sprog, 'design.sletSpoerg', { navn }))}</p><span class="knapper"><button type="button" class="btn btn-primary btn-s" data-handling="slet-design-ja">${esc(t(sprog, 'design.sletJa'))}</button>`
      + `<button type="button" class="btn btn-ghost btn-s" data-handling="slet-design-nej">${esc(t(sprog, 'design.sletNej'))}</button></span>`;
  }
  if (trin === 'kopieret') return `<p class="form-msg ok" role="status">${esc(t(sprog, 'design.linkKopieret'))}</p>`;
  if (trin === 'fejl') return `<p class="form-msg err" role="alert">${esc(t(sprog, 'side.fejl'))}</p>`;
  return '';
}

/** Hele Min side. data = svaret fra /api/min-side. ny = første login ("Din konto er oprettet."). */
export function renderMinSide({ data, sprog = 'da', nu, designerUrl, ny = false }) {
  const sp = sprogAf(sprog);
  const email = tekst(data?.email);
  return '<div class="minside">'
    + `<h1 id="side-h1" tabindex="-1">${esc(t(sp, 'side.h1'))}</h1>`
    + `<p class="hvem">${esc(t(sp, 'side.loggetInd', { email }))} · <button type="button" class="lnk knap-lnk" data-handling="log-ud">${esc(t(sp, 'side.logUd'))}</button></p>`
    + `<div data-side-besked>${ny ? `<p class="form-msg ok" role="status">${esc(t(sp, 'kode.oprettet'))}</p>` : ''}</div>`
    + bestillingerHtml(data?.ordrer, sp, nu)
    + designsHtml(data?.designs, data?.gemt_uden_login, sp, designerUrl)
    + kontoHtml(email, sp)
    + '</div>';
}

/** Hele Min side kan ikke vises: flaget er fra (lukket) eller konto-databasen er nede. */
export function renderMinSideFejl(fejl, sprog = 'da') {
  const sp = sprogAf(sprog);
  return `<div class="minside"><h1 id="side-h1" tabindex="-1">${esc(t(sp, 'side.h1'))}</h1><p class="sub">${tHtml(sp, fejl === 'lukket' ? 'lukket' : 'nede')}</p></div>`;
}
