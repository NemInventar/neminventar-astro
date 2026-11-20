// Skærmbilleder af konto.neminventar.dk mod den lokale fake-API (konto/scripts/fake-api.mjs), bygget i BEGGE udgivelser
// (byg() sætter KONTO_UDGIVELSE=1 og =2): alle 16 tilstande på ordresiden (+ Fables runde 4-varianter) i udgivelse 1 og i
// udgivelse 2 uden og med login, log ind, koden, Min side, slet konto, siderne med runde 4-teksterne (nede, lukket, 404,
// side.fejl, statuskolonnen, engelsk noscript) — ved 1440 og 375 px, hver som synligt vindue og som hele siden. Fable port 3
// (12-11-2026) bad også om: "Mål og indretning" foldet ud på tre ordrer og en rigtig udskrift til PDF, Gemte designs med
// miniaturer, headeren ved 1181/1280/1366 px (målt: "Få en pris" mod rammen) og 320/360 px på log ind, Min side og
// ordresiden (målt: vandret scroll). Et synligt vindue kan rulles til handlingen (sk.rul). Undervejs:
//   - axe-core på hver side (1440 px): WCAG 2.0/2.1/2.2 A+AA + best practice
//   - konsolfejl (fx CSP-afvisninger: siden kører med sine egne _headers); HTTP-fejlsvar tælles for sig
//   - R10: ingen netværksadresse og intet Plausible-kald bærer statusnøglen
// Ud: C:\tmp\kundelogin\konto-skaermbilleder\ (eller KONTO_SKAERM_UD) med kontaktarket index.html og resultat.json.
// Filerne: <id>-<bredde>.png (hele siden) og <id>-<bredde>-synligt.png (vinduet).
// Playwright og axe-core hentes fra KONTO_VAERKTOEJ (standard C:\tmp\kundelogin\vaerktoej, `npm i playwright axe-core`).
//   node konto/scripts/skaermbilleder.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { byg, ROD } from './byg.mjs';
import { startFake, tilstandsNoegle, noegle } from './fake-api.mjs';
import { TILSTANDE, VARIANTER, UGE_VARIANTER, MAAL_VARIANTER, EMAIL, MIN_SIDE_STATUS_NU } from '../test/fixtures.mjs';

const UD = process.env.KONTO_SKAERM_UD || 'C:/tmp/kundelogin/konto-skaermbilleder';
const VAERKTOEJ = process.env.KONTO_VAERKTOEJ || 'C:/tmp/kundelogin/vaerktoej';
const { chromium } = await import(pathToFileURL(path.join(VAERKTOEJ, 'node_modules/playwright/index.mjs')).href);
const AXE = readFileSync(path.join(VAERKTOEJ, 'node_modules/axe-core/axe.min.js'), 'utf8');
// Bredderne. Standard: 1440 og 375. Fable port 3 bad også om 320 og 360 (telefoner) og 1181, 1280 og 1366 (headeren lige over
// menuknappens grænse på 1180 px) — de skærme, der skal have dem, siger det selv (sk.bredder).
const BREDDE = {
  1440: { navn: '1440', width: 1440, height: 900 }, 1366: { navn: '1366', width: 1366, height: 768 }, 1280: { navn: '1280', width: 1280, height: 800 },
  1181: { navn: '1181', width: 1181, height: 800 }, 375: { navn: '375', width: 375, height: 812 }, 360: { navn: '360', width: 360, height: 780 },
  320: { navn: '320', width: 320, height: 568 },
};
const STD = ['1440', '375'];
const BREDDE_ORDEN = ['1440', '1366', '1280', '1181', '375', '360', '320'];
const NU = '2026-11-12T10:00:00.000Z';

const TURNSTILE_STUB = `window.turnstile={_o:null,render:function(el,o){this._o=o;return 'w1'},execute:function(){var o=this._o;setTimeout(function(){o.callback('fake-token')},20)},reset:function(){},getResponse:function(){return 'fake-token'}};`;

// ---------- skærmene ----------
const vent = (p, sel) => p.waitForSelector(sel, { state: 'attached', timeout: 10_000 });
const klar = (p) => p.waitForSelector('#rod:not([aria-busy])', { timeout: 10_000 });
const SKAERME = [];
const s = (x) => SKAERME.push(x);

// De 16 tilstande (Fable runde 3 e) + Fables runde 4-varianter (afsnit 6: afhentning, ugen gået; afsnit 7: annulleret uden
// registreret tilbageførsel). nr = tallet i nøglen (16 tilstande) eller variantens id.
const ALLE = [
  ...TILSTANDE.map((t) => ({ nr: t.nr, kort: String(t.nr), lang: String(t.nr).padStart(2, '0'), navn: `${t.nr}. ${t.navn}`, nu: t.nu })),
  ...VARIANTER.map((v) => ({ nr: v.id, kort: v.id, lang: v.id, navn: `${v.nr}. ${v.navn}`, nu: v.nu })),
];
const U1 = 'Udgivelse 1 · ';
const U2 = 'Udgivelse 2 · ';
for (const t of ALLE) {
  s({ id: `ordre-u1-t${t.lang}`, gruppe: `${U1}Ordresiden — alle tilstande (Fable e + runde 4, afsnit 6–7)`, titel: t.navn, server: 'u1', nu: t.nu, sti: `/ordre/#${tilstandsNoegle(t.nr, 'uden_login')}`, noegle: tilstandsNoegle(t.nr, 'uden_login'), efter: klar });
}
for (const t of ALLE) {
  s({ id: `ordre-u2uden-t${t.kort}`, gruppe: `${U2}Ordresiden uden login — alle tilstande (afhentning: lev.skjultAfhentning, runde 4, 11)`, titel: `${t.navn} — uden login`, server: 'u2', nu: t.nu, sti: `/ordre/#${tilstandsNoegle(t.nr, 'uden_login')}`, noegle: tilstandsNoegle(t.nr, 'uden_login'), efter: klar });
}
for (const t of ALLE) {
  s({ id: `ordre-u2med-t${t.kort}`, gruppe: `${U2}Ordresiden med login — alle tilstande`, titel: `${t.navn} — med login`, server: 'u2', nu: t.nu, sti: `/ordre/#${tilstandsNoegle(t.nr, 'med_login')}`, noegle: tilstandsNoegle(t.nr, 'med_login'), session: true, efter: klar });
}
s({ id: 'ordre-u2med-ref', gruppe: `${U2}Ordresiden fra Min side`, titel: 'Fra Min side: #NI-1D078A14 (med login)', server: 'u2', nu: TILSTANDE[2].nu, sti: '/ordre/#NI-1D078A14', session: true, efter: klar });
s({ id: 'ordre-ikke-min', gruppe: `${U2}Ordresiden fra Min side`, titel: '"Er det ikke din bestilling?" trykket (c5) — synligt vindue rullet til spørgsmålet', server: 'u2', nu: TILSTANDE[2].nu, sti: `/ordre/#${tilstandsNoegle(3, 'med_login')}`, session: true, rul: '[data-felt="ikke-min"]',
  efter: async (p) => { await klar(p); await p.click('[data-handling="ikke-min"]'); await vent(p, '[data-handling="ikke-min-ja"]'); } });

// ---------- Fable port 3 ----------
const P3 = 'Fable port 3 · ';
// nr. 1: overskriften med de længste uger på smalle telefoner (tilstand 3 og 11 og ordrer i uge 49 og 53)
for (const v of [
  { kort: 't03', titel: 'Tilstand 3: uge 51', n: tilstandsNoegle(3, 'uden_login'), nu: TILSTANDE[2].nu },
  { kort: 't11', titel: 'Tilstand 11: afhentning i uge 51', n: tilstandsNoegle(11, 'uden_login'), nu: TILSTANDE[10].nu },
  ...UGE_VARIANTER.map((u) => ({ kort: u.id, titel: u.navn, n: tilstandsNoegle(u.id, 'uden_login'), nu: u.nu })),
]) {
  s({ id: `smal-ordre-${v.kort}`, gruppe: `${P3}nr. 1 — overskriften med ugen ved 320, 360 og 375 px (udgivelse 1)`, titel: v.titel, server: 'u1', nu: v.nu, sti: `/ordre/#${v.n}`, noegle: v.n, efter: klar, bredder: ['375', '360', '320'] });
}
// nr. 11: "Mål og indretning" foldet ud på tre forskellige ordrer (designerens egen beskrivelse) og en rigtig udskrift til PDF
for (const v of MAAL_VARIANTER) {
  const n = tilstandsNoegle(v.id, 'uden_login');
  s({ id: `maal-${v.id}`, gruppe: `${P3}nr. 11 — "Mål og indretning" foldet ud (tre ordrer)`, titel: `${v.navn} — synligt vindue rullet til afsnittet`, server: 'u1', nu: v.nu, sti: `/ordre/#${n}`, noegle: n, rul: '[data-felt="maal"]',
    efter: async (p) => { await klar(p); await p.click('[data-felt="maal"] summary'); await vent(p, 'details[data-felt="maal"][open]'); } });
}
s({ id: 'maal-udskrift', gruppe: `${P3}nr. 11 — "Mål og indretning" foldet ud (tre ordrer)`, titel: 'Udskrift (print-stylesheet, "Mål og indretning" lukket på skærmen) — også som PDF: maal-udskrift.pdf', server: 'u1', nu: MAAL_VARIANTER[0].nu,
  sti: `/ordre/#${tilstandsNoegle(MAAL_VARIANTER[0].id, 'uden_login')}`, noegle: tilstandsNoegle(MAAL_VARIANTER[0].id, 'uden_login'), print: true, pdf: 'maal-udskrift.pdf', efter: klar, bredder: ['1440'] });
// nr. 14: headeren ved bredderne lige over menuknappens grænse (log ind, dansk og engelsk)
s({ id: 'header-login', gruppe: `${P3}nr. 14 — headeren ved 1181, 1280, 1366 og 1440 px`, titel: 'Log ind (dansk)', server: 'u2', nu: NU, sti: '/', header: true, bredder: ['1440', '1366', '1280', '1181'], efter: (p) => vent(p, 'form[data-trin="email"]') });
s({ id: 'header-login-en', gruppe: `${P3}nr. 14 — headeren ved 1181, 1280, 1366 og 1440 px`, titel: 'Log in (engelsk)', server: 'u2', nu: NU, sti: '/en/', header: true, bredder: ['1440', '1366', '1280', '1181'], efter: (p) => vent(p, 'form[data-trin="email"]') });
// nr. 12, 13, 16: log ind og Min side på smalle telefoner
s({ id: 'smal-login', gruppe: `${P3}nr. 12, 13 og 16 — log ind og Min side ved 320 og 360 px`, titel: 'Log ind', server: 'u2', nu: NU, sti: '/', bredder: ['360', '320'], efter: (p) => vent(p, 'form[data-trin="email"]') });
s({ id: 'smal-login-fejl', gruppe: `${P3}nr. 12, 13 og 16 — log ind og Min side ved 320 og 360 px`, titel: 'Ugyldig e-mail: fejlen mellem feltet og knappen', server: 'u2', nu: NU, sti: '/', bredder: ['360', '320'],
  efter: async (p) => { await vent(p, 'form[data-trin="email"]'); await p.fill('#email', 'mette.holm@'); await p.click('form button[type="submit"]'); await vent(p, '[data-besked]:not([hidden])'); } });
s({ id: 'smal-logget-ud', gruppe: `${P3}nr. 12, 13 og 16 — log ind og Min side ved 320 og 360 px`, titel: 'Efter "Log ud": bekræftelsen over feltet', server: 'u2', nu: NU, sti: '/min-side/', session: true, bredder: ['360', '320'],
  efter: async (p) => { await klar(p); await p.click('.hvem [data-handling="log-ud"]'); await p.waitForURL((u) => u.pathname === '/'); await vent(p, '[data-besked-start]'); } });
s({ id: 'smal-min-side', gruppe: `${P3}nr. 12, 13 og 16 — log ind og Min side ved 320 og 360 px`, titel: 'Min side ("Mere" foldet ud på det første design)', server: 'u2', nu: NU, sti: '/min-side/', session: true, bredder: ['360', '320'], rul: 'tr[data-design] details[open]',
  efter: async (p) => { await klar(p); await p.click('tr[data-design] details summary'); } });
// nr. 15: Gemte designs med miniaturer, opsummering og rumbillede
// runde 2, R3 og R10: prisen skæres aldrig af (320 px dansk, 320 og 375 px engelsk), og "Mere" står sidst i rækken på telefon
s({ id: 'min-side-designs', gruppe: `${P3}nr. 15 — Gemte designs: miniature, opsummering, rumbillede`, titel: 'Gemte designs ("Mere" med rumbilledet foldet ud) — bænken har ingen miniature (null → produktets ikon)', server: 'u2', nu: NU, sti: '/min-side/', session: true, rul: '#h-design', rulBlok: 'start', bredder: ['1440', '375', '360', '320'],
  efter: async (p) => { await klar(p); await p.click('tr[data-design] details summary'); await p.waitForFunction(() => [...document.querySelectorAll('img.th')].every((i) => i.complete && i.naturalWidth > 0)); } });
s({ id: 'min-side-designs-en', gruppe: `${P3}nr. 15 — Gemte designs: miniature, opsummering, rumbillede`, titel: 'Saved designs (engelsk)', server: 'u2', nu: NU, sti: '/en/min-side/', session: true, rul: '#h-design', rulBlok: 'start', bredder: ['1440', '375', '360', '320'],
  efter: async (p) => { await klar(p); await p.waitForFunction(() => [...document.querySelectorAll('img.th')].every((i) => i.complete && i.naturalWidth > 0)); } });
for (const [id, titel, server, n, foer] of [
  ['ordre-ukendt-u1', 'U1 · Ukendt nøgle (ordre.ikkeFundet1) — svaret er 200', 'u1', noegle('ukendt')],
  ['ordre-ukendt-u2', 'U2 · Ukendt nøgle (ordre.ikkeFundet) — svaret er 200', 'u2', noegle('ukendt')],
  ['ordre-erstattet-u1', 'U1 · Erstattet link (ordre.erstattet1) — svaret er 200', 'u1', noegle('erstattet')],
  ['ordre-erstattet-u2', 'U2 · Erstattet link (ordre.erstattet) — svaret er 200', 'u2', noegle('erstattet')],
  ['ordre-nede', 'U1 · Broen nede (ordre.nede, runde 4, 1)', 'u1', noegle('nede')],
  ['ordre-nede-u2', 'U2 · Broen nede (ordre.nede, runde 4, 1)', 'u2', noegle('nede')],
  ['ordre-lukket', 'U1 · 503, flaget fra (ordre.lukket, runde 4, 2)', 'u1', noegle('t03u'), (st) => { st.ordrestatusAktiv = false; }],
  ['ordre-lukket-u2', 'U2 · 503, flaget fra (ordre.lukket, runde 4, 2)', 'u2', noegle('t03u'), (st) => { st.ordrestatusAktiv = false; }],
]) {
  s({ id, gruppe: 'Ordresiden — fejl (udgivelse 1 og 2)', titel, server, nu: NU, sti: `/ordre/#${n}`, noegle: n, foer, efter: klar });
}
s({ id: 'ordre-udskrift', gruppe: 'Ordresiden — fejl (udgivelse 1 og 2)', titel: 'U2 · Udskrift (print-stylesheet: ordmærket øverst, uden header, footer og login-rækker, med sælgerlinjen) — også som PDF: ordre-udskrift.pdf', server: 'u2', nu: TILSTANDE[2].nu, sti: `/ordre/#${tilstandsNoegle(3, 'uden_login')}`, noegle: tilstandsNoegle(3, 'uden_login'), print: true, pdf: 'ordre-udskrift.pdf', efter: klar });
s({ id: 'ordre-noscript', gruppe: 'Ordresiden — fejl (udgivelse 1 og 2)', titel: 'U1 · Uden JavaScript (noscript, d4)', server: 'u1', nu: NU, sti: '/ordre/#k7Qm2xVt9dRw4LpZ8nYc_A', udenJs: true });

s({ id: 'login', gruppe: `${U2}Log ind`, titel: 'Log ind (d1)', server: 'u2', nu: NU, sti: '/', efter: (p) => vent(p, 'form[data-trin="email"]') });
s({ id: 'login-en', gruppe: `${U2}Log ind`, titel: 'Log in (d1, engelsk)', server: 'u2', nu: NU, sti: '/en/', efter: (p) => vent(p, 'form[data-trin="email"]') });
s({ id: 'login-noscript-en', gruppe: `${U2}Log ind`, titel: 'Log in uden JavaScript (en:noscript, runde 4, 10)', server: 'u2', nu: NU, sti: '/en/', udenJs: true });
s({ id: 'login-fejl', gruppe: `${U2}Log ind`, titel: 'Ugyldig e-mail (login.fejlEmail)', server: 'u2', nu: NU, sti: '/',
  efter: async (p) => { await vent(p, 'form[data-trin="email"]'); await p.fill('#email', 'mette.holm@'); await p.click('form button[type="submit"]'); await vent(p, '[data-besked]:not([hidden])'); } });
const tilKode = async (p) => {
  await vent(p, 'form[data-trin="email"]');
  await p.fill('#email', EMAIL);
  await p.click('form button[type="submit"]');
  await vent(p, 'form[data-trin="kode"]');
};
s({ id: 'kode', gruppe: `${U2}Log ind`, titel: 'Skriv koden (d2)', server: 'u2', nu: NU, sti: '/', efter: tilKode });
s({ id: 'kode-forkert', gruppe: `${U2}Log ind`, titel: 'Tredje forkerte kode (kode.forkert + kode.forsoegTilbage)', server: 'u2', nu: NU, sti: '/',
  efter: async (p) => {
    await tilKode(p);
    for (let i = 0; i < 3; i++) {
      await p.fill('#kode', '111 111');
      await p.click('[data-log-ind]');
      await p.waitForFunction((n) => document.querySelector('[data-besked]')?.textContent.includes('Koden passer ikke') && !document.querySelector('[data-log-ind]').disabled, i);
    }
  } });
s({ id: 'kode-spaerret', gruppe: `${U2}Log ind`, titel: 'Femte forkerte kode (kode.spaerret, "Send en ny kode" bliver hovedknap)', server: 'u2', nu: NU, sti: '/',
  efter: async (p) => {
    await tilKode(p);
    for (let i = 0; i < 5; i++) {
      await p.fill('#kode', '111111');
      await p.click('[data-log-ind]');
      // femte forkerte: koden er spærret, "Log ind" er slået fra, og "Send en ny kode" er hovedknap (port 3, nr. 27)
      await p.waitForFunction(() => !document.querySelector('[data-besked]').hidden && (!document.querySelector('[data-log-ind]').disabled || !!document.querySelector('[data-igen].hoved')));
    }
  } });
s({ id: 'login-udloebet', gruppe: `${U2}Log ind`, titel: 'Sessionen er udløbet (login.udloebet)', server: 'u2', nu: NU, sti: '/?udloebet=1&retur=%2Fmin-side%2F', efter: (p) => vent(p, '[data-besked-start]') });
s({ id: 'login-lukket', gruppe: `${U2}Log ind`, titel: '503, konto-flaget fra (lukket)', server: 'u2', nu: NU, sti: '/', foer: (st) => { st.kontoAktiv = false; },
  efter: (p) => p.waitForFunction(() => !document.querySelector('form')) });

s({ id: 'min-side', gruppe: `${U2}Min side`, titel: 'Min side, første login ("Mere" foldet ud)', server: 'u2', nu: NU, sti: '/min-side/?ny=1', session: true, rul: 'tr[data-design] details[open]',
  efter: async (p) => { await klar(p); await p.click('tr[data-design] details summary'); } });
s({ id: 'min-side-en', gruppe: `${U2}Min side`, titel: 'My account (engelsk)', server: 'u2', nu: NU, sti: '/en/min-side/', session: true, efter: klar });
s({ id: 'min-side-tom', gruppe: `${U2}Min side`, titel: 'Ny konto, intet endnu', server: 'u2', nu: NU, sti: '/min-side/', session: true, foer: (st) => { st.minSide = 'tom'; }, efter: klar });
s({ id: 'min-side-nede', gruppe: `${U2}Min side`, titel: 'Broen nede: Bestillinger (nede, runde 4, 1), designs og konto virker', server: 'u2', nu: NU, sti: '/min-side/', session: true, foer: (st) => { st.minSide = 'nede'; }, efter: klar });
s({ id: 'min-side-status', gruppe: `${U2}Min side`, titel: 'Statuskolonnen: dagOver, afhentUgeOver, afhentUge (runde 4, 5) — set 21. december', server: 'u2', nu: MIN_SIDE_STATUS_NU, sti: '/min-side/', session: true, foer: (st) => { st.minSide = 'status'; }, efter: klar });
s({ id: 'min-side-status-en', gruppe: `${U2}Min side`, titel: 'Statuskolonnen på engelsk (runde 4, 5)', server: 'u2', nu: MIN_SIDE_STATUS_NU, sti: '/en/min-side/', session: true, foer: (st) => { st.minSide = 'status'; }, efter: klar });
s({ id: 'min-side-helt-nede', gruppe: `${U2}Min side`, titel: 'Min side kan ikke hentes (side.nede, runde 4, 1)', server: 'u2', nu: NU, sti: '/min-side/', session: true, foer: (st) => { st.minSide = 'helt-nede'; }, efter: klar });
s({ id: 'min-side-lukket', gruppe: `${U2}Min side`, titel: '503, konto-flaget fra (lukket, runde 4, 2)', server: 'u2', nu: NU, sti: '/min-side/', session: true, foer: (st) => { st.kontoAktiv = false; }, efter: klar });
s({ id: 'min-side-fejl', gruppe: `${U2}Min side`, titel: 'Omdøb fejlede (side.fejl, runde 4, 4)', server: 'u2', nu: NU, sti: '/min-side/', session: true, foer: (st) => { st.handlingFejler = true; },
  efter: async (p) => {
    await klar(p); await p.click('tr[data-design] details summary'); await p.click('tr[data-design] [data-handling="omdoeb"]');
    await p.fill('#omdoeb-felt', 'Garderobe, ny udgave'); await p.click('form[data-omdoeb] button[type="submit"]'); await vent(p, 'tr[data-design] [data-svar] .form-msg.err');
  } });
s({ id: 'min-side-noscript-en', gruppe: `${U2}Min side`, titel: 'My account uden JavaScript (en:noscript, runde 4, 10)', server: 'u2', nu: NU, sti: '/en/min-side/', udenJs: true });
s({ id: 'log-ud-alle', gruppe: `${U2}Min side`, titel: 'Log ud alle steder: spørgsmålet (c7)', server: 'u2', nu: NU, sti: '/min-side/', session: true, rul: '[data-rk="alle"]',
  efter: async (p) => { await klar(p); await p.click('[data-handling="log-ud-alle"]'); await vent(p, '[data-handling="log-ud-alle-ja"]'); } });
s({ id: 'slet-konto', gruppe: `${U2}Min side`, titel: 'Slet konto: koden er sendt (c6)', server: 'u2', nu: NU, sti: '/min-side/', session: true, rul: 'details.slet',
  efter: async (p) => { await klar(p); await p.click('details.slet summary'); await p.click('[data-handling="slet-kode"]'); await vent(p, '#slet-kode'); } });
s({ id: 'logget-ud', gruppe: `${U2}Min side`, titel: 'Efter "Log ud" (login.loggetUd)', server: 'u2', nu: NU, sti: '/min-side/', session: true,
  efter: async (p) => { await klar(p); await p.click('.hvem [data-handling="log-ud"]'); await p.waitForURL((u) => u.pathname === '/'); await vent(p, '[data-besked-start]'); } });
s({ id: 'slettet', gruppe: `${U2}Min side`, titel: 'Kontoen er slettet (login.slettet)', server: 'u2', nu: NU, sti: '/min-side/', session: true,
  efter: async (p) => {
    await klar(p); await p.click('details.slet summary'); await p.click('[data-handling="slet-kode"]'); await vent(p, '#slet-kode');
    await p.fill('#slet-kode', '123456'); await p.click('[data-handling="slet-ja"]'); await p.waitForURL((u) => u.pathname === '/'); await vent(p, '[data-besked-start]');
  } });
s({ id: '404-u1', gruppe: 'Øvrige (udgivelse 1 og 2)', titel: 'U1 · 404 (side.404, runde 4, 3)', server: 'u1', nu: NU, sti: '/findes-ikke/' });
s({ id: '404', gruppe: 'Øvrige (udgivelse 1 og 2)', titel: 'U2 · 404 (side.404, runde 4, 3: "Min side" i headeren)', server: 'u2', nu: NU, sti: '/findes-ikke/' });

// ---------- kør ----------
mkdirSync(UD, { recursive: true });
const tmp = mkdtempSync(path.join(tmpdir(), 'ni-konto-skaerm-'));
console.log('Bygger udgivelse 1 og 2 …');
await byg({ udgivelse: 1, ud: path.join(tmp, 'u1') });
await byg({ udgivelse: 2, ud: path.join(tmp, 'u2') });
const servere = { u1: await startFake({ dist: path.join(tmp, 'u1') }), u2: await startFake({ dist: path.join(tmp, 'u2') }) };
const browser = await chromium.launch();
const resultat = [];

// Hver skærm i sine bredder (standard 1440 og 375), bredeste først
const KOERSLER = BREDDE_ORDEN.flatMap((navn) => SKAERME.filter((sk) => (sk.bredder ?? STD).includes(navn)).map((sk) => [BREDDE[navn], sk]));
const tilToppen = (p) => p.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
for (const [b, sk] of KOERSLER) {
  {
    const srv = servere[sk.server];
    Object.assign(srv.tilstand, { session: sk.session ? { email: EMAIL, ny: false } : null, kontoAktiv: true, ordrestatusAktiv: true, minSide: 'fuld', refNr: 3, handlingFejler: false, forkerte: 0, kald: [] });
    sk.foer?.(srv.tilstand);
    const ctx = await browser.newContext({ viewport: { width: b.width, height: b.height }, locale: 'da-DK', timezoneId: 'Europe/Copenhagen', javaScriptEnabled: !sk.udenJs });
    const net = [];
    const plausible = [];
    await ctx.route('**/*', async (route) => {
      const u = route.request().url();
      net.push(u);
      if (u.startsWith(srv.url)) return route.continue();
      if (u.startsWith('https://challenges.cloudflare.com/turnstile/')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: TURNSTILE_STUB });
      if (u === 'https://api.neminventar.dk/api/event') { plausible.push(route.request().postData() ?? ''); return route.fulfill({ status: 202, body: 'ok' }); }
      return route.abort();
    });
    const page = await ctx.newPage();
    const konsol = [];
    const http = [];
    // Et HTTP-svar med fejlstatus (401 uden session, 404-siden, 503 nede/lukket) logges også som fejl af browseren; det er
    // forventet og tælles for sig. Et ukendt eller erstattet link er 200 (kontrakter §6) og må ikke stå her.
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (/^Failed to load resource: the server responded with a status of [45]\d\d/.test(m.text())) http.push(m.text().replace(/^.*status of /, ''));
      else konsol.push(m.text());
    });
    page.on('pageerror', (e) => konsol.push(String(e)));
    if (!sk.udenJs) await page.clock.setFixedTime(new Date(sk.nu));
    let fejl = null;
    try {
      await page.goto(srv.url + sk.sti, { waitUntil: 'load' });
      if (sk.efter) await sk.efter(page);
      await page.evaluate(() => document.fonts?.ready);
      // Til toppen UDEN glidende rulning (site.css har scroll-behavior:smooth), og først når et fold-ud har flyttet fokus (og
      // dermed rullet): ellers stod den klæbende header midt i helsidesbilledet (Fable port 3, nr. 34). scrollBehavior sættes
      // gennem CSSOM (sidens CSP tillader ikke en <style>).
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
      await page.waitForTimeout(250);
      await tilToppen(page);
      await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(100);
    } catch (e) {
      fejl = String(e).split('\n')[0];
    }
    if (sk.print) await page.emulateMedia({ media: 'print' });
    const fil = `${sk.id}-${b.navn}.png`;
    const synligt = `${sk.id}-${b.navn}-synligt.png`;
    // Målinger: vandret scroll (skal være 0) og, for headeren, hvor langt "Få en pris" står uden for rammen (≤ 0 er inden for)
    // og luften mellem logoet og den første menupunkt (skal være mindst headerens egen afstand)
    const maal = await page.evaluate(() => {
      const d = document.documentElement;
      const nav = document.querySelector('.nav-in');
      const cta = document.querySelector('.nav-links .nav-cta');
      const brand = document.querySelector('.nav-in .brand');
      const foerste = document.querySelector('.nav-links a');
      let header = null;
      if (nav && cta && cta.getClientRects().length && cta.getBoundingClientRect().width > 0) {
        const r = nav.getBoundingClientRect(), cs = getComputedStyle(nav), c = cta.getBoundingClientRect();
        header = { cta: Math.round(c.right), ramme: Math.round(r.right - parseFloat(cs.paddingRight)), over: Math.round(c.right - (r.right - parseFloat(cs.paddingRight))),
          luft: brand && foerste ? Math.round(foerste.getBoundingClientRect().left - brand.getBoundingClientRect().right) : null };
      }
      // Fable port 3 runde 2, R3: en celle, der skærer sit indhold af (scrollWidth > clientWidth), fanges ikke af "vandret scroll",
      // når siden ikke kan rulles — så hver synlig celle i tabellerne måles for sig (1 px tolerance for afrunding)
      const afskaaret = [...document.querySelectorAll('.tb td, .tb th')]
        .filter((c) => c.getClientRects().length && getComputedStyle(c).display !== 'contents' && c.scrollWidth > c.clientWidth + 1)
        .map((c) => `${c.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)} (${c.scrollWidth} > ${c.clientWidth})`);
      return { vandret: Math.max(0, d.scrollWidth - d.clientWidth), header, afskaaret };
    }).catch(() => ({ vandret: null, header: null, afskaaret: [] }));
    await page.screenshot({ path: path.join(UD, fil), fullPage: true });
    // Det synlige vindue: øverst — eller rullet til handlingen (sk.rul), så det, skærmen handler om, står i billedet
    if (sk.rul) await page.evaluate(([sel, blok]) => document.querySelector(sel)?.scrollIntoView({ block: blok, behavior: 'instant' }), [sk.rul, sk.rulBlok ?? 'center']).catch(() => {});
    await page.waitForTimeout(sk.rul ? 120 : 0);
    await page.screenshot({ path: path.join(UD, synligt), fullPage: false });
    // En rigtig udskrift til PDF (Chromiums egen print, uden beforeprint fra os): "Mål og indretning" skal stå åben
    let pdf = null;
    if (sk.pdf && b.navn === '1440') {
      await tilToppen(page);
      await page.pdf({ path: path.join(UD, sk.pdf), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
      pdf = sk.pdf;
    }
    let axe = null;
    if (b.navn === '1440' && !sk.udenJs) {
      await page.evaluate(AXE);
      axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, hjaelp: v.help, antal: v.nodes.length, maal: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      });
    }
    // R10: nøglen må hverken stå i en adresse, browseren hentede, eller i et Plausible-kald
    const r10 = sk.noegle ? {
      adresser: net.filter((u) => u.includes(sk.noegle)).length,
      plausible: plausible.filter((x) => x.includes(sk.noegle)).length,
      plausibleUrl: plausible.map((x) => { try { return JSON.parse(x).url; } catch { return x; } }),
      apiBody: srv.tilstand.kald.some((k) => k.sti === '/api/ordre' && k.body.noegle === sk.noegle),
      adresselinje: page.url(),
    } : null;
    const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim() ?? null).catch(() => null);
    resultat.push({ id: sk.id, gruppe: sk.gruppe, titel: sk.titel, server: sk.server, bredde: b.navn, fil, synligt, pdf, h1, fejl, konsol, http, axe, r10, vandret: maal.vandret, header: maal.header, afskaaret: maal.afskaaret ?? [], todo: (await page.content()).includes('TODO-TEKST') });
    console.log(`${fejl ? '✖' : '✔'} ${b.navn} ${sk.id}${fejl ? ` — ${fejl}` : ''}${konsol.length ? ` — konsol: ${konsol.length}` : ''}${axe?.length ? ` — axe: ${axe.length}` : ''}${maal.vandret ? ` — VANDRET SCROLL ${maal.vandret} px` : ''}${maal.afskaaret?.length ? ` — AFSKÅRET: ${maal.afskaaret.join(' | ')}` : ''}${maal.header && maal.header.over > 0 ? ` — HEADER ${maal.header.over} px UDEN FOR` : ''}`);
    await ctx.close();
  }
}
await browser.close();
await servere.u1.luk();
await servere.u2.luk();
rmSync(tmp, { recursive: true, force: true });

writeFileSync(path.join(UD, 'resultat.json'), JSON.stringify(resultat, null, 2));
writeFileSync(path.join(UD, 'index.html'), kontaktark(resultat));
const axeFejl = resultat.filter((r) => r.axe?.length);
const r10Fejl = resultat.filter((r) => r.r10 && (r.r10.adresser || r.r10.plausible));
console.log(`\n${SKAERME.length} skærme i ${resultat.length} bredder × 2 (synligt + hele siden) = ${resultat.length * 2} billeder. Fejlede: ${resultat.filter((r) => r.fejl).length}. axe: ${axeFejl.length} sider med fund. R10-brud: ${r10Fejl.length}. Konsolfejl: ${resultat.filter((r) => r.konsol.length).length}. Vandret scroll: ${resultat.filter((r) => r.vandret).length}. Afskårne celler: ${resultat.filter((r) => r.afskaaret.length).length}. Header uden for rammen: ${resultat.filter((r) => r.header?.over > 0).length}. Kontaktark: ${path.join(UD, 'index.html')}`);

function kontaktark(res) {
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const git = (...a) => { try { return execFileSync('git', ['-C', ROD, ...a], { encoding: 'utf8' }).trim(); } catch { return '?'; } };
  const kilde = `${git('rev-parse', '--abbrev-ref', 'HEAD')} @ ${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain') ? ' + ændringer, der ikke er committet' : ''}`;
  // Port 3-grupperne først: det er dem, Fable skal se nu
  const grupper = [...new Set(res.map((r) => r.gruppe))].sort((a, b) => Number(!a.startsWith('Fable port 3')) - Number(!b.startsWith('Fable port 3')));
  const prId = (id) => res.filter((r) => r.id === id).sort((a, b) => BREDDE_ORDEN.indexOf(a.bredde) - BREDDE_ORDEN.indexOf(b.bredde));
  const ider = (g) => [...new Set(res.filter((r) => r.gruppe === g).map((r) => r.id))];
  const anker = (g) => `g${grupper.indexOf(g) + 1}`;
  const skaerme = [...new Set(res.map((r) => r.id))].length;
  const oversigt = grupper.map((g, i) => {
    const r = res.filter((x) => x.gruppe === g);
    return `<tr><td class="n">${i + 1}</td><td><a href="#${anker(g)}">${esc(g)}</a></td><td class="n">${ider(g).length}</td><td class="n">${r.length * 2}</td><td class="n">${r.filter((x) => x.fejl).length}</td><td class="n">${r.filter((x) => x.todo).length}</td><td class="n">${r.filter((x) => x.vandret).length}</td></tr>`;
  }).join('');
  const billede = (r, fil, hvad) => `<figure><a href="${esc(fil)}"><img src="${esc(fil)}" alt="${esc(r.titel)} ${r.bredde} px, ${hvad}" loading="lazy"></a><figcaption>${r.bredde} px · ${hvad}${r.vandret ? ` <span class="m">vandret scroll ${r.vandret} px</span>` : ''}${r.header && r.id.startsWith('header-') ? ` · "Få en pris" ${r.header.over > 0 ? `<span class="m">${r.header.over} px uden for rammen</span>` : `${-r.header.over} px inden for rammen`}` : ''}</figcaption></figure>`;
  const pr1440 = res.filter((r) => r.bredde === '1440');
  const headerRaekker = res.filter((r) => r.header && r.id.startsWith('header-')).sort((a, b) => a.id.localeCompare(b.id) || BREDDE_ORDEN.indexOf(a.bredde) - BREDDE_ORDEN.indexOf(b.bredde))
    .map((r) => `<tr><td>${esc(r.id)}</td><td class="n">${r.bredde}</td><td class="n">${r.header.cta}</td><td class="n">${r.header.ramme}</td><td class="n${r.header.over > 0 ? ' m' : ''}">${r.header.over}</td><td class="n">${r.header.luft ?? '—'}</td></tr>`).join('');
  const smalle = res.filter((r) => ['320', '360', '375'].includes(r.bredde));
  const pdfer = [...new Set(res.filter((r) => r.pdf).map((r) => r.pdf))];
  const http = res.filter((r) => r.http?.length && r.bredde === '1440').map((r) => `<tr><td>${esc(r.id)}</td><td>${r.http.map(esc).join('<br>')}</td></tr>`).join('');
  const ordreFejl = pr1440.filter((r) => /^ordre-(ukendt|erstattet)/.test(r.id)).map((r) => `<tr><td>${esc(r.id)}</td><td>${esc(r.h1)}</td><td class="n">${r.http.length}</td><td class="n">${r.konsol.length}</td></tr>`).join('');
  const axeRaekker = res.filter((r) => r.axe).map((r) => `<tr><td>${esc(r.id)}</td><td class="n">${r.axe.length}</td><td>${r.axe.map((v) => `${esc(v.id)} (${esc(v.impact)}, ${v.antal}): ${esc(v.hjaelp)} — <code>${esc(v.maal.join(' | '))}</code>`).join('<br>') || '—'}</td></tr>`).join('');
  const r10 = res.filter((r) => r.r10 && r.bredde === '1440').map((r) => `<tr><td>${esc(r.id)}</td><td>${esc(r.r10.adresselinje.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''))}</td><td class="n">${r.r10.adresser}</td><td class="n">${r.r10.plausible}</td><td>${esc(r.r10.plausibleUrl.map((u) => u.replace(/^http:\/\/127\.0\.0\.1:\d+/, '')).join(', '))}</td><td>${r.r10.apiBody ? 'ja' : 'nej'}</td></tr>`).join('');
  const konsol = res.filter((r) => r.konsol.length).map((r) => `<tr><td>${esc(r.id)} · ${r.bredde}</td><td>${r.konsol.map(esc).join('<br>')}</td></tr>`).join('');
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Konto-skærmbilleder</title>
<style>
:root{--paper:#FAF8F3;--ink:#17140E;--muted:#6E6759;--line:#E5DFD2;--warm:#A2652A;--soft:#F1EDE3}
body{margin:0;font:15px/1.55 Inter,system-ui,sans-serif;background:var(--paper);color:var(--ink);padding:32px 16px 80px}
main{max-width:1500px;margin:0 auto}h1{font-size:30px;margin:0 0 6px}h2{font-size:21px;margin:44px 0 12px;border-top:1px solid var(--line);padding-top:22px}
p.l{color:var(--muted);max-width:90ch}table{border-collapse:collapse;width:100%;background:#fff;border:1px solid var(--line);font-size:13.5px}
th,td{text-align:left;padding:7px 10px;border-top:1px solid var(--line);vertical-align:top}th{background:var(--soft)}td.n{text-align:right}
.raekke{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;margin:12px 0}
.raekke figure.bred{grid-column:span 3}
.raekke h3{grid-column:1/-1;margin:0;font-size:15px}.raekke h3 small{color:var(--muted);font-weight:400;margin-left:8px}
.raekke figure{margin:0}.raekke figcaption{color:var(--muted);font-size:12px;margin-top:4px}
.raekke a{display:block;border:1px solid var(--line);border-radius:6px;overflow:hidden;max-height:560px}.raekke img{width:100%;display:block}
.m{color:#9B2C2C;font-weight:600}code{font-size:12px}
@media(max-width:900px){.raekke{grid-template-columns:1fr 1fr}}
</style></head><body><main>
<h1>Konto-skærmbilleder</h1>
<p class="l">konto.neminventar.dk (neminventar-astro <b>${esc(kilde)}</b>) bygget i <b>begge udgivelser</b> (KONTO_UDGIVELSE=1 og =2) og kørt mod en lokal fake-API (kontrakter §6) med sidernes egne _headers (CSP). Uret er sat pr. tilstand, så datoerne passer til Fable runde 3 afsnit e. Hver skærm ved 1440 og 375 px — Fable port 3-skærmene også ved 1366, 1280 og 1181 (headeren) og 360 og 320 (telefoner) — både det synlige vindue og hele siden; tryk for fuld størrelse. Et "synligt vindue" er rullet til handlingen, når skærmen handler om en handling længere nede. ${skaerme} skærme · ${res.length * 2} billeder${pdfer.length ? ` · udskrift som PDF: ${pdfer.map((f) => `<a href="${esc(f)}">${esc(f)}</a>`).join(', ')}` : ''}. Rødt mærke = siden viser TODO-TEKST, skærmen fejlede, siden kan rulles vandret, eller headeren står uden for rammen.</p>
<table><tr><th class="n">#</th><th>Gruppe</th><th class="n">Skærme</th><th class="n">Billeder</th><th class="n">Fejlede</th><th class="n">TODO-TEKST</th><th class="n">Vandret scroll</th></tr>${oversigt}<tr><th></th><th>I alt</th><th class="n">${skaerme}</th><th class="n">${res.length * 2}</th><th class="n">${res.filter((x) => x.fejl).length}</th><th class="n">${res.filter((x) => x.todo).length}</th><th class="n">${res.filter((x) => x.vandret).length}</th></tr></table>
${grupper.map((g) => `<h2 id="${anker(g)}">${esc(g)}</h2>${ider(g).map((id) => { const l = prId(id); const a = l[0]; return `<div class="raekke"><h3>${esc(a.titel)}<small>${esc(id)}</small>${l.some((x) => x.todo) ? ' <span class="m">TODO-TEKST</span>' : ''}${l.filter((x) => x.fejl).map((x) => ` <span class="m">${x.bredde}: ${esc(x.fejl)}</span>`).join('')}</h3>${l.map((x) => `${billede(x, x.synligt, 'synligt vindue')}${billede(x, x.fil, 'hele siden')}`).join('')}</div>`; }).join('')}`).join('')}
<h2>Headeren (Fable port 3, nr. 14): højre kant af "Få en pris" mod rammens indre højre kant</h2><p class="l">Målt i browseren på de skærme, der har headerens fulde linje (over 1180 px). "Over" ≤ 0 = inden for rammen.</p>
<table><tr><th>Skærm</th><th class="n">Bredde</th><th class="n">"Få en pris" slutter</th><th class="n">Rammen slutter</th><th class="n">Over</th><th class="n">Luft fra logoet til første link</th></tr>${headerRaekker}</table>
<h2>Vandret scroll på telefon (Fable port 3, nr. 1)</h2><p class="l">document.scrollWidth − clientWidth for alle ${smalle.length} skærme ved 320, 360 og 375 px (skal være 0). Med fund: ${smalle.filter((r) => r.vandret).map((r) => `${esc(r.id)} ${r.bredde} (${r.vandret} px)`).join(', ') || 'ingen'}.</p>
<h2>Afskårne celler (Fable port 3 runde 2, R3)</h2><p class="l">Hver synlig celle i tabellerne på alle ${res.length} skærme: scrollWidth &gt; clientWidth betyder, at indholdet er skåret af (fanges ikke af "vandret scroll", når siden ikke kan rulles). Skal være 0. Med fund: ${res.filter((r) => r.afskaaret?.length).map((r) => `${esc(r.id)} ${r.bredde}: ${esc(r.afskaaret.join(' | '))}`).join('; ') || 'ingen'}.</p>
<h2>Ukendt og erstattet link: ingen HTTP-fejl i konsollen</h2><p class="l">Kontrakter §6 (rettet 12-11): /api/ordre svarer 200 med {fejl}. Overskriften er Fables, og browseren har ingen "Failed to load resource" (skal være 0).</p>
<table><tr><th>Side</th><th>H1</th><th class="n">HTTP-fejl i konsollen</th><th class="n">Andre konsolfejl</th></tr>${ordreFejl}</table>
<h2>axe-core (1440 px)</h2><table><tr><th>Side</th><th class="n">Fund</th><th>Regel</th></tr>${axeRaekker}</table>
<h2>R10: statusnøglen</h2><p class="l">Adresselinjen efter indlæsning, antal hentede adresser og Plausible-kald, der bærer nøglen (skal være 0), Plausibles url, og om nøglen gik i POST-body til /api/ordre.</p>
<table><tr><th>Side</th><th>Adresselinje</th><th class="n">Adresser med nøgle</th><th class="n">Plausible med nøgle</th><th>Plausible url</th><th>Nøgle i POST-body</th></tr>${r10}</table>
<h2>Konsolfejl</h2>${konsol ? `<table><tr><th>Side</th><th>Fejl</th></tr>${konsol}</table>` : '<p class="l">Ingen.</p>'}
<h2>Forventede HTTP-fejlsvar (1440 px)</h2><p class="l">Browseren logger et fejlsvar som "Failed to load resource". Her står de, der hører til skærmen: 401 uden session, 404-siden, 503 nede eller lukket, 500 ved side.fejl.</p>
${http ? `<table><tr><th>Side</th><th>Status</th></tr>${http}</table>` : '<p class="l">Ingen.</p>'}
</main></body></html>`;
}
