// Ordresiden (konto.neminventar.dk/ordre/) som HTML — Fable runde 3 afsnit e ("Rækkefølgen på siden i de tre udgaver")
// og d4 (teksterne). Tilstanden, overskriften, undersætningen, forløbets fire rækker, betalingen og vilkårene kommer
// fra kernen (vendor/webordre/tilstand.mjs), som regner alt i dansk tid. Her regnes intet; her vælges, hvad der vises.
//
// Tre udgaver (afsnit e):
//   'u1'      udgivelse 1                   — intet om Min side eller log ind; kun postnummer og by
//   'u2-uden' udgivelse 2, uden login       — + linjen om Min side med "Log ind" og tilbuddet om at logge ind
//   'u2-med'  udgivelse 2, med login        — + "← Min side", hele adressen, beskeden, "Se designet i 3D",
//                                             "Er det ikke din bestilling?"
// Aldrig på siden: kundens telefon og e-mail, og hvem hos os der har sat et trin. Renderen læser kun de felter, den
// skal bruge; et felt, broen ved en fejl sender med, når aldrig HTML'en (konto/test/ordre.test.mjs prøver det).
//
// "Hvad sker der, mens du venter?" og lev.aendre vises ikke, når der ikke længere bestilles plader: på leveringsdagen og
// efter den (tilstand 8 og 9, Fable runde 4 svar G) og når bestillingen er færdig (leveret, hentet, klar til afhentning,
// annulleret, fortrudt) — teksterne lover noget, der ikke længere kan ske.
// Afhentning har egne tekster (Fable runde 4 afsnit 11): forloeb.mensTekstAfhentning og lev.skjultAfhentning.
// "Leveres til" og lev.skjult1 vises ikke ved afhentning (der leveres ikke til adressen).
import { tilstand } from '../../vendor/webordre/tilstand.mjs';
import { t, tHtml, esc, tekstMedLinks, kolonner, beloeb, SITE, delOverskrift } from './tekst.mjs';
import { loginAdresse, designerLink } from './adresser.mjs';

const DA = 'da';
const INGEN_VENTER = new Set([8, 9, 10, 12, 13, 14, 15]);

export const udgaveAf = (udgivelse, visning) =>
  (Number(udgivelse) === 2 ? (visning === 'med_login' ? 'u2-med' : 'u2-uden') : 'u1');

const OK_IKON = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Overskrift: en parentes (ugens datoer) brydes ikke midt i
const h1Html = (s) => esc(s).replace(/\(([^)]*)\)/g, '<span class="nob">($1)</span>');

const tekst = (x) => (typeof x === 'string' ? x.trim() : '');

// "Mål og indretning": beskrivelsen, frosset ved betalingen (plan-teknik §3.2, fra linkPris-spec = [[navn, tekst], …]).
// Tåler også [{k, v}] / {spec: […]} / {felter: […]}. Andet vises ikke (løse nøgler kan være interne ord).
export function beskrivelsePar(b, dybde = 0) {
  if (dybde > 2 || b == null) return [];
  const par = (x) => {
    if (Array.isArray(x) && x.length >= 2) return [tekst(String(x[0] ?? '')), tekst(String(x[1] ?? ''))];
    if (x && typeof x === 'object') {
      for (const [a, c] of [['k', 'v'], ['navn', 'vaerdi'], ['navn', 'tekst'], ['label', 'value'], ['titel', 'tekst']]) {
        if (typeof x[a] === 'string' && (typeof x[c] === 'string' || typeof x[c] === 'number')) return [tekst(x[a]), tekst(String(x[c]))];
      }
    }
    return null;
  };
  if (Array.isArray(b)) return b.map(par).filter((p) => p && p[0] && p[1]);
  if (typeof b === 'object') {
    for (const k of ['spec', 'felter', 'linjer']) if (Array.isArray(b[k])) return beskrivelsePar(b[k], dybde + 1);
  }
  return [];
}

function forloebHtml(s) {
  const li = s.forloeb.map((r) => (r.sket
    ? `<li class="sket"><span class="ok">${OK_IKON}</span><span class="fl-navn">${esc(r.navn)}</span><span class="fl-tekst">${esc(r.dato)}${r.tekst ? `<small>${esc(r.tekst)}</small>` : ''}</span></li>`
    : `<li class="ikke"><span class="ej"></span><span class="fl-navn">${esc(r.navn)}</span><span class="fl-tekst">${r.tekst ? esc(r.tekst) : ''}</span></li>`));
  return `<ol class="fl">${li.join('')}</ol>`;
}

function varerHtml(ordre, udgave, designerUrl) {
  const [kVare, kAntal, kPris] = kolonner(DA, 'varer.kol');
  const linjer = Array.isArray(ordre.linjer) ? ordre.linjer : [];
  const par = beskrivelsePar(ordre.beskrivelse);
  const detaljer = par.length
    ? `<tr class="fold"><td colspan="3"><details class="mere" data-print-aaben><summary>${esc(t(DA, 'varer.detaljer'))}</summary><dl>${par.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details></td></tr>`
    : '';
  const raekker = linjer.map((l, i) => {
    const antal = Number.isFinite(l?.antal) ? String(l.antal) : '';
    const pris = Number.isSafeInteger(l?.beloeb_oere) ? beloeb(l.beloeb_oere, DA) : '';
    return `<tr><td>${esc(tekst(l?.tekst))}</td><td class="n">${esc(antal)}</td><td class="n">${esc(pris)}</td></tr>${i === 0 ? detaljer : ''}`;
  }).join('') || detaljer;
  const tot = ordre.total ?? {};
  const fod = [
    Number.isSafeInteger(tot.inkl_oere) ? `<tr class="tot"><th scope="row">${esc(t(DA, 'varer.ialt'))}</th><td></td><td class="n">${esc(beloeb(tot.inkl_oere, DA))}</td></tr>` : '',
    Number.isSafeInteger(tot.moms_oere) ? `<tr class="sub"><th scope="row">${esc(t(DA, 'varer.moms'))}</th><td></td><td class="n">${esc(beloeb(tot.moms_oere, DA))}</td></tr>` : '',
  ].join('');
  const link3d = udgave === 'u2-med' && ordre.permalink ? designerLink(designerUrl, { permalink: ordre.permalink, medGemt: false }) : null;
  return `<h2 class="sec-h">${esc(t(DA, 'varer.h2'))}</h2>`
    + `<div class="tb"><table class="varer"><thead><tr><th scope="col">${esc(kVare)}</th><th scope="col" class="n">${esc(kAntal)}</th><th scope="col" class="n">${esc(kPris)}</th></tr></thead>`
    + `<tbody>${raekker}</tbody>${fod ? `<tfoot>${fod}</tfoot>` : ''}</table></div>`
    + `<div class="efter">${link3d ? `<a class="go ikke-print" href="${esc(link3d)}" data-felt="3d">${esc(t(DA, 'varer.design'))}<i aria-hidden="true">→</i></a>` : ''}`
    + `<button type="button" class="lnk knap-lnk ikke-print" data-handling="udskriv">${esc(t(DA, 'varer.udskriv'))}</button></div>`
    + (link3d ? `<p class="lille ikke-print" data-felt="3d-note">${esc(t(DA, 'varer.designNote'))}</p>` : '');
}

function leveringHtml(ordre, s, udgave, ref) {
  const adr = ordre.adresse ?? {};
  const postBy = [tekst(adr.postnr), tekst(adr.by)].filter(Boolean).join(' ');
  const levering = s.form === 'levering';
  const kv = [];
  if (levering && postBy) {
    const linjer = udgave === 'u2-med' ? [tekst(adr.navn), tekst(adr.gade), postBy].filter(Boolean) : [postBy];
    kv.push(`<div data-felt="leveres-til"><dt>${esc(t(DA, 'lev.til'))}</dt><dd>${linjer.map(esc).join('<br>')}</dd></div>`);
  }
  const form = tekst(ordre.levering?.tekst);
  if (form) kv.push(`<div><dt>${esc(t(DA, 'lev.form'))}</dt><dd>${esc(form)}</dd></div>`);
  const besked = udgave === 'u2-med' ? tekst(ordre.besked) : '';
  if (besked) kv.push(`<div data-felt="besked"><dt>${esc(t(DA, 'lev.besked'))}</dt><dd class="fri">${esc(besked)}</dd></div>`);
  if (s.aftalt.length) {
    kv.push(`<div data-felt="aftalt"><dt>${esc(t(DA, 'lev.aftalt'))}</dt><dd>${s.aftalt.map((a) => `<p class="aft fri">${esc(a)}</p>`).join('')}</dd></div>`);
  }
  let skjult = '';
  if (udgave === 'u1' && levering) skjult = `<p class="skjult" data-felt="skjult">${esc(t(DA, 'lev.skjult1'))}</p>`;
  if (udgave === 'u2-uden') {
    const href = loginAdresse(`/ordre/?ref=${ref}`);
    skjult = `<p class="skjult ikke-print" data-felt="skjult">${esc(t(DA, levering ? 'lev.skjult' : 'lev.skjultAfhentning'))} <a class="lnk nob" href="${esc(href)}">${esc(t(DA, 'lev.skjultKnap'))}</a></p>`;
  }
  const aendre = INGEN_VENTER.has(s.nr) ? '' : `<p class="lille">${tHtml(DA, 'lev.aendre')}</p>`;
  return `<h2 class="sec-h">${esc(t(DA, 'lev.h2'))}</h2>${kv.length ? `<dl class="kv">${kv.join('')}</dl>` : ''}${skjult}${aendre}`;
}

/**
 * Hele ordresiden for en betalt/annulleret ordre. → { titel, html, nr }.
 * ordre = OrdreUdenLogin/OrdreMedLogin (kontrakter §5), visning = API'ets svar, udgivelse = 1|2 (build), nu = ISO/ms.
 */
export function renderOrdre({ ordre, visning, udgivelse, nu, designerUrl }) {
  const udgave = udgaveAf(udgivelse, visning);
  const ref = tekst(ordre?.ref);
  const s = tilstand(ordre, nu);
  if (!s) return renderIkkeBetalt(designerUrl);
  const titel = `${t(DA, 'ordre.label', { ref })} · Nem Inventar`;

  const top = (udgave === 'u2-med' ? `<a class="crumb ikke-print" href="/min-side/" data-felt="tilbage"><span aria-hidden="true">←</span> ${esc(t(DA, 'ordre.tilbage'))}</a>` : '')
    + `<p class="label">${esc(t(DA, 'ordre.label', { ref }))}</p>`
    + `<h1 id="ordre-h1" tabindex="-1">${h1Html(s.h1)}</h1>`
    + (s.under ? `<p class="sub">${tekstMedLinks(s.under)}</p>` : '');

  const mens = INGEN_VENTER.has(s.nr) ? ''
    : `<details class="vent ikke-print"><summary>${esc(t(DA, 'forloeb.mens'))}</summary><p>${esc(t(DA, s.form === 'afhentning' ? 'forloeb.mensTekstAfhentning' : 'forloeb.mensTekst'))}</p></details>`;

  const venstre = `<h2 class="sec-h">${esc(t(DA, 'forloeb.h2'))}</h2>${forloebHtml(s)}${mens}${varerHtml(ordre, udgave, designerUrl)}`;

  const betaling = [s.betaling.betalt, s.betaling.refunderet].filter(Boolean).map((x) => `<p class="tekst">${esc(x)}</p>`).join('');
  const vilkaar = s.vilkaar.map((x) => `<p class="tekst">${esc(x)}</p>`).join('')
    + `<p class="tekst"><a class="lnk" href="${SITE}/handelsbetingelser/">${esc(t(DA, 'vilkaar.link'))}</a></p>`;
  const tilbud = udgave === 'u2-uden'
    ? `<div class="kontotilbud ikke-print" data-felt="konto-tilbud"><p>${esc(t(DA, 'konto.tilbud'))}</p><a class="btn btn-ghost btn-s" href="${esc(loginAdresse(`/ordre/?ref=${ref}`))}">${esc(t(DA, 'konto.tilbudKnap'))}</a></div>`
    : '';
  const ikkeMin = udgave === 'u2-med' ? `<div class="ikkemin ikke-print" data-felt="ikke-min">${renderIkkeMin('start')}</div>` : '';

  const hoejre = leveringHtml(ordre, s, udgave, ref)
    + (betaling ? `<h2 class="sec-h">${esc(t(DA, 'bet.h2'))}</h2>${betaling}` : '')
    + `<h2 class="sec-h">${esc(t(DA, 'vilkaar.h2'))}</h2>${vilkaar}`
    + `<h2 class="sec-h">${esc(t(DA, 'hjaelp.h2'))}</h2><p class="tekst">${tHtml(DA, 'hjaelp.tekst', {}, { ref: `<span class="nob">${esc(ref)}</span>` }, { emne: ref })}</p>`
    + tilbud + ikkeMin;

  const html = `<div class="ordre" data-udgave="${udgave}" data-tilstand="${s.nr}" data-ref="${esc(ref)}"${s.delvisRefusion ? ' data-delvis="1"' : ''}>`
    + top
    + `<div class="og"><div class="og-v">${venstre}</div><div class="og-h">${hoejre}</div></div>`
    + `<p class="kun-print saelger">${esc(t(DA, 'varer.saelger'))}</p></div>`;
  return { titel, html, nr: s.nr };
}

// "Er det ikke din bestilling?" (Fable c5): start → spørgsmålet i linjen → fjernet
export function renderIkkeMin(trin) {
  if (trin === 'spoerg') {
    return `<p>${esc(t(DA, 'ikkeMin.spoerg'))}</p><span class="knapper"><button type="button" class="btn btn-primary btn-s" data-handling="ikke-min-ja">${esc(t(DA, 'ikkeMin.ja'))}</button><button type="button" class="btn btn-ghost btn-s" data-handling="ikke-min-fortryd">${esc(t(DA, 'konto.fortryd'))}</button></span>`;
  }
  if (trin === 'fjernet') return `<p class="form-msg ok" role="status">${esc(t(DA, 'ikkeMin.fjernet'))}</p>`;
  if (trin === 'fejl') return `<p class="form-msg err" role="alert">${esc(t(DA, 'side.fejl'))}</p>`;
  return `<span>${esc(t(DA, 'ikkeMin.linje'))}</span><button type="button" class="btn btn-ghost btn-s" data-handling="ikke-min">${esc(t(DA, 'ikkeMin.knap'))}</button>`;
}

export function renderIkkeBetalt(designerUrl) {
  return {
    titel: 'Nem Inventar',
    nr: null,
    html: `<div class="ordre ordre-besked"><h1 id="ordre-h1" tabindex="-1">${esc(t(DA, 'ordre.ikkeBetalt.h1'))}</h1><p class="sub">${esc(t(DA, 'ordre.ikkeBetalt.tekst'))}</p><p class="efter"><a class="btn btn-primary" href="${esc(designerUrl)}">${esc(t(DA, 'ordre.ikkeBetalt.knap'))} <span aria-hidden="true">→</span></a></p></div>`,
  };
}

// Første sætning som overskrift, resten under (begge ordret fra Fable; runde 4 "Fælles for 1–3").
function beskedHtml(s, { loginLink = false } = {}) {
  const [h1, efter] = delOverskrift(s);
  let rest = efter ? tekstMedLinks(efter) : '';
  if (loginLink && rest) {
    rest = rest.replace(/log ind på Min side|log ind(?=\.$)/, (m) => `<a class="lnk" href="/">${m}</a>`);
  }
  return `<div class="ordre ordre-besked"><h1 id="ordre-h1" tabindex="-1">${esc(h1)}</h1>${rest ? `<p class="sub">${rest}</p>` : ''}</div>`;
}

/** Fejlene fra /api/ordre og /api/ordre-ref (kontrakter §6) → { titel, html }. */
export function renderOrdreFejl(fejl, udgivelse) {
  const u2 = Number(udgivelse) === 2;
  let noegle;
  if (fejl === 'ukendt') noegle = u2 ? 'ordre.ikkeFundet' : 'ordre.ikkeFundet1';
  else if (fejl === 'erstattet') noegle = u2 ? 'ordre.erstattet' : 'ordre.erstattet1';
  else if (fejl === 'lukket') noegle = 'ordre.lukket';   // egen nøgle: udgivelse 1 må ikke nævne Min side (runde 4, 2)
  else noegle = 'ordre.nede';   // nede, loft, netværk, ukendt svar
  return { titel: 'Nem Inventar', nr: null, fejl, html: beskedHtml(t(DA, noegle), { loginLink: u2 && (fejl === 'ukendt' || fejl === 'erstattet') }) };
}
