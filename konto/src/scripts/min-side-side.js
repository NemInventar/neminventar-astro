// /min-side/ og /en/min-side/ — Fable b ("Min side"), c3–c7, d3.
import { cfg, api, spor, lager, SESSION, BESKED, vis, fokusVedFoldUd } from './faelles.js';
import {
  renderMinSide, renderMinSideFejl, renderLogUdAlle, renderSletTrin, renderDesignSvar,
} from '../lib/min-side-visning.mjs';
import { fejlBesked, beskedHtml } from '../lib/login-visning.mjs';
import { loginAdresse, minSideAdresse } from '../lib/adresser.mjs';
import { t } from '../lib/tekst.mjs';

const sp = cfg.sprog;
const rod = document.getElementById('rod');
const forside = sp === 'en' ? '/en/' : '/';
let email = '';

function udloebet() {
  lager.slet(SESSION);
  location.assign(loginAdresse(minSideAdresse(sp), { sprog: sp, udloebet: true }));
}

function tilLogInd(noegle, vars) {
  lager.slet(SESSION);
  lager.gem(BESKED, JSON.stringify({ noegle, vars }));
  location.assign(forside);
}

function sideFejl() {
  const el = rod.querySelector('[data-side-besked]');
  el.innerHTML = `<p class="form-msg err" role="alert">${beskedHtml(sp, [{ noegle: 'side.fejl' }])}</p>`;
}

async function logUd(alle) {
  const r = await api('/log-ud', alle ? { alle: true } : {});
  if (r.status === 0 || r.status >= 500) { sideFejl(); return; }
  tilLogInd(alle ? 'login.loggetUdAlle' : 'login.loggetUd');
}

// ---------- slet konto (Fable c6) ----------
const sletBesked = () => rod.querySelector('[data-slet-besked]');
function visSletFejl(liste) {
  const el = sletBesked();
  el.innerHTML = beskedHtml(sp, liste);
  el.hidden = false;
}

async function sendSletKode(knap) {
  knap.disabled = true;
  sletBesked().hidden = true;
  const r = await api('/slet/kode', {});
  if (r.status === 401) { udloebet(); return; }
  if (r.data?.ok) {
    const trin = rod.querySelector('[data-slet-trin]');
    trin.innerHTML = renderSletTrin('kode', sp);
    trin.querySelector('#slet-kode').focus();
    return;
  }
  knap.disabled = false;
  visSletFejl(fejlBesked(r.data?.fejl));
}

async function sletKonto(knap) {
  const felt = rod.querySelector('#slet-kode');
  const kode = felt.value.replace(/[\s-]/g, '');
  sletBesked().hidden = true;
  if (!/^\d{6}$/.test(kode)) { visSletFejl(fejlBesked('kort')); felt.focus(); return; }
  knap.disabled = true;
  const r = await api('/slet', { kode });
  if (r.status === 401) { udloebet(); return; }
  if (r.data?.ok) { tilLogInd('login.slettet', { email }); return; }
  knap.disabled = false;
  visSletFejl(fejlBesked(r.data?.fejl, { tilbage: r.data?.tilbage }));
  if (r.data?.fejl === 'forkert') { felt.value = ''; felt.focus(); }
}

// ---------- designs ----------
async function sletDesign(raekke) {
  const uden = raekke.dataset.slags === 'uden';
  const id = raekke.dataset.design;
  const r = await api(uden ? '/gemt-uden-login/skjul' : '/design/slet', { id: uden && /^\d+$/.test(id) ? Number(id) : id });
  if (r.status === 401) { udloebet(); return; }
  if (!r.data?.ok) { raekke.querySelector('[data-svar]').innerHTML = renderDesignSvar('fejl', sp); return; }
  const tabel = raekke.closest('section');
  raekke.remove();
  const el = tabel.querySelector('[data-design-besked]');
  el.textContent = t(sp, 'design.slettet');
  el.hidden = false;
  tabel.querySelector('h2').focus();
}

async function kopier(raekke) {
  const svar = raekke.querySelector('[data-svar]');
  const link = raekke.dataset.kopi;
  try {
    await navigator.clipboard.writeText(link);
    svar.innerHTML = renderDesignSvar('kopieret', sp);
  } catch {
    // Udklipsholderen er lukket (fx gammel browser): linket står markeret i et felt, så det kan kopieres i hånden
    svar.innerHTML = `<input class="kopi" type="text" readonly aria-label="${t(sp, 'design.link')}">`;
    const felt = svar.querySelector('input');
    felt.value = link;
    felt.focus();
    felt.select();
  }
}

async function omdoeb(form) {
  const raekke = form.closest('tr[data-design]');
  const navn = form.querySelector('input').value.replace(/\s+/g, ' ').trim();
  if (!navn) { form.querySelector('input').focus(); return; }
  form.querySelector('button').disabled = true;
  const r = await api('/design/navn', { id: raekke.dataset.design, navn });
  if (r.status === 401) { udloebet(); return; }
  if (!r.data?.ok) { raekke.querySelector('[data-svar]').innerHTML = renderDesignSvar('fejl', sp); return; }
  raekke.dataset.navn = navn;
  raekke.querySelector('.d-navn').textContent = navn;
  raekke.querySelector('[data-svar]').innerHTML = '';
  raekke.querySelector('details summary')?.focus();
}

// ---------- start ----------
async function start() {
  const ny = new URLSearchParams(location.search).get('ny') === '1';
  if (location.search) history.replaceState(history.state, '', location.pathname);
  spor();
  const r = await api('/min-side');
  if (r.status === 401) {
    const havde = lager.hent(SESSION) === '1';
    lager.slet(SESSION);
    location.replace(loginAdresse(minSideAdresse(sp), { sprog: sp, udloebet: havde }));
    return;
  }
  if (!r.data || typeof r.data.email !== 'string') {
    vis(rod, renderMinSideFejl(r.data?.fejl, sp));
    return;
  }
  lager.gem(SESSION, '1');
  email = r.data.email;
  vis(rod, renderMinSide({ data: r.data, sprog: sp, nu: Date.now(), designerUrl: cfg.designerUrl, ny }));
}

fokusVedFoldUd(rod);

rod.addEventListener('submit', (e) => {
  const form = e.target instanceof Element ? e.target.closest('form[data-omdoeb]') : null;
  if (!form) return;
  e.preventDefault();
  omdoeb(form);
});

rod.addEventListener('click', (e) => {
  const knap = e.target instanceof Element ? e.target.closest('[data-handling]') : null;
  if (!knap) return;
  const raekke = knap.closest('tr[data-design]');
  const svar = raekke?.querySelector('[data-svar]');
  const alle = rod.querySelector('[data-rk="alle"]');
  switch (knap.dataset.handling) {
    case 'log-ud': knap.disabled = true; logUd(false); break;
    case 'log-ud-alle':
      alle.innerHTML = renderLogUdAlle('spoerg', sp);
      alle.querySelector('button').focus();
      break;
    case 'log-ud-alle-fortryd':
      alle.innerHTML = renderLogUdAlle('start', sp);
      alle.querySelector('button').focus();
      break;
    case 'log-ud-alle-ja': knap.disabled = true; logUd(true); break;
    case 'slet-kode': sendSletKode(knap); break;
    case 'slet-ja': sletKonto(knap); break;
    case 'slet-fortryd': {
      const trin = rod.querySelector('[data-slet-trin]');
      trin.innerHTML = renderSletTrin('start', sp);
      sletBesked().hidden = true;
      trin.querySelector('button').focus();
      break;
    }
    case 'omdoeb':
      svar.innerHTML = renderDesignSvar('omdoeb', sp, { navn: raekke.dataset.navn });
      svar.querySelector('input').focus();
      break;
    case 'kopier': kopier(raekke); break;
    case 'slet-design':
      svar.innerHTML = renderDesignSvar('slet', sp, { navn: raekke.dataset.navn });
      svar.querySelector('button').focus();
      break;
    case 'slet-design-ja': knap.disabled = true; sletDesign(raekke); break;
    case 'slet-design-nej':
      svar.innerHTML = '';
      raekke.querySelector('[data-handling="slet-design"]').focus();
      break;
    default: break;
  }
});

start();
