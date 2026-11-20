// /ordre/ — ordresiden (Fable e, d4). Gangen står i lib/ordre-start.mjs (R10: nøglen fjernes fra adressen før alt andet).
import { cfg, api, spor, lager, SESSION, vis } from './faelles.js';
import { koerOrdre } from '../lib/ordre-start.mjs';
import { renderIkkeMin } from '../lib/ordre-visning.mjs';
import { loginAdresse } from '../lib/adresser.mjs';

const rod = document.getElementById('rod');
const NOEGLE = 'ni-ordre-noegle';
// Nøglen huskes også i fanen her (uden sessionStorage, fx i et privat vindue), så "Prøv igen" kan hente bestillingen igen
let iHukommelse = null;
let spores = true;

function hent({ hash, search }) {
  return koerOrdre({
    hash,
    search,
    pathname: location.pathname,
    udgivelse: cfg.udgivelse,
    designerUrl: cfg.designerUrl,
    nu: () => Date.now(),
    rydAdresse: (url) => history.replaceState(history.state, '', url),
    husk: {
      hent: () => lager.hent(NOEGLE) ?? iHukommelse,
      gem: (n) => { iHukommelse = n; lager.gem(NOEGLE, n); },
      glem: () => { iHukommelse = null; lager.slet(NOEGLE); },
    },
    sporing: () => { if (spores) spor(); spores = false; },   // én sidevisning, også når "Prøv igen" henter igen
    api,
    vis: ({ titel, html }) => {
      document.title = titel;
      vis(rod, html);
    },
    tilLogin: (url) => location.assign(url),
    harHaftSession: () => lager.hent(SESSION) === '1',
  });
}

hent({ hash: location.hash, search: location.search });

// Et nyt fragment på samme side (fx et link til en anden bestilling) læses forfra
window.addEventListener('hashchange', () => location.reload());

// "Udskriv" (Fable b): print-stylesheetet skjuler header, footer og login-rækker; "Mål og indretning" foldes ud
const aabnede = [];
window.addEventListener('beforeprint', () => {
  rod.querySelectorAll('details[data-print-aaben]:not([open])').forEach((d) => { d.open = true; aabnede.push(d); });
});
window.addEventListener('afterprint', () => { while (aabnede.length) aabnede.pop().open = false; });

rod.addEventListener('click', async (e) => {
  const knap = e.target instanceof Element ? e.target.closest('[data-handling]') : null;
  if (!knap) return;
  const boks = knap.closest('[data-felt="ikke-min"]');
  const ref = rod.querySelector('.ordre')?.dataset.ref ?? '';
  switch (knap.dataset.handling) {
    case 'udskriv':
      window.print();
      break;
    case 'igen':
      // "Prøv igen" (Fable port 3, nr. 24): hent bestillingen igen — adressen bærer ikke længere nøglen (R10)
      e.preventDefault();
      rod.setAttribute('aria-busy', 'true');
      hent({ hash: location.hash, search: location.search });
      break;
    case 'ikke-min':
      boks.innerHTML = renderIkkeMin('spoerg');
      boks.querySelector('button')?.focus();
      break;
    case 'ikke-min-fortryd':
      boks.innerHTML = renderIkkeMin('start');
      boks.querySelector('button')?.focus();
      break;
    case 'ikke-min-ja': {
      knap.disabled = true;
      const r = await api('/ikke-min', { ref });
      if (r.status === 401) {
        lager.slet(SESSION);
        location.assign(loginAdresse(`/ordre/?ref=${ref}`, { udloebet: true }));
        return;
      }
      boks.innerHTML = renderIkkeMin(r.data?.ok ? 'fjernet' : 'fejl');
      break;
    }
    default:
      break;
  }
});
