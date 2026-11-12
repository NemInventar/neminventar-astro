// Mail via Microsoft Graph som appen "NI Konto" (plan §2, S2). Afsender konto@ (MAIL_FRA), svar til tilbud@
// (MAIL_SVAR_TIL), saveToSentItems: false — koder må ikke ligge i en læsbar Sendt-mappe. Appen må kun sende fra konto@
// (Exchange-rolletildeling med scope, skabelon ni-underskriv/ops/fase0a-exchange.ps1).
// Login som app med certifikat (GRAPH_CERT_PEM + GRAPH_KEY_PEM, PKCS8) — eller GRAPH_CLIENT_SECRET, hvis der ikke er
// et certifikat. Fejl bliver MailFejl med en kort kode; aldrig mailens indhold eller modtager (R17).
import { b64url } from './krypto.js';

export class MailFejl extends Error {
  constructor(kode) {
    super(kode);
    this.name = 'MailFejl';
    this.kode = kode;
  }
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
const TIMEOUT_MS = 15_000;
const SIKKER_KODE = /^[A-Za-z][A-Za-z0-9_.]{0,79}$/;

// Token pr. app i isolatet; samtidige mails deler ét tokenkald
const tokens = new Map();
const noegler = new Map();
export const glemTokens = () => { tokens.clear(); noegler.clear(); };

function pemBlok(pem, etiket) {
  const m = new RegExp(`-----BEGIN ${etiket}-----([A-Za-z0-9+/=\\s]+)-----END ${etiket}-----`).exec(pem ?? '');
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/\s+/g, ''));
    return bin.length ? Uint8Array.from(bin, (c) => c.charCodeAt(0)) : null;
  } catch {
    return null;
  }
}

async function signering(env) {
  const id = `${env.GRAPH_CLIENT_ID}:${(env.GRAPH_CERT_PEM ?? '').length}`;
  if (noegler.has(id)) return noegler.get(id);
  const p = (async () => {
    const cert = pemBlok(env.GRAPH_CERT_PEM, 'CERTIFICATE');
    const pkcs8 = pemBlok(env.GRAPH_KEY_PEM, 'PRIVATE KEY');
    if (!cert || !pkcs8) throw new MailFejl('graph_cert');
    let key;
    try {
      key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    } catch {
      throw new MailFejl('graph_noegle');
    }
    const [sha1, sha256] = await Promise.all([crypto.subtle.digest('SHA-1', cert), crypto.subtle.digest('SHA-256', cert)]);
    return { key, x5t: b64url(new Uint8Array(sha1)), x5tS256: b64url(new Uint8Array(sha256)) };
  })();
  noegler.set(id, p);
  p.catch(() => noegler.delete(id));
  return p;
}

const b64json = (v) => b64url(new TextEncoder().encode(JSON.stringify(v)));

async function assertion(env, tokenUrl, nu) {
  const { key, x5t, x5tS256 } = await signering(env);
  const iat = Math.floor(nu / 1000);
  const hoved = { alg: 'RS256', typ: 'JWT', x5t, 'x5t#S256': x5tS256 };
  const krop = { aud: tokenUrl, iss: env.GRAPH_CLIENT_ID, sub: env.GRAPH_CLIENT_ID, jti: crypto.randomUUID(), nbf: iat, iat, exp: iat + 600 };
  const ind = `${b64json(hoved)}.${b64json(krop)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(ind));
  return `${ind}.${b64url(new Uint8Array(sig))}`;
}

async function kald(fetcher, url, init) {
  try {
    return await fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new MailFejl('netvaerk');
  }
}

async function hentToken(env, fetcher, nu) {
  if (!env.GRAPH_TENANT || !env.GRAPH_CLIENT_ID) throw new MailFejl('graph_konfig');
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(env.GRAPH_TENANT)}/oauth2/v2.0/token`;
  const form = new URLSearchParams({ client_id: env.GRAPH_CLIENT_ID, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' });
  if (env.GRAPH_CERT_PEM && env.GRAPH_KEY_PEM) {
    form.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    form.set('client_assertion', await assertion(env, tokenUrl, nu));
  } else if (env.GRAPH_CLIENT_SECRET) {
    form.set('client_secret', env.GRAPH_CLIENT_SECRET);
  } else {
    throw new MailFejl('graph_konfig');
  }
  const res = await kald(fetcher, tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || typeof d.access_token !== 'string' || !d.access_token) {
    throw new MailFejl(`token_${typeof d.error === 'string' && SIKKER_KODE.test(d.error) ? d.error : res.status}`);
  }
  const udloeber = Number(d.expires_in);
  return { vaerdi: d.access_token, fornyAt: nu + (Number.isFinite(udloeber) ? udloeber : 3600) * 1000 - 5 * 60 * 1000 };
}

async function token(env, fetcher, nu, ny = false) {
  const id = `${env.GRAPH_TENANT}:${env.GRAPH_CLIENT_ID}`;
  const t = tokens.get(id);
  if (!ny && t && !(t instanceof Promise) && nu < t.fornyAt) return t.vaerdi;
  if (!ny && t instanceof Promise) return (await t).vaerdi;
  const p = hentToken(env, fetcher, nu);
  tokens.set(id, p);
  try {
    const v = await p;
    tokens.set(id, v);
    return v.vaerdi;
  } catch (e) {
    tokens.delete(id);
    throw e;
  }
}

// mail = { til, emne, tekst }. Sendes som ren tekst (fable d6 er skrevet som tekst).
export async function sendMail(env, fetcher, mail, nu = Date.now()) {
  const fra = env.MAIL_FRA;
  if (!fra) throw new MailFejl('graph_konfig');
  const besked = {
    message: {
      subject: mail.emne,
      body: { contentType: 'Text', content: mail.tekst },
      from: { emailAddress: { name: 'Nem Inventar', address: fra } },
      toRecipients: [{ emailAddress: { address: mail.til } }],
      ...(env.MAIL_SVAR_TIL ? { replyTo: [{ emailAddress: { name: 'Nem Inventar', address: env.MAIL_SVAR_TIL } }] } : {}),
    },
    saveToSentItems: false,
  };
  const url = `${GRAPH}/users/${encodeURIComponent(fra)}/sendMail`;
  for (let forsoeg = 1; ; forsoeg++) {
    const t = await token(env, fetcher, nu, forsoeg > 1);
    const res = await kald(fetcher, url, {
      method: 'POST',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: JSON.stringify(besked),
    });
    if (res.status === 202 || res.ok) return;
    const d = await res.json().catch(() => ({}));
    // 401: tokenet kan være tilbagekaldt før tid. Kaldet er ikke udført, så ét nyt forsøg med et nyt token er sikkert.
    if (res.status === 401 && forsoeg === 1) continue;
    const kode = d && typeof d.error === 'object' && SIKKER_KODE.test(d.error?.code ?? '') ? d.error.code : `http_${res.status}`;
    throw new MailFejl(kode);
  }
}
