// Fake ni-konto i hukommelsen: de samme RPC'er som konto/sql/002_funktioner.sql, med samme svar og samme lofter.
// Hver RPC kører synkront (ingen await indeni), så den er atomisk ligesom én SQL-transaktion — også når testen fyrer
// 50 kald af på én gang. Uret er testens (nu()), dag og time regnes i Europe/Copenhagen som i SQL'en.
// nede = true → hvert kald kaster DbFejl('nede') (ni-konto er nede).
import { DbFejl } from '../src/db.js';

const MIN = 60_000;
const TIME = 60 * MIN;
const DAG = 24 * TIME;

const kbh = (ms, opt) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', ...opt }).format(new Date(ms));
const dag = (ms) => kbh(ms);                                                         // YYYY-MM-DD
const time = (ms) => `${dag(ms)}T${kbh(ms, { hour: '2-digit', hourCycle: 'h23' }).padStart(2, '0')}`;
const timeSlut = (ms) => Math.floor(ms / TIME) * TIME + TIME;
function doegnSlut(ms) {
  // næste midnat dansk tid: gå frem til datoen skifter, så tilbage til timen hvor den skiftede
  const d0 = dag(ms);
  let t = Math.floor(ms / TIME) * TIME;
  while (dag(t) === d0) t += TIME;
  return t;
}
const iso = (ms) => new Date(ms).toISOString();

export function lavFakeDb(nu) {
  const s = {
    kunder: new Map(),      // id → {id, email, sprog, oprettet, sidst_set}
    koder: new Map(),       // id → {...}
    lofter: new Map(),      // noegle → {antal, udloeber}
    sessioner: new Map(),   // id → {...}
    designs: new Map(),     // id → {...}
    haendelser: [],
  };
  const kald = [];
  const db = { s, kald, nede: false, fejlPaa: new Set() };

  const tael = (noegle, udloeber) => {
    const r = s.lofter.get(noegle);
    if (r) { r.antal += 1; return r.antal; }
    s.lofter.set(noegle, { antal: 1, udloeber });
    return 1;
  };
  const taelMedLoft = (noegle, max, udloeber) => {
    const r = s.lofter.get(noegle);
    if (!r) { s.lofter.set(noegle, { antal: 1, udloeber }); return 1; }
    if (r.antal >= max) return null;
    r.antal += 1;
    return r.antal;
  };
  const kundeAfEmail = (email) => [...s.kunder.values()].find((k) => k.email === email);

  function intern_forsoeg({ p_kode_id, p_formaal, p_kode_hmac, p_email_hmac, p_email_krav }) {
    const t = nu();
    const budget = `forkert:${p_email_hmac}:${dag(t)}`;
    const n = taelMedLoft(budget, 20, doegnSlut(t));
    if (n === null) return { fejl: 'doegn' };
    const k = s.koder.get(p_kode_id);
    const passer = k && k.formaal === p_formaal && (p_email_krav == null || k.email === p_email_krav);
    if (!passer || k.brugt !== null || k.forsoeg >= 5 || !(k.udloeber > t)) {
      s.lofter.get(budget).antal -= 1;
      return { fejl: passer && k.forsoeg >= 5 ? 'laast' : 'udloebet' };
    }
    k.forsoeg += 1;
    const rigtig = k.kode_hmac === p_kode_hmac;
    if (rigtig) {
      k.brugt = t;
      s.lofter.get(budget).antal -= 1;
      return { rigtig: true, email: k.email, retur: k.retur, sprog: k.sprog };
    }
    const fh = tael(`forkert_alle:${time(t)}`, timeSlut(t));
    return { fejl: n >= 20 ? 'doegn' : k.forsoeg >= 5 ? 'laast' : 'forkert', tilbage: 5 - k.forsoeg, forkerte_time: fh };
  }

  const gyldigSession = (r, t) => r && r.lukket === null && r.sidst_brugt > t - 30 * DAG && r.udloeber_absolut > t;

  const RPC = {
    loft_tael({ p_noegle, p_max, p_periode }) {
      if (!/^[a-z_]{1,30}:[A-Za-z0-9_-]{1,100}$/.test(p_noegle ?? '')) throw new DbFejl('http_400');
      const t = nu();
      const [suffix, slut] = p_periode === 'time' ? [time(t), timeSlut(t)] : p_periode === 'doegn' ? [dag(t), doegnSlut(t)] : [null];
      if (!suffix) throw new DbFejl('http_400');
      const n = taelMedLoft(`${p_noegle}:${suffix}`, p_max, slut);
      return { ok: n !== null, antal: n ?? p_max };
    },

    kode_opret({ p_email, p_email_hmac, p_ip_hash, p_formaal, p_sprog, p_kode_id, p_kode_hmac, p_peber_v, p_retur = null }) {
      if (!['log_ind', 'slet'].includes(p_formaal)) throw new DbFejl('http_400');
      if (!p_email || p_email !== p_email.toLowerCase()) throw new DbFejl('http_400');
      if (!/^[0-9a-f]{64}$/.test(p_email_hmac ?? '')) throw new DbFejl('http_400');
      const t = nu();
      const byge = () => tael(`byge:${time(t)}`, timeSlut(t));
      if ((s.lofter.get(`forkert:${p_email_hmac}:${dag(t)}`)?.antal ?? 0) >= 20) return { fejl: 'doegn', byge: byge() };
      const n = [...s.koder.values()].filter((k) => k.email === p_email && k.oprettet > t - 15 * MIN).length;
      if (n >= 3) return { fejl: 'loft', hvor: 'email', byge: byge() };
      // undertransaktionen: tæl op, og rul tilbage hvis et loft er nået
      const ipN = `ip:${p_ip_hash ?? 'ukendt'}:${time(t)}`;
      const alleN = `alle:${dag(t)}`;
      const foer = { ip: s.lofter.get(ipN) && { ...s.lofter.get(ipN) }, alle: s.lofter.get(alleN) && { ...s.lofter.get(alleN) } };
      const vIp = tael(ipN, timeSlut(t));
      const vAlle = tael(alleN, doegnSlut(t));
      const hvor = vIp > 10 ? 'ip' : vAlle > 150 ? 'alle' : null;
      if (hvor) {
        for (const [n2, f] of [[ipN, foer.ip], [alleN, foer.alle]]) if (f) s.lofter.set(n2, f); else s.lofter.delete(n2);
        return { fejl: 'loft', hvor, byge: byge() };
      }
      for (const k of s.koder.values()) if (k.email === p_email && k.formaal === p_formaal && k.brugt === null) k.brugt = t;
      if (s.koder.has(p_kode_id)) throw new DbFejl('http_409');
      s.koder.set(p_kode_id, {
        id: p_kode_id, email: p_email, formaal: p_formaal, sprog: p_sprog === 'en' ? 'en' : 'da', kode_hmac: p_kode_hmac,
        peber_v: p_peber_v, retur: p_retur, oprettet: t, udloeber: t + (p_formaal === 'slet' ? 10 : 15) * MIN, forsoeg: 0, brugt: null,
      });
      return { ok: true, alle: vAlle };
    },

    kode_aktiv({ p_email, p_formaal }) {
      const k = [...s.koder.values()].filter((x) => x.email === p_email && x.formaal === p_formaal && x.brugt === null)
        .sort((a, b) => b.oprettet - a.oprettet)[0];
      return k ? { kode_id: k.id, peber_v: k.peber_v } : {};
    },

    kode_tjek({ p_kode_id, p_kode_hmac, p_email_hmac, p_token_sha256 }) {
      if (!/^[0-9a-f]{64}$/.test(p_token_sha256 ?? '')) throw new DbFejl('http_400');
      const v = intern_forsoeg({ p_kode_id, p_formaal: 'log_ind', p_kode_hmac, p_email_hmac, p_email_krav: null });
      if (!v.rigtig) return v;
      const t = nu();
      for (const k of s.koder.values()) if (k.email === v.email && k.brugt === null) k.brugt = t;
      let kunde = kundeAfEmail(v.email);
      const ny = !kunde;
      if (kunde) kunde.sidst_set = t;
      else {
        kunde = { id: crypto.randomUUID(), email: v.email, sprog: v.sprog ?? 'da', oprettet: t, sidst_set: t };
        s.kunder.set(kunde.id, kunde);
      }
      const id = crypto.randomUUID();
      s.sessioner.set(id, { id, kunde_id: kunde.id, token_sha256: p_token_sha256, oprettet: t, sidst_brugt: t, udloeber_absolut: t + 90 * DAG, lukket: null });
      return { ok: true, ny, retur: v.retur ?? null, udloeber_absolut: iso(t + 90 * DAG) };
    },

    session_forny({ p_token_sha256 }) {
      const t = nu();
      const r = [...s.sessioner.values()].find((x) => x.token_sha256 === p_token_sha256);
      const kunde = r && s.kunder.get(r.kunde_id);
      if (!kunde || !gyldigSession(r, t)) return {};
      r.sidst_brugt = t;
      if (kunde.sidst_set < t - TIME) kunde.sidst_set = t;
      return { kunde_id: kunde.id, email: kunde.email, sprog: kunde.sprog, udloeber_absolut: iso(r.udloeber_absolut) };
    },

    session_luk({ p_token_sha256 }) {
      for (const r of s.sessioner.values()) if (r.token_sha256 === p_token_sha256 && r.lukket === null) r.lukket = nu();
      return { ok: true };
    },

    session_luk_alle({ p_token_sha256 }) {
      const t = nu();
      const r = [...s.sessioner.values()].find((x) => x.token_sha256 === p_token_sha256);
      if (!gyldigSession(r, t)) return { ok: false };
      let n = 0;
      for (const x of s.sessioner.values()) if (x.kunde_id === r.kunde_id && x.lukket === null) { x.lukket = t; n += 1; }
      return { ok: true, antal: n };
    },

    konto_slet({ p_kunde_id, p_kode_id, p_kode_hmac, p_email_hmac }) {
      const kunde = s.kunder.get(p_kunde_id);
      if (!kunde) return { fejl: 'udloebet' };
      const v = intern_forsoeg({ p_kode_id, p_formaal: 'slet', p_kode_hmac, p_email_hmac, p_email_krav: kunde.email });
      if (!v.rigtig) return v;
      s.kunder.delete(p_kunde_id);
      for (const [id, r] of s.sessioner) if (r.kunde_id === p_kunde_id) s.sessioner.delete(id);
      for (const [id, r] of s.designs) if (r.kunde_id === p_kunde_id) s.designs.delete(id);
      for (const [id, r] of s.koder) if (r.email === kunde.email) s.koder.delete(id);
      return { ok: true };
    },

    design_gem({ p_kunde_id, p_produkt, p_tilstand, p_navn, p_pris_oere, p_titel = null }) {
      if (!s.kunder.has(p_kunde_id)) throw new DbFejl('http_409');
      const t = nu();
      if (taelMedLoft(`gem:${p_kunde_id}:${dag(t)}`, 50, doegnSlut(t)) === null) return { fejl: 'loft' };
      const id = crypto.randomUUID();
      s.designs.set(id, { id, kunde_id: p_kunde_id, produkt: p_produkt, tilstand: p_tilstand, navn: p_navn ?? null, titel: p_titel ?? null, pris_ved_gem: p_pris_oere ?? null, miniature: null, oprettet: t });
      return { ok: true, id };
    },

    design_liste({ p_kunde_id }) {
      return [...s.designs.values()].filter((d) => d.kunde_id === p_kunde_id)
        .sort((a, b) => b.oprettet - a.oprettet || (a.id < b.id ? -1 : 1))
        .map((d) => ({ id: d.id, produkt: d.produkt, navn: d.navn, titel: d.titel ?? null, t: d.tilstand, pris_oere: d.pris_ved_gem, gemt: iso(d.oprettet), miniature: d.miniature ?? null }));
    },

    design_slet({ p_kunde_id, p_id }) {
      const d = s.designs.get(p_id);
      if (!d || d.kunde_id !== p_kunde_id) return { fejl: 'ukendt' };
      s.designs.delete(p_id);
      return { ok: true };
    },

    design_navn({ p_kunde_id, p_id, p_navn }) {
      if (typeof p_navn !== 'string' || p_navn.length < 1 || p_navn.length > 80) return { fejl: 'navn' };
      const d = s.designs.get(p_id);
      if (!d || d.kunde_id !== p_kunde_id) return { fejl: 'ukendt' };
      d.navn = p_navn;
      return { ok: true };
    },

    haendelse({ p_type, p_email_hmac = null, p_ip_dag = null }) {
      if (!/^[a-z_]{1,40}$/.test(p_type ?? '')) throw new DbFejl('http_400');
      s.haendelser.push({ type: p_type, email_hmac: p_email_hmac, ip_dag: p_ip_dag, tid: nu() });
      return { ok: true };
    },

    rydop() {
      const t = nu();
      let koder = 0, lofter = 0, sessioner = 0;
      for (const [id, r] of s.koder) if (r.udloeber < t - DAG) { s.koder.delete(id); koder += 1; }
      for (const [n, r] of s.lofter) if (r.udloeber < t - DAG) { s.lofter.delete(n); lofter += 1; }
      for (const [id, r] of s.sessioner) {
        const slut = r.lukket ?? Math.min(r.udloeber_absolut, r.sidst_brugt + 30 * DAG);
        if (slut < t - DAG) { s.sessioner.delete(id); sessioner += 1; }
      }
      return { koder, lofter, sessioner };
    },

    rydop_haendelser() {
      const t = new Date(nu());
      t.setUTCMonth(t.getUTCMonth() - 12);
      const foer = s.haendelser.length;
      s.haendelser = s.haendelser.filter((h) => h.tid >= t.getTime());
      return { haendelser: foer - s.haendelser.length };
    },
  };

  db.rpc = async (fn, args = {}) => {
    kald.push(fn);
    if (db.nede || db.fejlPaa.has(fn)) throw new DbFejl('nede');
    if (!Object.hasOwn(RPC, fn)) throw new DbFejl('http_404');
    // JSON frem og tilbage som gennem PostgREST: ingen delte objekter mellem Worker og "database"
    const r = RPC[fn](JSON.parse(JSON.stringify(args)));
    return r === undefined ? null : JSON.parse(JSON.stringify(r));
  };
  return db;
}
