// api.neminventar.dk — lille proxy, så besøgeren kun rammer *.neminventar.dk.
// Firmanetværkenes webfiltre vurderer hvert domæne for sig; supabase.co og plausible.io blokeres ofte.
//
// Cloudflare Pages-projektet neminventar-api i "advanced mode": denne fil ER projektet (ingen statiske filer).
// Udgives af .github/workflows/api.yml (push til main, når api/ ændres, + workflow_dispatch).
// Eget domæne: .github/workflows/api-domaene.yml. Sitet bruger proxyen, når API_AKTIV = true i src/lib/api.ts.
//
// Ruter — alt andet (også forkert metode) er 404:
//   GET|POST|OPTIONS /contact-form                     → Supabase edge function contact-form. CORS styres af funktionen.
//   PUT|OPTIONS      /storage/v1/object/upload/sign/*  → Supabase Storage: filupload, token i query-strengen.
//   GET              /js/script.js                     → Plausible-scriptet (cache 1 dag).
//   POST             /api/event                        → Plausible (deres proxy-vejledning for Cloudflare).
// Test: node --test api/test/

const SUPABASE = 'https://guhbrpektblabndqttgp.supabase.co';
const PLAUSIBLE_SCRIPT = 'https://plausible.io/js/pa-HNaluSTt8ee5v0U7h3J8z.js';
const PLAUSIBLE_EVENT = 'https://plausible.io/api/event';
const UPLOAD = '/storage/v1/object/upload/sign/';
const SCRIPT_CACHE = 'public, max-age=86400';

const PREFLIGHT = ['access-control-request-method', 'access-control-request-headers'];

// Kun de navngivne headere sendes videre (aldrig cookies), plus besøgerens IP som x-forwarded-for.
function headere(req, navne) {
  const h = new Headers();
  for (const n of navne) {
    const v = req.headers.get(n);
    if (v !== null) h.set(n, v);
  }
  const ip = req.headers.get('cf-connecting-ip');
  if (ip) h.set('x-forwarded-for', ip);
  return h;
}

// Upstreams svar uændret: status, body og headere (også CORS).
const videre = (up) => new Response(up.body, { status: up.status, statusText: up.statusText, headers: up.headers });

// Når upstream ikke kan nås: 502 uden CORS-headere. Browseren ser en netværksfejl og prøver selv supabase.co én gang.
const ikkeNaaet = () => new Response('Bad gateway', { status: 502 });
const ikkeFundet = () => new Response('Not found', { status: 404 });

// Upload-body sendes som stream. FixedLengthStream (kun i Workers) bevarer Content-Length, så Storage kender filens størrelse.
function streamBody(req) {
  const len = Number(req.headers.get('content-length'));
  if (typeof FixedLengthStream === 'function' && req.body && Number.isSafeInteger(len) && len > 0) {
    const { readable, writable } = new FixedLengthStream(len);
    req.body.pipeTo(writable).catch(() => {});
    return readable;
  }
  return req.body;
}

async function kontaktformular(req) {
  const preflight = req.method === 'OPTIONS';
  const init = {
    method: req.method,
    headers: headere(req, ['content-type', 'origin', ...(preflight ? PREFLIGHT : [])]),
  };
  if (req.method === 'POST') init.body = req.body;
  return videre(await fetch(`${SUPABASE}/functions/v1/contact-form`, init));
}

async function upload(req, url) {
  const preflight = req.method === 'OPTIONS';
  const init = {
    method: req.method,
    headers: headere(req, ['content-type', 'origin', 'x-upsert', 'cache-control', ...(preflight ? PREFLIGHT : [])]),
  };
  if (req.method === 'PUT') init.body = streamBody(req);
  return videre(await fetch(SUPABASE + url.pathname + url.search, init));
}

async function script(req, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(new URL('/js/script.js', req.url).href);
  if (cache) {
    const hit = await cache.match(key).catch(() => null);
    if (hit) return hit;
  }
  const up = await fetch(PLAUSIBLE_SCRIPT);
  const res = new Response(up.body, { status: up.status, statusText: up.statusText, headers: up.headers });
  if (!up.ok) return res;
  res.headers.set('cache-control', SCRIPT_CACHE);
  if (cache) {
    const gem = cache.put(key, res.clone()).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(gem);
  }
  return res;
}

async function event(req) {
  return videre(await fetch(PLAUSIBLE_EVENT, {
    method: 'POST',
    headers: headere(req, ['user-agent', 'content-type']),
    body: req.body,
  }));
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    const m = req.method;
    try {
      if (p === '/contact-form' && (m === 'GET' || m === 'POST' || m === 'OPTIONS')) return await kontaktformular(req);
      if (p.startsWith(UPLOAD) && p.length > UPLOAD.length && (m === 'PUT' || m === 'OPTIONS')) return await upload(req, url);
      if (p === '/js/script.js' && m === 'GET') return await script(req, ctx);
      if (p === '/api/event' && m === 'POST') return await event(req);
    } catch {
      return ikkeNaaet();
    }
    return ikkeFundet();
  },
};
