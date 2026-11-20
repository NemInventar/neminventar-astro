// Turnstile før en login-kode sendes (S10, plan §2). Fejler lukket: alt andet end et entydigt ja fra Cloudflare
// (success, rigtig handling og rigtig vært) er et nej — også manglende nøgle, netværksfejl og mærkelige svar.
import { TURNSTILE_ACTION } from './regler.js';

export const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAKS_TOKEN = 2048;
const TIMEOUT_MS = 10_000;

export async function turnstileOk(hemmelighed, token, ip, vaert, fetcher) {
  if (typeof hemmelighed !== 'string' || !hemmelighed) return false;
  if (typeof token !== 'string' || !token || token.length > MAKS_TOKEN) return false;
  // Samme idempotency_key ved det ene nye forsøg (Cloudflares anbefaling ved netværksfejl og 5xx)
  const form = new URLSearchParams({ secret: hemmelighed, response: token, idempotency_key: crypto.randomUUID() });
  if (ip) form.set('remoteip', ip);
  const post = () => fetcher(SITEVERIFY, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  try {
    let res = null;
    try {
      res = await post();
    } catch {
      res = null;
    }
    if (res === null || res.status >= 500) res = await post();
    if (res.status !== 200) return false;
    const d = await res.json();
    if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
    if (d.success !== true || d.action !== TURNSTILE_ACTION) return false;
    return typeof d.hostname === 'string' && d.hostname.toLowerCase() === vaert.toLowerCase();
  } catch {
    return false;
  }
}
