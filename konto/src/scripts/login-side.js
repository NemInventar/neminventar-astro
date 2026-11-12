// / og /en/ — log ind eller opret konto (Fable c1, d1, d2). To trin på samme side: e-mail → kode.
// Turnstile kører usynligt (interaction-only) og først ved "Send kode"/"Send en ny kode" (plan-teknik §2: fejler lukket).
import { cfg, api, spor, lager, SESSION, BESKED } from './faelles.js';
import {
  renderEmailVenstre, renderEmailForm, renderKodeVenstre, renderKodeForm, renderLoginLukket, fejlBesked, beskedHtml,
} from '../lib/login-visning.mjs';
import { sikkerRetur, minSideAdresse } from '../lib/adresser.mjs';
import { t } from '../lib/tekst.mjs';

const sp = cfg.sprog;
const VENT_SEK = 30;                               // Fable c1: ny kode, knappen er låst i 30 sekunder
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;     // Workeren tjekker grundigt (normEmail); her kun det åbenlyse
const TURNSTILE_JS = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const venstre = document.querySelector('[data-venstre]');
const hoejre = document.querySelector('[data-hoejre]');
const tsEl = document.getElementById('konto-ts');   // ikke id="turnstile": så peger window.turnstile på elementet

let email = '';
let retur = null;
let nedtaelling = null;

// ---------- Turnstile ----------
let tsHent = null;
let widget = null;
let venter = null;
function hentTurnstile() {
  tsHent ??= new Promise((ok, nej) => {
    const har = () => typeof window.turnstile?.render === 'function';
    if (har()) { ok(window.turnstile); return; }
    const s = document.createElement('script');
    s.src = TURNSTILE_JS;
    s.async = true;
    s.onload = () => (har() ? ok(window.turnstile) : nej(new Error('turnstile')));
    s.onerror = () => { tsHent = null; nej(new Error('turnstile')); };
    document.head.appendChild(s);
  });
  return tsHent;
}
async function turnstileToken() {
  const ts = await hentTurnstile();
  return new Promise((ok, nej) => {
    const ur = setTimeout(() => { venter = null; nej(new Error('tid')); }, 60_000);
    venter = {
      ok: (tok) => { clearTimeout(ur); venter = null; ok(tok); },
      nej: () => { clearTimeout(ur); venter = null; nej(new Error('turnstile')); },
    };
    try {
      if (widget === null) {
        widget = ts.render(tsEl, {
          sitekey: cfg.turnstile,
          action: 'konto-kode',
          appearance: 'interaction-only',
          execution: 'execute',
          language: sp,
          callback: (tok) => venter?.ok(tok),
          'error-callback': () => { venter?.nej(); return true; },
          'expired-callback': () => {},
          'timeout-callback': () => venter?.nej(),
        });
      } else {
        ts.reset(widget);
      }
      ts.execute(widget);
    } catch {
      venter?.nej();
    }
  });
}

// ---------- beskeder ----------
function besked(form, liste, slags = 'err') {
  const el = form.querySelector('[data-besked]');
  el.className = `form-msg ${slags}`;
  el.innerHTML = beskedHtml(sp, liste);
  el.hidden = false;
}
function rydBesked(form) {
  const el = form.querySelector('[data-besked]');
  el.hidden = true;
  el.textContent = '';
  form.querySelector('[data-besked-start]')?.remove();
}
function knapTekst(knap, noegle) {
  knap.querySelector('[data-knap]').textContent = t(sp, noegle);
}

// ---------- trin 1: e-mail ----------
function visEmail(startBesked = null) {
  stopNedtaelling();
  venstre.innerHTML = renderEmailVenstre(sp);
  hoejre.innerHTML = renderEmailForm(sp, { email, besked: startBesked });
  const form = hoejre.querySelector('form');
  form.addEventListener('submit', (e) => { e.preventDefault(); sendKode(form, false); });
}

async function sendKode(form, ny) {
  const felt = form.querySelector('#email');
  if (!ny) {
    email = felt.value.trim();
    rydBesked(form);
    if (!EMAIL.test(email)) {
      felt.setAttribute('aria-invalid', 'true');
      besked(form, fejlBesked('email'));
      felt.focus();
      return;
    }
    felt.removeAttribute('aria-invalid');
  }
  const knap = ny ? form.querySelector('[data-handling="ny-kode"]') : form.querySelector('button[type="submit"]');
  knap.disabled = true;
  if (!ny) knapTekst(knap, 'login.sender');
  let token;
  try {
    token = await turnstileToken();
  } catch {
    besked(form, fejlBesked('robot'));
    knap.disabled = false;
    if (!ny) knapTekst(knap, 'login.knap');
    return;
  }
  const body = { email, turnstile: token, formaal: 'log_ind', sprog: sp };
  if (retur) body.retur = retur;
  const r = await api('/kode', body);
  if (r.data?.ok) {
    if (ny) {
      rydBesked(form);
      besked(form, [{ noegle: 'kode.nySendt' }], 'ok');
      gorLogIndTilHovedknap(form, true);
      startNedtaelling(form);
      form.querySelector('#kode').value = '';
      form.querySelector('#kode').focus();
    } else {
      visKode();
    }
    return;
  }
  besked(form, fejlBesked(r.data?.fejl));
  if (ny) {
    knap.disabled = false;
  } else {
    knap.disabled = false;
    knapTekst(knap, 'login.knap');
  }
}

// ---------- trin 2: koden ----------
function visKode() {
  venstre.innerHTML = renderKodeVenstre(sp, email);
  hoejre.innerHTML = renderKodeForm(sp, { sek: VENT_SEK });
  const form = hoejre.querySelector('form');
  form.addEventListener('submit', (e) => { e.preventDefault(); tjekKode(form); });
  form.querySelector('[data-handling="ny-kode"]').addEventListener('click', () => sendKode(form, true));
  venstre.querySelector('[data-handling="ret"]').addEventListener('click', () => {
    visEmail();
    const felt = hoejre.querySelector('#email');
    felt.focus();
    felt.select();
  });
  startNedtaelling(form);
  form.querySelector('#kode').focus();
}

// "Send en ny kode" bliver hovedknap, når koden er spærret eller udløbet (Fable c1)
function gorLogIndTilHovedknap(form, logInd) {
  const logIndKnap = form.querySelector('[data-log-ind]');
  const ny = form.querySelector('[data-handling="ny-kode"]');
  logIndKnap.classList.toggle('btn-primary', logInd);
  logIndKnap.classList.toggle('btn-ghost', !logInd);
  ny.classList.toggle('lnk', logInd);
  ny.classList.toggle('knap-lnk', logInd);
  ny.classList.toggle('btn', !logInd);
  ny.classList.toggle('btn-primary', !logInd);
}

function stopNedtaelling() {
  if (nedtaelling) clearInterval(nedtaelling);
  nedtaelling = null;
}
function startNedtaelling(form) {
  stopNedtaelling();
  const vent = form.querySelector('[data-vent]');
  const ny = form.querySelector('[data-handling="ny-kode"]');
  const klar = form.querySelector('[data-ny-klar]');
  const slut = Date.now() + VENT_SEK * 1000;
  klar.textContent = '';
  ny.disabled = true;
  vent.hidden = false;
  const tik = () => {
    const n = Math.ceil((slut - Date.now()) / 1000);
    if (n > 0) { vent.textContent = t(sp, 'kode.vent', { n }); return; }
    stopNedtaelling();
    vent.hidden = true;
    ny.disabled = false;
    klar.textContent = t(sp, 'kode.nyKlar');   // én besked til skærmlæseren, når knappen bliver aktiv
  };
  tik();
  nedtaelling = setInterval(tik, 1000);
}

async function tjekKode(form) {
  const felt = form.querySelector('#kode');
  const knap = form.querySelector('[data-log-ind]');
  rydBesked(form);
  const kode = felt.value.replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(kode)) {
    besked(form, fejlBesked('kort'));
    felt.focus();
    return;
  }
  knap.disabled = true;
  knapTekst(knap, 'kode.tjekker');
  const r = await api('/kode/tjek', { email, kode });
  if (r.data?.ok) {
    lager.gem(SESSION, '1');
    const til = sikkerRetur(r.data.retur, location.origin) ?? sikkerRetur(retur, location.origin);
    location.assign(til ?? `${minSideAdresse(sp)}${r.data.ny ? '?ny=1' : ''}`);
    return;
  }
  knap.disabled = false;
  knapTekst(knap, 'kode.knap');
  const fejl = r.data?.fejl;
  besked(form, fejlBesked(fejl, { tilbage: r.data?.tilbage }));
  if (fejl === 'forkert' || fejl === 'kort') {
    felt.value = '';
    felt.focus();
  } else if (fejl === 'laast' || fejl === 'udloebet') {
    gorLogIndTilHovedknap(form, false);
    const ny = form.querySelector('[data-handling="ny-kode"]');
    if (!ny.disabled) ny.focus();
  } else if (fejl === 'doegn') {
    knap.disabled = true;
    form.querySelector('[data-handling="ny-kode"]').disabled = true;
    stopNedtaelling();
  }
}

// ---------- start ----------
async function start() {
  const q = new URLSearchParams(location.search);
  // ?lang=en (fx fra den engelske designer) → /en/ (Fable b nr. 4)
  if (sp === 'da' && q.get('lang') === 'en') {
    q.delete('lang');
    location.replace(`/en/${q.toString() ? `?${q}` : ''}`);
    return;
  }
  retur = sikkerRetur(q.get('retur'), location.origin);
  const udloebet = q.get('udloebet') === '1';
  if (location.search) history.replaceState(history.state, '', location.pathname);
  spor();

  let startBesked = null;
  const gemt = lager.hent(BESKED);
  if (gemt) {
    lager.slet(BESKED);
    try {
      const b = JSON.parse(gemt);
      if (b && typeof b.noegle === 'string' && /^login\.(loggetUd|loggetUdAlle|slettet)$/.test(b.noegle)) {
        startBesked = { noegle: b.noegle, vars: b.vars ?? {}, slags: 'ok' };
      }
    } catch { /* ugyldig */ }
  }
  if (!startBesked && udloebet) startBesked = { noegle: 'login.udloebet', slags: 'ok' };

  const mig = await api('/mig');
  if (mig.data?.logget_ind === true) {
    location.replace(retur ?? minSideAdresse(sp));
    return;
  }
  if (mig.data?.konto_aktiv === false || mig.data?.fejl === 'lukket') {
    venstre.innerHTML = renderLoginLukket(sp);
    hoejre.innerHTML = '';
    return;
  }
  visEmail(startBesked);
  hentTurnstile().catch(() => {});   // scriptet hentes nu; selve tjekket kører først ved "Send kode"
}

start();
