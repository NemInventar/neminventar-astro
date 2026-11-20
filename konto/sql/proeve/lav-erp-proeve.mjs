// Bygger ÉN sætning (DO-blok) til en prøve i et fremmed Postgres (fx ERP'et, før ni-konto findes): 001+002 i skemaet
// konto_proeve, prøverne, og RAISE EXCEPTION 'PROEVE_OK: …' til sidst, så ALT rulles tilbage. En fejlet prøve giver
// 'PROEVE_FEJL: …' (også rullet tilbage). Bagefter: select count(*) from pg_namespace where nspname = 'konto_proeve' → 0.
// Kør: node konto/sql/proeve/lav-erp-proeve.mjs <ud.sql>   (standard: erp-proeve.sql ved siden af scriptet)
import { readFileSync, writeFileSync } from 'node:fs';

const her = (sti) => new URL(sti, import.meta.url);
const til = (s) => s
  .split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l) && !/^\s*--/.test(l) && l.trim() !== '').join('\n')
  .replace(/\bpublic\./g, 'konto_proeve.')
  .replace(/\bschema public\b/g, 'schema konto_proeve')
  .replace(/search_path = public\b/g, 'search_path = konto_proeve');

const s001 = til(readFileSync(her('../001_skema.sql'), 'utf8'));
const s002 = til(readFileSync(her('../002_funktioner.sql'), 'utf8'));
if (/\bpublic\./.test(s001 + s002)) throw new Error('public. tilbage');

const H = (c) => `'${c.repeat(64)}'`;
const U = (n) => `'00000000-0000-4000-8000-${String(n).padStart(12, '0')}'::uuid`;
const opret = (id, email, hmac, ip = 'ip1', formaal = 'log_ind') =>
  `konto_proeve.kode_opret(p_email => '${email}', p_email_hmac => ${hmac}, p_ip_hash => '${ip}', p_formaal => '${formaal}', p_sprog => 'da', p_kode_id => ${U(id)}, p_kode_hmac => ${H(String(id % 10))}, p_peber_v => 1, p_retur => null)`;
const tjek = (id, kodeHmac, emailHmac, tok) =>
  `konto_proeve.kode_tjek(p_kode_id => ${U(id)}, p_kode_hmac => ${kodeHmac}, p_email_hmac => ${emailHmac}, p_token_sha256 => ${tok})`;

const proever = `
  -- 1. lofter pr. e-mail (3 pr. 15 min)
  pv_r := ${opret(1, 'e@example.com', H('a'))}; perform pg_temp.forvent(pv_r->>'ok', 'true', 'opret 1');
  pv_r := ${opret(2, 'e@example.com', H('a'))};
  pv_r := ${opret(3, 'e@example.com', H('a'))};
  pv_r := ${opret(4, 'e@example.com', H('a'))}; perform pg_temp.forvent(pv_r->>'hvor', 'email', 'loft email');
  pv_ud := pv_ud || ' loft_email=' || (pv_r->>'fejl');
  -- 2. R2: 5 forsøg pr. kode
  for pv_i in 1..5 loop pv_r := ${tjek(3, H('9'), H('a'), H('f'))}; pv_ud := pv_ud || case when pv_i = 1 then ' forsoeg=' else ',' end || (pv_r->>'fejl') || coalesce(pv_r->>'tilbage', ''); end loop;
  perform pg_temp.forvent(pv_r->>'fejl', 'laast', '5. forkerte');
  pv_r := ${tjek(3, H('3'), H('a'), H('f'))}; perform pg_temp.forvent(pv_r->>'fejl', 'laast', 'rigtig efter spærring');
  pv_r := ${tjek(999, H('1'), H('a'), H('f'))}; perform pg_temp.forvent(pv_r->>'fejl', 'udloebet', 'ukendt id');
  -- 3. log ind, kunde oprettes, session, andet login
  pv_r := ${opret(10, 'f@example.com', H('b'))};
  pv_r := ${tjek(10, H('0'), H('b'), H('c'))}; perform pg_temp.forvent(pv_r->>'ny', 'true', 'login ny');
  pv_r := konto_proeve.session_forny(${H('c')}); perform pg_temp.forvent(pv_r->>'email', 'f@example.com', 'session_forny');
  select id into pv_kunde from konto_proeve.kunder where email = 'f@example.com';
  pv_r := ${opret(11, 'f@example.com', H('b'))};
  pv_r := ${tjek(11, H('1'), H('b'), H('d'))}; perform pg_temp.forvent(pv_r->>'ny', 'false', 'login igen');
  perform pg_temp.forvent((select count(*) from konto_proeve.kunder where email = 'f@example.com')::text, '1', 'én kunde');
  perform pg_temp.forvent((select count(*) from konto_proeve.koder where email = 'f@example.com' and brugt is null)::text, '0', 'R4 åbne koder');
  -- 4. designs og IDOR
  pv_r := konto_proeve.design_gem(pv_kunde, 'hoejskab', 'eyJ9', 'Skab', 987550); pv_design := (pv_r->>'id')::uuid;
  perform pg_temp.forvent(jsonb_array_length(konto_proeve.design_liste(pv_kunde))::text, '1', 'design_liste');
  pv_r := konto_proeve.design_navn(${U(77)}, pv_design, 'x'); perform pg_temp.forvent(pv_r->>'fejl', 'ukendt', 'IDOR navn');
  pv_r := konto_proeve.design_slet(${U(77)}, pv_design); perform pg_temp.forvent(pv_r->>'fejl', 'ukendt', 'IDOR slet');
  pv_r := konto_proeve.design_navn(pv_kunde, pv_design, 'Nyt'); perform pg_temp.forvent(pv_r->>'ok', 'true', 'navn');
  -- 5. log ud
  pv_r := konto_proeve.session_luk(${H('c')});
  perform pg_temp.forvent(konto_proeve.session_forny(${H('c')})::text, '{}', 'efter log ud');
  -- 6. slet konto
  pv_r := ${opret(12, 'f@example.com', H('b'), 'ip1', 'slet')};
  pv_r := konto_proeve.konto_slet(pv_kunde, ${U(12)}, ${H('9')}, ${H('b')}); perform pg_temp.forvent(pv_r->>'fejl', 'forkert', 'slet forkert');
  pv_r := konto_proeve.konto_slet(pv_kunde, ${U(12)}, ${H('2')}, ${H('b')}); perform pg_temp.forvent(pv_r->>'ok', 'true', 'slet rigtig');
  pv_ud := pv_ud || ' efter_slet=' || (select count(*) from konto_proeve.kunder where email = 'f@example.com') || '/'
    || (select count(*) from konto_proeve.sessioner) || '/' || (select count(*) from konto_proeve.designs) || '/'
    || (select count(*) from konto_proeve.koder where email = 'f@example.com');
  -- 7. IP-loft med tilbagerulning
  for pv_i in 0..10 loop pv_r := konto_proeve.kode_opret(p_email => 'ip' || pv_i || '@example.com', p_email_hmac => ${H('c')}, p_ip_hash => 'ip3', p_formaal => 'log_ind', p_sprog => 'da', p_kode_id => gen_random_uuid(), p_kode_hmac => ${H('1')}, p_peber_v => 1); end loop;
  perform pg_temp.forvent(pv_r->>'hvor', 'ip', '11. kode fra samme IP');
  pv_ud := pv_ud || ' ip_taeller=' || (select antal from konto_proeve.lofter where noegle like 'ip:ip3:%');
  -- 8. dagsbudget (19 forkerte i forvejen → den 20. lukker)
  pv_r := ${opret(20, 'g@example.com', H('e'), 'ip2')};
  insert into konto_proeve.lofter values ('forkert:' || ${H('e')} || ':' || konto_proeve.intern_dag(), 19, now() + interval '1 day');
  pv_r := ${tjek(20, H('9'), H('e'), H('f'))}; perform pg_temp.forvent(pv_r->>'fejl', 'doegn', '20. forkerte');
  pv_r := ${opret(21, 'g@example.com', H('e'), 'ip2')}; perform pg_temp.forvent(pv_r->>'fejl', 'doegn', 'kode efter døgnloft');
  -- 9. loft_tael og oprydning
  pv_r := konto_proeve.loft_tael('visning:abc', 1, 'time'); pv_r := konto_proeve.loft_tael('visning:abc', 1, 'time');
  perform pg_temp.forvent(pv_r->>'ok', 'false', 'loft_tael');
  update konto_proeve.koder set udloeber = now() - interval '25 hours' where email = 'e@example.com';
  pv_r := konto_proeve.rydop(); pv_ud := pv_ud || ' rydop=' || pv_r::text;
  pv_r := konto_proeve.rydop_haendelser();
  -- 10. rettigheder
  pv_ud := pv_ud || ' anon_skema=' || has_schema_privilege('anon', 'konto_proeve', 'USAGE')
    || ' auth_skema=' || has_schema_privilege('authenticated', 'konto_proeve', 'USAGE')
    || ' anon_kunder=' || has_table_privilege('anon', 'konto_proeve.kunder', 'SELECT')
    || ' auth_sessioner=' || has_table_privilege('authenticated', 'konto_proeve.sessioner', 'SELECT')
    || ' anon_kode_tjek=' || has_function_privilege('anon', 'konto_proeve.kode_tjek(uuid,text,text,text)', 'EXECUTE')
    || ' service_kode_tjek=' || has_function_privilege('service_role', 'konto_proeve.kode_tjek(uuid,text,text,text)', 'EXECUTE')
    || ' service_koder=' || has_table_privilege('service_role', 'konto_proeve.koder', 'UPDATE')
    || ' rls=' || (select bool_and(relrowsecurity) from pg_class where relnamespace = 'konto_proeve'::regnamespace and relkind = 'r')
    || ' politikker=' || (select count(*) from pg_policies where schemaname = 'konto_proeve');
  begin
    execute 'set local role anon';
    perform 1 from konto_proeve.kunder;
    pv_ud := pv_ud || ' ANON_KAN_LAESE';
    execute 'reset role';
  exception when insufficient_privilege then
    pv_ud := pv_ud || ' anon_select=afvist';
  end;
  pv_ud := pv_ud || ' dag=' || konto_proeve.intern_dag() || ' doegn_slut=' || konto_proeve.intern_doegn_slut();
`;

const sql = `do $proeve$
declare
  pv_r jsonb;
  pv_i int;
  pv_ud text := '';
  pv_kunde uuid;
  pv_design uuid;
begin
  -- Prøve af konto/sql/001+002 (ni-konto). Alt rulles tilbage af RAISE til sidst; intet bliver liggende i ERP.
  create schema konto_proeve;
  perform set_config('search_path', 'konto_proeve, pg_temp', true);
  -- Som Supabase' public-skema: alle må bruge skemaet, og nye objekter giver anon/authenticated alt
  grant usage on schema konto_proeve to public, anon, authenticated, service_role;
  alter default privileges in schema konto_proeve grant all on tables to anon, authenticated;
  alter default privileges in schema konto_proeve grant all on functions to anon, authenticated;
  create function pg_temp.forvent(p_faktisk text, p_forventet text, p_hvad text) returns void language plpgsql as $f$
  begin
    if p_faktisk is distinct from p_forventet then
      raise exception 'PROEVE_FEJL: % (fik %, ventede %)', p_hvad, p_faktisk, p_forventet;
    end if;
  end $f$;
${s001}
${s002}
${proever}
  raise exception 'PROEVE_OK:%', pv_ud;
end
$proeve$;`;

writeFileSync(process.argv[2] ?? her('./erp-proeve.sql'), sql);
console.log(`skrevet: ${sql.length} tegn`);
