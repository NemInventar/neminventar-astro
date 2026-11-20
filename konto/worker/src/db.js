// Klient til ni-konto: kun RPC'erne i konto/sql/002_funktioner.sql via PostgREST, med servernøglen.
// Fejl bliver DbFejl uden detaljer fra svaret (de kan rumme data fra anmodningen, R17).

export class DbFejl extends Error {
  constructor(kode) {
    super(kode);
    this.name = 'DbFejl';
    this.kode = kode;
  }
}

const FN = /^[a-z_]{3,40}$/;
const ARG = /^p_[a-z0-9_]{1,40}$/;
const TIMEOUT_MS = 10_000;

// Nye hemmelige nøgler (sb_secret_…) er ikke JWT'er og må kun stå i apikey; gamle service_role-JWT'er også som Bearer
export const supabaseHeadere = (noegle) =>
  noegle.startsWith('sb_secret_') ? { apikey: noegle } : { apikey: noegle, authorization: `Bearer ${noegle}` };

export function lavDb(url, noegle, fetcher) {
  return {
    async rpc(fn, args = {}) {
      if (!url || !noegle) throw new DbFejl('konfig');
      if (!FN.test(fn)) throw new DbFejl('fn');
      const krop = {};
      for (const [k, v] of Object.entries(args)) {
        if (!ARG.test(k)) throw new DbFejl('arg');
        if (v !== undefined) krop[k] = v;
      }
      let res;
      try {
        res = await fetcher(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
          method: 'POST',
          headers: { ...supabaseHeadere(noegle), 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(krop),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new DbFejl('nede');
      }
      const tekst = await res.text().catch(() => '');
      if (!res.ok) throw new DbFejl(res.status >= 500 ? 'nede' : `http_${res.status}`);
      if (!tekst.trim()) return null;
      try {
        return JSON.parse(tekst);
      } catch {
        throw new DbFejl('svar');
      }
    },
  };
}
