// Skærmbilleder af konto.neminventar.dk mod den lokale fake-API (konto/scripts/fake-api.mjs): alle 16 tilstande på
// ordresiden + log ind, koden, Min side, slet konto, 503 og 404 — ved 1440 og 375 px. Undervejs:
//   - axe-core på hver side (1440 px): WCAG 2.0/2.1/2.2 A+AA + best practice
//   - konsolfejl (fx CSP-afvisninger: siden kører med sine egne _headers)
//   - R10: ingen netværksadresse og intet Plausible-kald bærer statusnøglen
// Ud: C:\tmp\kundelogin\konto-skaermbilleder\ (eller KONTO_SKAERM_UD) med kontaktarket index.html og resultat.json.
// Playwright og axe-core hentes fra KONTO_VAERKTOEJ (standard C:\tmp\kundelogin\vaerktoej, `npm i playwright axe-core`).
//   node konto/scripts/skaermbilleder.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { byg } from './byg.mjs';
import { startFake, tilstandsNoegle, noegle } from './fake-api.mjs';
import { TILSTANDE, EMAIL } from '../test/fixtures.mjs';

const UD = process.env.KONTO_SKAERM_UD || 'C:/tmp/kundelogin/konto-skaermbilleder';
const VAERKTOEJ = process.env.KONTO_VAERKTOEJ || 'C:/tmp/kundelogin/vaerktoej';
const { chromium } = await import(pathToFileURL(path.join(VAERKTOEJ, 'node_modules/playwright/index.mjs')).href);
const AXE = readFileSync(path.join(VAERKTOEJ, 'node_modules/axe-core/axe.min.js'), 'utf8');
const BREDDER = [{ navn: '1440', width: 1440, height: 900 }, { navn: '375', width: 375, height: 812 }];
const NU = '2026-11-12T10:00:00.000Z';

const TURNSTILE_STUB = `window.turnstile={_o:null,render:function(el,o){this._o=o;return 'w1'},execute:function(){var o=this._o;setTimeout(function(){o.callback('fake-token')},20)},reset:function(){},getResponse:function(){return 'fake-token'}};`;

// ---------- skærmene ----------
const vent = (p, sel) => p.waitForSelector(sel, { state: 'attached', timeout: 10_000 });
const klar = (p) => p.waitForSelector('#rod:not([aria-busy])', { timeout: 10_000 });
const SKAERME = [];
const s = (x) => SKAERME.push(x);

for (const t of TILSTANDE) {
  s({ id: `ordre-u1-t${String(t.nr).padStart(2, '0')}`, gruppe: 'Ordresiden, udgivelse 1 — de 16 tilstande (Fable e)', titel: `${t.nr}. ${t.navn}`, server: 'u1', nu: t.nu, sti: `/ordre/#${tilstandsNoegle(t.nr, 'uden_login')}`, noegle: tilstandsNoegle(t.nr, 'uden_login'), efter: klar });
}
for (const nr of [3, 10]) {
  const t = TILSTANDE.find((x) => x.nr === nr);
  s({ id: `ordre-u2uden-t${nr}`, gruppe: 'Ordresiden, udgivelse 2', titel: `${nr}. ${t.navn} — uden login`, server: 'u2', nu: t.nu, sti: `/ordre/#${tilstandsNoegle(nr, 'uden_login')}`, noegle: tilstandsNoegle(nr, 'uden_login'), efter: klar });
  s({ id: `ordre-u2med-t${nr}`, gruppe: 'Ordresiden, udgivelse 2', titel: `${nr}. ${t.navn} — med login`, server: 'u2', nu: t.nu, sti: `/ordre/#${tilstandsNoegle(nr, 'med_login')}`, noegle: tilstandsNoegle(nr, 'med_login'), session: true, efter: klar });
}
s({ id: 'ordre-u2med-ref', gruppe: 'Ordresiden, udgivelse 2', titel: 'Fra Min side: #NI-1D078A14 (med login)', server: 'u2', nu: TILSTANDE[2].nu, sti: '/ordre/#NI-1D078A14', session: true, efter: klar });
s({ id: 'ordre-ikke-min', gruppe: 'Ordresiden, udgivelse 2', titel: '"Er det ikke din bestilling?" trykket (c5)', server: 'u2', nu: TILSTANDE[2].nu, sti: `/ordre/#${tilstandsNoegle(3, 'med_login')}`, session: true,
  efter: async (p) => { await klar(p); await p.click('[data-handling="ikke-min"]'); await vent(p, '[data-handling="ikke-min-ja"]'); } });
for (const [id, titel, server, n, foer] of [
  ['ordre-ukendt-u1', 'Ukendt nøgle (ordre.ikkeFundet1)', 'u1', noegle('ukendt')],
  ['ordre-ukendt-u2', 'Ukendt nøgle (ordre.ikkeFundet)', 'u2', noegle('ukendt')],
  ['ordre-erstattet-u1', 'Erstattet link (ordre.erstattet1)', 'u1', noegle('erstattet')],
  ['ordre-erstattet-u2', 'Erstattet link (ordre.erstattet)', 'u2', noegle('erstattet')],
  ['ordre-nede', 'Broen nede (ordre.nede)', 'u1', noegle('nede')],
  ['ordre-lukket', '503, flaget fra (ordre.lukket)', 'u1', noegle('t03u'), (st) => { st.ordrestatusAktiv = false; }],
]) {
  s({ id, gruppe: 'Ordresiden — fejl', titel, server, nu: NU, sti: `/ordre/#${n}`, noegle: n, foer, efter: klar });
}
s({ id: 'ordre-udskrift', gruppe: 'Ordresiden — fejl', titel: 'Udskrift (print-stylesheet: uden header, footer og login-rækker, med sælgerlinjen)', server: 'u2', nu: TILSTANDE[2].nu, sti: `/ordre/#${tilstandsNoegle(3, 'uden_login')}`, noegle: tilstandsNoegle(3, 'uden_login'), print: true, efter: klar });
s({ id: 'ordre-noscript', gruppe: 'Ordresiden — fejl', titel: 'Uden JavaScript (noscript, d4)', server: 'u1', nu: NU, sti: '/ordre/#k7Qm2xVt9dRw4LpZ8nYc_A', udenJs: true });

s({ id: 'login', gruppe: 'Log ind (udgivelse 2)', titel: 'Log ind (d1)', server: 'u2', nu: NU, sti: '/', efter: (p) => vent(p, 'form[data-trin="email"]') });
s({ id: 'login-en', gruppe: 'Log ind (udgivelse 2)', titel: 'Log in (d1, engelsk)', server: 'u2', nu: NU, sti: '/en/', efter: (p) => vent(p, 'form[data-trin="email"]') });
s({ id: 'login-fejl', gruppe: 'Log ind (udgivelse 2)', titel: 'Ugyldig e-mail (login.fejlEmail)', server: 'u2', nu: NU, sti: '/',
  efter: async (p) => { await vent(p, 'form[data-trin="email"]'); await p.fill('#email', 'mette.holm@'); await p.click('form button[type="submit"]'); await vent(p, '[data-besked]:not([hidden])'); } });
const tilKode = async (p) => {
  await vent(p, 'form[data-trin="email"]');
  await p.fill('#email', EMAIL);
  await p.click('form button[type="submit"]');
  await vent(p, 'form[data-trin="kode"]');
};
s({ id: 'kode', gruppe: 'Log ind (udgivelse 2)', titel: 'Skriv koden (d2)', server: 'u2', nu: NU, sti: '/', efter: tilKode });
s({ id: 'kode-forkert', gruppe: 'Log ind (udgivelse 2)', titel: 'Tredje forkerte kode (kode.forkert + kode.forsoegTilbage)', server: 'u2', nu: NU, sti: '/',
  efter: async (p) => {
    await tilKode(p);
    for (let i = 0; i < 3; i++) {
      await p.fill('#kode', '111 111');
      await p.click('[data-log-ind]');
      await p.waitForFunction((n) => document.querySelector('[data-besked]')?.textContent.includes('Koden passer ikke') && !document.querySelector('[data-log-ind]').disabled, i);
    }
  } });
s({ id: 'kode-spaerret', gruppe: 'Log ind (udgivelse 2)', titel: 'Femte forkerte kode (kode.spaerret, "Send en ny kode" bliver hovedknap)', server: 'u2', nu: NU, sti: '/',
  efter: async (p) => {
    await tilKode(p);
    for (let i = 0; i < 5; i++) {
      await p.fill('#kode', '111111');
      await p.click('[data-log-ind]');
      await p.waitForFunction(() => !document.querySelector('[data-log-ind]').disabled && !document.querySelector('[data-besked]').hidden);
    }
  } });
s({ id: 'login-udloebet', gruppe: 'Log ind (udgivelse 2)', titel: 'Sessionen er udløbet (login.udloebet)', server: 'u2', nu: NU, sti: '/?udloebet=1&retur=%2Fmin-side%2F', efter: (p) => vent(p, '[data-besked-start]') });
s({ id: 'login-lukket', gruppe: 'Log ind (udgivelse 2)', titel: '503, konto-flaget fra (lukket)', server: 'u2', nu: NU, sti: '/', foer: (st) => { st.kontoAktiv = false; },
  efter: (p) => p.waitForFunction(() => !document.querySelector('form')) });

s({ id: 'min-side', gruppe: 'Min side (udgivelse 2)', titel: 'Min side, første login ("Mere" foldet ud)', server: 'u2', nu: NU, sti: '/min-side/?ny=1', session: true,
  efter: async (p) => { await klar(p); await p.click('tr[data-design] details summary'); } });
s({ id: 'min-side-en', gruppe: 'Min side (udgivelse 2)', titel: 'My account (engelsk)', server: 'u2', nu: NU, sti: '/en/min-side/', session: true, efter: klar });
s({ id: 'min-side-tom', gruppe: 'Min side (udgivelse 2)', titel: 'Ny konto, intet endnu', server: 'u2', nu: NU, sti: '/min-side/', session: true, foer: (st) => { st.minSide = 'tom'; }, efter: klar });
s({ id: 'min-side-nede', gruppe: 'Min side (udgivelse 2)', titel: 'Broen nede: Bestillinger (nede), designs og konto virker', server: 'u2', nu: NU, sti: '/min-side/', session: true, foer: (st) => { st.minSide = 'nede'; }, efter: klar });
s({ id: 'log-ud-alle', gruppe: 'Min side (udgivelse 2)', titel: 'Log ud alle steder: spørgsmålet (c7)', server: 'u2', nu: NU, sti: '/min-side/', session: true,
  efter: async (p) => { await klar(p); await p.click('[data-handling="log-ud-alle"]'); await vent(p, '[data-handling="log-ud-alle-ja"]'); } });
s({ id: 'slet-konto', gruppe: 'Min side (udgivelse 2)', titel: 'Slet konto: koden er sendt (c6)', server: 'u2', nu: NU, sti: '/min-side/', session: true,
  efter: async (p) => { await klar(p); await p.click('details.slet summary'); await p.click('[data-handling="slet-kode"]'); await vent(p, '#slet-kode'); } });
s({ id: 'logget-ud', gruppe: 'Min side (udgivelse 2)', titel: 'Efter "Log ud" (login.loggetUd)', server: 'u2', nu: NU, sti: '/min-side/', session: true,
  efter: async (p) => { await klar(p); await p.click('.hvem [data-handling="log-ud"]'); await p.waitForURL((u) => u.pathname === '/'); await vent(p, '[data-besked-start]'); } });
s({ id: 'slettet', gruppe: 'Min side (udgivelse 2)', titel: 'Kontoen er slettet (login.slettet)', server: 'u2', nu: NU, sti: '/min-side/', session: true,
  efter: async (p) => {
    await klar(p); await p.click('details.slet summary'); await p.click('[data-handling="slet-kode"]'); await vent(p, '#slet-kode');
    await p.fill('#slet-kode', '123456'); await p.click('[data-handling="slet-ja"]'); await p.waitForURL((u) => u.pathname === '/'); await vent(p, '[data-besked-start]');
  } });
s({ id: '404', gruppe: 'Øvrige', titel: '404 (side.404)', server: 'u2', nu: NU, sti: '/findes-ikke/' });

// ---------- kør ----------
mkdirSync(UD, { recursive: true });
const tmp = mkdtempSync(path.join(tmpdir(), 'ni-konto-skaerm-'));
console.log('Bygger udgivelse 1 og 2 …');
await byg({ udgivelse: 1, ud: path.join(tmp, 'u1') });
await byg({ udgivelse: 2, ud: path.join(tmp, 'u2') });
const servere = { u1: await startFake({ dist: path.join(tmp, 'u1') }), u2: await startFake({ dist: path.join(tmp, 'u2') }) };
const browser = await chromium.launch();
const resultat = [];

for (const b of BREDDER) {
  for (const sk of SKAERME) {
    const srv = servere[sk.server];
    Object.assign(srv.tilstand, { session: sk.session ? { email: EMAIL, ny: false } : null, kontoAktiv: true, ordrestatusAktiv: true, minSide: 'fuld', refNr: 3, forkerte: 0, kald: [] });
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
    // Et HTTP-svar med fejlstatus (404 fra API'et, 404-siden) logges også som fejl af browseren; det er forventet.
    page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource: the server responded with a status of [45]\d\d/.test(m.text())) konsol.push(m.text()); });
    page.on('pageerror', (e) => konsol.push(String(e)));
    if (!sk.udenJs) await page.clock.setFixedTime(new Date(sk.nu));
    let fejl = null;
    try {
      await page.goto(srv.url + sk.sti, { waitUntil: 'load' });
      if (sk.efter) await sk.efter(page);
      await page.evaluate(() => document.fonts?.ready);
      await page.evaluate(() => window.scrollTo(0, 0));   // ellers står den klæbende header midt i et helsidesbillede
      await page.waitForTimeout(150);
    } catch (e) {
      fejl = String(e).split('\n')[0];
    }
    if (sk.print) await page.emulateMedia({ media: 'print' });
    const fil = `${sk.id}-${b.navn}.png`;
    await page.screenshot({ path: path.join(UD, fil), fullPage: true });
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
    resultat.push({ id: sk.id, gruppe: sk.gruppe, titel: sk.titel, bredde: b.navn, fil, fejl, konsol, axe, r10, todo: (await page.content()).includes('TODO-TEKST') });
    console.log(`${fejl ? '✖' : '✔'} ${b.navn} ${sk.id}${fejl ? ` — ${fejl}` : ''}${konsol.length ? ` — konsol: ${konsol.length}` : ''}${axe?.length ? ` — axe: ${axe.length}` : ''}`);
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
console.log(`\n${SKAERME.length} skærme × ${BREDDER.length} bredder. axe: ${axeFejl.length} sider med fund. R10-brud: ${r10Fejl.length}. Konsolfejl: ${resultat.filter((r) => r.konsol.length).length}. Kontaktark: ${path.join(UD, 'index.html')}`);

function kontaktark(res) {
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const grupper = [...new Set(res.map((r) => r.gruppe))];
  const pr = (id, b) => res.find((r) => r.id === id && r.bredde === b);
  const ider = (g) => [...new Set(res.filter((r) => r.gruppe === g).map((r) => r.id))];
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
.raekke{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1fr);gap:16px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;margin:12px 0}
.raekke h3{grid-column:1/-1;margin:0;font-size:15px}.raekke h3 small{color:var(--muted);font-weight:400;margin-left:8px}
.raekke a{display:block;border:1px solid var(--line);border-radius:6px;overflow:hidden;max-height:560px}.raekke img{width:100%;display:block}
.m{color:#9B2C2C;font-weight:600}code{font-size:12px}
@media(max-width:800px){.raekke{grid-template-columns:1fr}}
</style></head><body><main>
<h1>Konto-skærmbilleder</h1>
<p class="l">konto.neminventar.dk bygget fra branch <b>min-side-site</b>, kørt mod en lokal fake-API (kontrakter §6) med siternes egne _headers (CSP). Uret er sat pr. tilstand, så datoerne passer til Fable runde 3 afsnit e. Venstre 1440 px, højre 375 px; tryk for fuld størrelse. ${res.length / 2} skærme. Rødt mærke = siden viser TODO-TEKST (Fable mangler teksten).</p>
${grupper.map((g) => `<h2>${esc(g)}</h2>${ider(g).map((id) => { const a = pr(id, '1440'); const b = pr(id, '375'); return `<div class="raekke"><h3>${esc(a.titel)}<small>${esc(id)}</small>${a.todo ? ' <span class="m">TODO-TEKST</span>' : ''}${a.fejl ? ` <span class="m">${esc(a.fejl)}</span>` : ''}</h3><a href="${esc(a.fil)}"><img src="${esc(a.fil)}" alt="${esc(a.titel)} 1440 px" loading="lazy"></a><a href="${esc(b.fil)}"><img src="${esc(b.fil)}" alt="${esc(a.titel)} 375 px" loading="lazy"></a></div>`; }).join('')}`).join('')}
<h2>axe-core (1440 px)</h2><table><tr><th>Side</th><th class="n">Fund</th><th>Regel</th></tr>${axeRaekker}</table>
<h2>R10: statusnøglen</h2><p class="l">Adresselinjen efter indlæsning, antal hentede adresser og Plausible-kald, der bærer nøglen (skal være 0), Plausibles url, og om nøglen gik i POST-body til /api/ordre.</p>
<table><tr><th>Side</th><th>Adresselinje</th><th class="n">Adresser med nøgle</th><th class="n">Plausible med nøgle</th><th>Plausible url</th><th>Nøgle i POST-body</th></tr>${r10}</table>
<h2>Konsolfejl</h2>${konsol ? `<table><tr><th>Side</th><th>Fejl</th></tr>${konsol}</table>` : '<p class="l">Ingen.</p>'}
</main></body></html>`;
}
