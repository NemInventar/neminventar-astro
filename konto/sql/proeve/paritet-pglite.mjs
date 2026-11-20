// Kører konto/sql/001+002 i PGlite (rigtig Postgres i WASM) og sammenligner hver RPC's svar med Workerens fake-db
// (konto/worker/test/fake-db.mjs), så testene mod fake-db'en også gælder SQL'en. Viser til sidst rettighederne.
// PGlite er ikke en afhængighed i repoet: PGLITE = stien til @electric-sql/pglite/dist/index.js (fx fra ni-underskrivs
// node_modules). Kør: PGLITE=C:/dev/ni-underskriv/node_modules/@electric-sql/pglite/dist/index.js node konto/sql/proeve/paritet-pglite.mjs
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const her = (sti) => new URL(sti, import.meta.url);
const { PGlite } = await import(process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : '@electric-sql/pglite');
const { lavFakeDb } = await import(her('../../worker/test/fake-db.mjs').href);

const pg = new PGlite();
// Som Supabase: rollerne findes, og public giver anon/authenticated alt som standard — 001 skal tage det tilbage
await pg.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;`);
await pg.exec(readFileSync(her('../001_skema.sql'), 'utf8'));
await pg.exec(readFileSync(her('../002_funktioner.sql'), 'utf8'));

const fake = lavFakeDb(() => Date.now());
const H = (c) => c.repeat(64);
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function sql(fn, args) {
  const navne = Object.keys(args);
  const r = await pg.query(`select public.${fn}(${navne.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`, navne.map((n) => args[n]));
  return r.rows[0].r;
}
// uuid'er og tidsstempler skiftes ud, så de to kan sammenlignes
const sorter = (x) => Array.isArray(x) ? x.map(sorter) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sorter(x[k])])) : x;
const norm = (x) => sorter(JSON.parse(JSON.stringify(x ?? null)
  .replace(/"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/g, '"<uuid>"')
  .replace(/"\d{4}-\d{2}-\d{2}T[0-9:.+Z-]+"/g, '"<tid>"')));

let fejl = 0; let n = 0;
async function begge(fn, args, navn = fn) {
  n += 1;
  const a = norm(await sql(fn, args));
  const b = norm(await fake.rpc(fn, args));
  const ens = JSON.stringify(a) === JSON.stringify(b);
  if (!ens) { fejl += 1; console.log(`AFVIGER ${navn}\n  sql : ${JSON.stringify(a)}\n  fake: ${JSON.stringify(b)}`); }
  return a;
}
const sqlRaa = (q) => pg.query(q).then((r) => r.rows);

const E = 'e@example.com';
const opret = (id, email = E, extra = {}) => ({ p_email: email, p_email_hmac: H('a'), p_ip_hash: 'ip1', p_formaal: 'log_ind', p_sprog: 'da', p_kode_id: U(id), p_kode_hmac: H(String(id % 10)), p_peber_v: 1, p_retur: null, ...extra });

// 1. tre koder, den fjerde rammer loftet
for (const i of [1, 2, 3]) await begge('kode_opret', opret(i), `kode_opret ${i}`);
await begge('kode_opret', opret(4), 'kode_opret 4 (loft email)');
await begge('kode_aktiv', { p_email: E, p_formaal: 'log_ind' });
// 2. fem forkerte på den nyeste (id 3), derefter spærret
const tjek = (id, hmac, tok = H('f')) => ({ p_kode_id: U(id), p_kode_hmac: hmac, p_email_hmac: H('a'), p_token_sha256: tok });
for (let i = 0; i < 6; i++) await begge('kode_tjek', tjek(3, H('9')), `kode_tjek forkert ${i + 1}`);
await begge('kode_tjek', tjek(3, H('3')), 'kode_tjek rigtig efter spærring');
await begge('kode_tjek', tjek(1, H('1')), 'kode_tjek erstattet kode');
await begge('kode_tjek', tjek(999, H('1')), 'kode_tjek ukendt id');

// 3. ny e-mail: log ind, session, designs
const F = 'f@example.com';
await begge('kode_opret', { ...opret(10, F), p_email_hmac: H('b'), p_retur: 'https://konto.neminventar.dk/x' }, 'kode_opret f');
const login = await begge('kode_tjek', { ...tjek(10, H('0'), H('c')), p_email_hmac: H('b') }, 'kode_tjek f rigtig');
await begge('session_forny', { p_token_sha256: H('c') });
const kundeSql = (await sqlRaa(`select id from kunder where email = '${F}'`))[0].id;
const kundeFake = [...fake.s.kunder.values()].find((k) => k.email === F).id;
console.log('login', JSON.stringify(login));
// designs: kunde-id er forskellige i de to, så de kaldes hver for sig og sammenlignes normaliseret
async function beggeKunde(fn, args, navn) {
  n += 1;
  const a = norm(await sql(fn, { p_kunde_id: kundeSql, ...args(true) }));
  const b = norm(await fake.rpc(fn, { p_kunde_id: kundeFake, ...args(false) }));
  if (JSON.stringify(a) !== JSON.stringify(b)) { fejl += 1; console.log(`AFVIGER ${navn}\n  sql : ${JSON.stringify(a)}\n  fake: ${JSON.stringify(b)}`); }
  return { a, b };
}
const g = await beggeKunde('design_gem', () => ({ p_produkt: 'hoejskab', p_tilstand: 'eyJ9', p_navn: 'Skab', p_pris_oere: 987550 }), 'design_gem');
const gid = { sql: (await sqlRaa('select id from designs'))[0].id, fake: [...fake.s.designs.keys()][0] };
await beggeKunde('design_liste', () => ({}), 'design_liste');
await beggeKunde('design_navn', (s) => ({ p_id: s ? gid.sql : gid.fake, p_navn: 'Nyt' }), 'design_navn egen');
await begge('design_navn', { p_kunde_id: U(77), p_id: gid.sql, p_navn: 'x' }, 'design_navn fremmed (sql-id)');
await beggeKunde('design_navn', (s) => ({ p_id: s ? gid.sql : gid.fake, p_navn: 'x'.repeat(81) }), 'design_navn for langt');
await beggeKunde('design_slet', (s) => ({ p_id: U(5) }), 'design_slet ukendt');
await beggeKunde('design_slet', (s) => ({ p_id: s ? gid.sql : gid.fake }), 'design_slet egen');
void g;
// miniaturen (R4): base64 ind, bytea i kolonnen, base64 ud (Postgres bryder linjerne for hver 76 tegn — fake-db'en gør det samme)
const JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 120 }, (_, i) => i), 0xff, 0xd9]).toString('base64');
await beggeKunde('design_gem', () => ({ p_produkt: 'hoejskab', p_tilstand: 'eyJ9', p_navn: 'Med billede', p_pris_oere: 1, p_miniature: JPEG_B64, p_miniature_type: 'image/jpeg' }), 'design_gem med miniature');
const mid = { sql: (await sqlRaa("select id from designs where navn = 'Med billede'"))[0].id, fake: [...fake.s.designs.values()].find((d) => d.navn === 'Med billede').id };
await beggeKunde('design_liste', () => ({}), 'design_liste med har_miniature');
await beggeKunde('design_miniature', (s) => ({ p_id: s ? mid.sql : mid.fake }), 'design_miniature egen');
await begge('design_miniature', { p_kunde_id: U(77), p_id: mid.sql }, 'design_miniature fremmed');
await beggeKunde('design_miniature', () => ({ p_id: U(5) }), 'design_miniature ukendt');
console.log('miniature tilbage = sendt:', (await sql('design_miniature', { p_kunde_id: kundeSql, p_id: mid.sql })).b64.replace(/\s+/g, '') === JPEG_B64);

// 4. andet login (ny = false), log ud alle
await begge('kode_opret', { ...opret(11, F), p_email_hmac: H('b') }, 'kode_opret f 2');
await begge('kode_tjek', { ...tjek(11, H('1'), H('d')), p_email_hmac: H('b') }, 'kode_tjek f 2 (ny=false)');
await begge('session_luk', { p_token_sha256: H('c') });
await begge('session_forny', { p_token_sha256: H('c') }, 'session_forny efter luk');
await begge('session_luk_alle', { p_token_sha256: H('c') }, 'session_luk_alle med lukket session');
await begge('session_luk_alle', { p_token_sha256: H('d') }, 'session_luk_alle');
await begge('session_forny', { p_token_sha256: H('d') }, 'session_forny efter luk_alle');

// 5. slet konto
await begge('kode_opret', { ...opret(12, F), p_formaal: 'slet', p_email_hmac: H('b') }, 'kode_opret slet');
async function sletBegge(hmac, navn) {
  n += 1;
  const a = norm(await sql('konto_slet', { p_kunde_id: kundeSql, p_kode_id: U(12), p_kode_hmac: hmac, p_email_hmac: H('b') }));
  const b = norm(await fake.rpc('konto_slet', { p_kunde_id: kundeFake, p_kode_id: U(12), p_kode_hmac: hmac, p_email_hmac: H('b') }));
  if (JSON.stringify(a) !== JSON.stringify(b)) { fejl += 1; console.log(`AFVIGER ${navn}\n  sql : ${JSON.stringify(a)}\n  fake: ${JSON.stringify(b)}`); }
}
await sletBegge(H('9'), 'konto_slet forkert');
await sletBegge(H('2'), 'konto_slet rigtig');
const efter = await sqlRaa(`select (select count(*) from kunder where email='${F}') k, (select count(*) from sessioner) s, (select count(*) from designs) d, (select count(*) from koder where email='${F}') c`);
console.log('efter slet (sql):', JSON.stringify(efter[0]), 'fake:', [...fake.s.kunder.values()].filter((k) => k.email === F).length, fake.s.sessioner.size, fake.s.designs.size, [...fake.s.koder.values()].filter((k) => k.email === F).length);

// 6. dagsbudget: 20 forkerte over 4 koder (oprettet skubbes 20 min tilbage, så 15-min-loftet ikke rammer)
const G = 'g@example.com';
let sidste;
for (let k = 0; k < 4; k++) {
  await sqlRaa(`update koder set oprettet = oprettet - interval '20 minutes' where email = '${G}'`);
  for (const r of fake.s.koder.values()) if (r.email === G) r.oprettet -= 20 * 60_000;
  await begge('kode_opret', { ...opret(20 + k, G), p_email_hmac: H('e'), p_ip_hash: 'ip2' }, `kode_opret g ${k}`);
  for (let i = 0; i < 5; i++) sidste = await begge('kode_tjek', { ...tjek(20 + k, H('8')), p_email_hmac: H('e') }, `g kode ${k} forkert ${i}`);
}
console.log('20. forkerte:', JSON.stringify(sidste));
await sqlRaa(`update koder set oprettet = oprettet - interval '20 minutes' where email = '${G}'`);
for (const r of fake.s.koder.values()) if (r.email === G) r.oprettet -= 20 * 60_000;
await begge('kode_opret', { ...opret(30, G), p_email_hmac: H('e'), p_ip_hash: 'ip2' }, 'kode_opret efter døgnloft');

// 7. IP-loft med tilbagerulning
for (let i = 0; i < 11; i++) await begge('kode_opret', { ...opret(40 + i, `ip${i}@example.com`), p_ip_hash: 'ip3' }, `ip ${i}`);
const ipSql = (await sqlRaa(`select antal from lofter where noegle like 'ip:ip3:%'`))[0].antal;
console.log('ip-tæller efter afvist kald (sql, skal være 10):', ipSql);

// 8. loft_tael
for (let i = 0; i < 3; i++) await begge('loft_tael', { p_noegle: 'visning:abc', p_max: 2, p_periode: 'time' }, `loft_tael ${i}`);
await begge('haendelse', { p_type: 'login', p_email_hmac: H('a'), p_ip_dag: 'abcdef12' });

// 9. rydop
await sqlRaa(`update koder set udloeber = now() - interval '25 hours' where email = '${E}'`);
for (const r of fake.s.koder.values()) if (r.email === E) r.udloeber = Date.now() - 25 * 3600_000;
await begge('rydop', {}, 'rydop');
await begge('rydop_haendelser', {}, 'rydop_haendelser');

// 10. rettigheder og RLS
const ret = await sqlRaa(`select
  has_schema_privilege('anon','public','USAGE') anon_schema,
  has_schema_privilege('authenticated','public','USAGE') auth_schema,
  has_table_privilege('anon','public.kunder','SELECT') anon_kunder,
  has_table_privilege('authenticated','public.sessioner','SELECT') auth_sessioner,
  has_table_privilege('service_role','public.koder','UPDATE') service_koder,
  has_function_privilege('anon','public.kode_tjek(uuid,text,text,text)','EXECUTE') anon_kode_tjek,
  has_function_privilege('authenticated','public.konto_slet(uuid,uuid,text,text)','EXECUTE') auth_konto_slet,
  has_function_privilege('service_role','public.kode_tjek(uuid,text,text,text)','EXECUTE') service_kode_tjek,
  (select bool_and(relrowsecurity) from pg_class where relnamespace='public'::regnamespace and relkind='r') rls_paa_alle,
  (select count(*) from pg_policies where schemaname='public') politikker`);
console.log('rettigheder:', JSON.stringify(ret[0]));
let anonLaes;
try { await pg.exec('set role anon'); await pg.query('select * from public.kunder'); anonLaes = 'KAN LÆSE'; } catch (e) { anonLaes = `afvist: ${e.message}`; } finally { await pg.exec('reset role'); }
console.log('anon select kunder:', anonLaes);
console.log(`\n${n} sammenligninger, ${fejl} afvigelser`);
