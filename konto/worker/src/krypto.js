// Kryptografi med Web Crypto alene (R16): kører i Workers og i Node 22+ (testene). Ingen afhængigheder.

const enc = new TextEncoder();

export function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fraB64url(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error('base64url');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(tekst) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(tekst)));
}

export async function hmacBytes(noegle, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(noegle), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}

export async function hmacHex(noegle, data) {
  return hex(await hmacBytes(noegle, data));
}

export const tilfaeldigeBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

// R6: sessionens cookie, 32 tilfældige bytes = 43 tegn base64url
export const nyToken = () => b64url(tilfaeldigeBytes(32));
export const erToken = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{43}$/.test(x);

// R1: seks cifre, jævnt fordelt. Værdier over det største multiplum af 1.000.000 under 2^32 kasseres (ingen
// modulo-skævhed). `kilde` kan erstattes i testen.
export const KODE_GRAENSE = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
export function nyKode(kilde = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  for (;;) {
    const v = kilde();
    if (v < KODE_GRAENSE) return String(v % 1_000_000).padStart(6, '0');
  }
}

// Sammenligning, hvis tid ikke afhænger af, hvor tidligt strengene er forskellige
export function sammeKonstantTid(a, b) {
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  const n = Math.max(x.length, y.length);
  let d = x.length ^ y.length;
  for (let i = 0; i < n; i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
