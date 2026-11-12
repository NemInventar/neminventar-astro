// Lokal fake af konto.neminventar.dk til skærmbilleder og browsertjek: serverer et dist-konto-build med dets egne
// _headers (CSP osv.) og _redirects og svarer på /api/* efter kontrakter.md §6 med fixtures (konto/test/fixtures.mjs).
// Ingen rigtige kald: ingen Worker, ingen bro, ingen mails.
//
//   const s = await startFake({ dist, port: 0 }); s.url; s.tilstand.session = {email}; await s.luk();
//
// Statusnøglerne er 22 tegn som de rigtige (kontrakter §4): `t03u` + x'er = tilstand 3 uden login, `t03m…` = med login.
// Særlige nøgler: ukendt…, erstattet…, nede…, lukket… (fyldt op med x til 22 tegn). v05au… / v14um… = runde 4-varianterne.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ordreI, minSideData, EMAIL } from '../test/fixtures.mjs';

export const noegle = (s) => s.padEnd(22, 'x');
export const tilstandsNoegle = (nr, visning) => (typeof nr === 'string'
  ? noegle(`v${nr}${visning === 'med_login' ? 'm' : 'u'}`)
  : noegle(`t${String(nr).padStart(2, '0')}${visning === 'med_login' ? 'm' : 'u'}`));

const TYPER = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};

function laesHeaders(tekst) {
  const regler = [];
  let r = null;
  for (const linje of tekst.split(/\r?\n/)) {
    if (!linje.trim() || linje.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(linje)) { r = { moenster: linje.trim(), h: [] }; regler.push(r); continue; }
    const i = linje.indexOf(':');
    r.h.push([linje.slice(0, i).trim(), linje.slice(i + 1).trim()]);
  }
  return regler;
}
const passer = (moenster, sti) => new RegExp(`^${moenster.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(sti);

export async function startFake({ dist, port = 0 } = {}) {
  const headere = laesHeaders(await readFile(path.join(dist, '_headers'), 'utf8').catch(() => ''));
  const omdirigeringer = (await readFile(path.join(dist, '_redirects'), 'utf8').catch(() => ''))
    .split(/\r?\n/).filter(Boolean).map((l) => l.split(/\s+/));
  const tilstand = {
    session: null,              // {email, ny}
    kontoAktiv: true,
    ordrestatusAktiv: true,
    minSide: 'fuld',            // fuld | tom | nede (broen) | helt-nede (hele siden) | status (runde 4 statuskolonnen)
    refNr: 3,                   // tilstanden for /api/ordre-ref
    handlingFejler: false,      // design- og "ikke min"-handlingerne svarer 500
    forkerte: 0,
    kald: [],                   // [{metode, sti, body}] — til tjek af, hvad siden sender
  };

  const json = (res, status, data) => {
    // Workerens headere (SIKKERHEDSHEADERE i konto/worker/src/app.js) minus HSTS, der intet betyder lokalt over http
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'", 'referrer-policy': 'no-referrer' });
    res.end(JSON.stringify(data));
  };

  async function api(req, res, sti, body) {
    const t = tilstand;
    const flagKonto = () => { if (!t.kontoAktiv) { json(res, 503, { fejl: 'lukket' }); return false; } return true; };
    const kraevSession = () => { if (!t.session) { json(res, 401, { fejl: 'login' }); return false; } return true; };
    switch (sti) {
      case '/api/mig':
        return json(res, 200, t.session && t.kontoAktiv
          ? { logget_ind: true, email: t.session.email, konto_aktiv: t.kontoAktiv, ordrestatus_aktiv: t.ordrestatusAktiv }
          : { logget_ind: false, konto_aktiv: t.kontoAktiv, ordrestatus_aktiv: t.ordrestatusAktiv });
      case '/api/ordre': {
        if (!t.ordrestatusAktiv) return json(res, 503, { fejl: 'lukket' });
        const n = String(body.noegle ?? '');
        // som Workeren (kontrakter §6, rettet 12-11): ukendt og erstattet er 200 med {fejl}
        if (!/^[A-Za-z0-9_-]{22}$/.test(n)) return json(res, 200, { fejl: 'ukendt' });
        if (n.startsWith('erstattet')) return json(res, 200, { fejl: 'erstattet' });
        if (n.startsWith('nede')) return json(res, 503, { fejl: 'nede' });
        if (n.startsWith('lukket')) return json(res, 503, { fejl: 'lukket' });
        const v = /^v(\d\d[a-z])([um])/.exec(n);   // runde 4-varianterne (fixtures VARIANTER)
        const m = v ?? /^t(\d\d)([um])/.exec(n);
        if (!m) return json(res, 200, { fejl: 'ukendt' });
        const visning = m[2] === 'm' && t.kontoAktiv ? 'med_login' : 'uden_login';
        return json(res, 200, { visning, ordre: ordreI(v ? m[1] : Number(m[1]), visning, { medLaek: false }) });
      }
      case '/api/ordre-ref':
        if (!flagKonto() || !kraevSession()) return undefined;
        return json(res, 200, { visning: 'med_login', ordre: ordreI(t.refNr, 'med_login', { medLaek: false }) });
      case '/api/kode':
        if (!flagKonto()) return undefined;
        if (!body.turnstile) return json(res, 403, { fejl: 'robot' });
        t.forkerte = 0;
        return json(res, 200, { ok: true });
      case '/api/kode/tjek':
        if (!flagKonto()) return undefined;
        if (String(body.kode) === '123456') {
          t.session = { email: String(body.email).toLowerCase(), ny: true };
          return json(res, 200, { ok: true, retur: null, ny: true });
        }
        t.forkerte += 1;
        if (t.forkerte >= 5) return json(res, 400, { fejl: 'laast' });
        return json(res, 400, { fejl: 'forkert', tilbage: 5 - t.forkerte });
      case '/api/min-side': {
        if (!flagKonto() || !kraevSession()) return undefined;
        if (t.minSide === 'helt-nede') return json(res, 503, { fejl: 'nede' });   // ni-konto nede: hele siden (side.nede)
        const d = minSideData({ tom: t.minSide === 'tom', nede: t.minSide === 'nede', status: t.minSide === 'status' });
        return json(res, 200, { ...d, email: t.minSide === 'tom' ? d.email : t.session.email || EMAIL });
      }
      case '/api/log-ud':
        t.session = null;
        return json(res, 200, { ok: true });
      case '/api/slet/kode':
        if (!flagKonto() || !kraevSession()) return undefined;
        return json(res, 200, { ok: true });
      case '/api/slet':
        if (!flagKonto() || !kraevSession()) return undefined;
        if (String(body.kode) !== '123456') return json(res, 400, { fejl: 'forkert', tilbage: 4 });
        t.session = null;
        return json(res, 200, { ok: true });
      case '/api/design/slet': case '/api/design/navn': case '/api/gemt-uden-login/skjul': case '/api/ikke-min':
        if (!flagKonto() || !kraevSession()) return undefined;
        if (t.handlingFejler) return json(res, 500, { fejl: 'fejl' });   // side.fejl under handlingen
        return json(res, 200, { ok: true });
      default:
        return json(res, 404, { fejl: 'ukendt_sti' });
    }
  }

  async function statisk(req, res, sti) {
    for (const [fra, til, kode] of omdirigeringer) {
      if (fra === sti) { res.writeHead(Number(kode) || 302, { location: til }); res.end(); return; }
    }
    let fil = path.join(dist, decodeURIComponent(sti));
    let status = 200;
    try {
      if ((await stat(fil)).isDirectory()) fil = path.join(fil, 'index.html');
      await stat(fil);
    } catch {
      if (!path.extname(sti) && !sti.endsWith('/')) {
        try { await stat(path.join(dist, sti, 'index.html')); res.writeHead(308, { location: `${sti}/` }); res.end(); return; } catch { /* 404 */ }
      }
      fil = path.join(dist, '404.html');
      status = 404;
    }
    const h = { 'content-type': TYPER[path.extname(fil)] ?? 'application/octet-stream' };
    for (const r of headere) if (passer(r.moenster, sti)) for (const [k, v] of r.h) h[k] = v;
    delete h['Strict-Transport-Security'];   // lokalt over http
    res.writeHead(status, h);
    res.end(await readFile(fil));
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://lokal');
    try {
      if (url.pathname.startsWith('/api/')) {
        let body = {};
        if (req.method === 'POST') {
          if (!/^application\/json/.test(req.headers['content-type'] ?? '')) return json(res, 415, { fejl: 'type' });
          let s = '';
          for await (const c of req) s += c;
          body = s ? JSON.parse(s) : {};
        }
        tilstand.kald.push({ metode: req.method, sti: url.pathname, body });
        return await api(req, res, url.pathname, body);
      }
      return await statisk(req, res, url.pathname);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  const { port: p } = server.address();
  return { url: `http://127.0.0.1:${p}`, tilstand, luk: () => new Promise((ok) => server.close(ok)) };
}
