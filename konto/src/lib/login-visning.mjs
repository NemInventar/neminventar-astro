// Log ind (Fable d1) og kode-trinnet (d2) som HTML. Samme side, to trin (c1): e-mail → "Skriv koden fra mailen".
// Venstre spalte = overskrift og forklaring, højre = formularen. Turnstile-widgetten bor uden for begge (login-side.js).
import { t, tHtml, esc, fedOgRest, medPolitikLink, sprogAf, delOverskrift, tekstMedLinks } from './tekst.mjs';

// Fable c3 + beslutning 11 (kontrakter linje 3: ja) — et gem med login giver en henvendelse, så noten nævner tilbuddet.
export const NOTE_NOEGLE = 'login.noteLead';

export function renderEmailVenstre(sprog) {
  const sp = sprogAf(sprog);
  const raekke = (k) => { const { fed, rest } = fedOgRest(t(sp, k)); return `<div><b>${esc(fed)}</b><span>${esc(rest)}</span></div>`; };
  return `<p class="label">${esc(t(sp, 'login.label'))}</p>`
    + `<h1 id="login-h1" tabindex="-1">${esc(t(sp, 'login.h1'))}</h1>`
    + `<p class="lede">${esc(t(sp, 'login.lede'))}</p>`
    + `<div class="hvad">${raekke('login.raekke1')}${raekke('login.raekke2')}</div>`
    + `<p class="uden">${esc(t(sp, 'login.uden'))}</p>`;
}

// besked = {noegle, vars, slags: 'ok'|'err'} — en bekræftelse (logget ud, slettet) eller "du er blevet logget ud"
export function renderEmailForm(sprog, { email = '', besked = null } = {}) {
  const sp = sprogAf(sprog);
  const b = besked ? `<p class="form-msg ${besked.slags === 'err' ? 'err' : 'ok'}" role="status" data-besked-start>${tHtml(sp, besked.noegle, besked.vars ?? {})}</p>` : '';
  return `<form class="form" data-trin="email" novalidate>${b}`
    + `<div class="field"><label for="email">${esc(t(sp, 'login.email'))}</label>`
    + `<input id="email" name="email" type="email" autocomplete="email" inputmode="email" spellcheck="false" autocapitalize="off" maxlength="254" value="${esc(email)}" aria-describedby="email-hj">`
    + `<small id="email-hj">${esc(t(sp, 'login.emailHjaelp'))}</small></div>`
    + `<button class="btn btn-primary" type="submit"><span data-knap>${esc(t(sp, 'login.knap'))}</span> <span aria-hidden="true">→</span></button>`
    + '<p class="form-msg err" role="alert" data-besked hidden></p>'
    + `<p class="form-note">${medPolitikLink(esc(t(sp, NOTE_NOEGLE)), sp)}</p>`
    + '</form>';
}

export function renderKodeVenstre(sprog, email) {
  const sp = sprogAf(sprog);
  return `<p class="label">${esc(t(sp, 'login.label'))}</p>`
    + `<h1 id="login-h1" tabindex="-1">${esc(t(sp, 'kode.h1'))}</h1>`
    + `<p class="lede">${tHtml(sp, 'kode.lede', {}, { email: `<b class="email">${esc(email)}</b>` })} `
    + `<button type="button" class="lnk knap-lnk nob" data-handling="ret">${esc(t(sp, 'kode.ret'))}</button></p>`;
}

export function renderKodeForm(sprog, { sek = 30 } = {}) {
  const sp = sprogAf(sprog);
  return '<form class="form" data-trin="kode" novalidate>'
    + `<div class="field"><label for="kode">${esc(t(sp, 'kode.felt'))}</label>`
    + '<input id="kode" name="kode" class="kode" inputmode="numeric" autocomplete="one-time-code" maxlength="11" spellcheck="false" aria-describedby="kode-hj"></div>'
    + `<button class="btn btn-primary" type="submit" data-log-ind><span data-knap>${esc(t(sp, 'kode.knap'))}</span> <span aria-hidden="true">→</span></button>`
    + '<p class="form-msg err" role="alert" data-besked hidden></p>'
    + `<p class="form-note" id="kode-hj">${esc(t(sp, 'kode.hjaelp'))}</p>`
    + `<div class="igen"><span data-vent>${esc(t(sp, 'kode.vent', { n: sek }))}</span>`
    + `<button type="button" class="lnk knap-lnk" data-handling="ny-kode" disabled>${esc(t(sp, 'kode.ny'))}</button></div>`
    + '<p class="sr" role="status" data-ny-klar></p>'
    + '</form>';
}

// Flaget er fra (503 lukket). Første sætning som overskrift, resten brødtekst under den (Fable runde 4, "Fælles for 1–3").
export function renderLoginLukket(sprog) {
  const sp = sprogAf(sprog);
  const [h1, rest] = delOverskrift(t(sp, 'lukket'));
  return `<p class="label">${esc(t(sp, 'login.label'))}</p><h1 id="login-h1" tabindex="-1">${esc(h1)}</h1>`
    + (rest ? `<p class="lede">${tekstMedLinks(rest)}</p>` : '');
}

/**
 * Svar fra /api/kode og /api/kode/tjek (kontrakter §6, Workeren konto/worker) → {noegle, vars} til beskedfeltet.
 * Fable c1: forkert kode viser antal forsøg tilbage fra tredje forkerte forsøg (5 pr. kode → tilbage ≤ 2).
 */
export function fejlBesked(fejl, { tilbage } = {}) {
  switch (fejl) {
    case 'email': return [{ noegle: 'login.fejlEmail' }];
    case 'loft': return [{ noegle: 'login.fejlLoft' }];
    case 'doegn': return [{ noegle: 'login.fejlDoegn' }];
    case 'robot': return [{ noegle: 'login.fejlRobot' }];
    case 'kort': return [{ noegle: 'kode.kort' }];
    case 'forkert': return Number.isInteger(tilbage) && tilbage <= 2 && tilbage > 0
      ? [{ noegle: 'kode.forkert' }, { noegle: 'kode.forsoegTilbage', vars: { n: tilbage } }]
      : [{ noegle: 'kode.forkert' }];
    case 'laast': return [{ noegle: 'kode.spaerret' }];
    case 'udloebet': return [{ noegle: 'kode.udloebet' }];
    case 'lukket': return [{ noegle: 'lukket' }];
    default: return [{ noegle: 'login.fejl' }];   // mail (Graph nede), nede, netværk — Fable c1 "Netværksfejl"
  }
}

export const beskedHtml = (sprog, liste) => liste.map((b) => tHtml(sprogAf(sprog), b.noegle, b.vars ?? {})).join(' ');
