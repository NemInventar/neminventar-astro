# ni-konto — databasen bag Min side

Kontodata til `konto.neminventar.dk`: kunder (kun e-mail), engangskoder (HMAC), sessioner (SHA-256), designs gemt med login, lofter og en hændelseslog uden e-mail. Ingen ordredata — de bliver i ERP'et og hentes gennem broen `konto-bro`. Spec: `ni-apps/docs/superpowers/specs/2026-11-12-min-side/` (`plan-teknik-v3.md` §3.1, §4, §5 og `kontrakter.md` §6).

Kun Workeren `ni-konto-backend` (konto/worker/) bruger databasen, med servernøglen og kun gennem funktionerne i `002_funktioner.sql` (PostgREST `/rest/v1/rpc/<navn>`). `anon` og `authenticated` har ingen rettigheder til skema, tabeller eller funktioner, og der oprettes ingen Auth-brugere.

## Filerne

| Fil | Hvad |
|---|---|
| `001_skema.sql` | Tabellerne `kunder`, `koder`, `lofter`, `sessioner`, `designs`, `haendelser`. RLS til uden politikker. Rettighederne tages fra `public`/`anon`/`authenticated` (også fremtidige objekter og USAGE på skemaet); kun `service_role` får adgang |
| `002_funktioner.sql` | RPC'erne: `kode_opret`, `kode_aktiv`, `kode_tjek` (log ind + session i én transaktion), `session_forny`, `session_luk`, `session_luk_alle`, `konto_slet`, `design_gem/liste/navn/slet`, `loft_tael`, `haendelse`, `rydop`, `rydop_haendelser`. Kun `service_role` må køre dem |
| `003_cron.sql` | pg_cron: `rydop()` hver time (koder og lofter 24 t efter udløb, lukkede/udløbne sessioner), `rydop_haendelser()` hver nat (12 mdr.) |
| `proeve/paritet-pglite.mjs` | Kører 001+002 i PGlite (rigtig Postgres) og sammenligner hver RPC med Workerens fake-db. Viser rettighederne |
| `proeve/lav-erp-proeve.mjs` | Bygger én DO-blok, der prøver 001+002 i et andet Postgres i skemaet `konto_proeve` og slutter med `RAISE EXCEPTION`, så alt rulles tilbage |

Tallene i lofterne (3 koder pr. e-mail pr. 15 min, 20 forkerte pr. e-mail pr. kalenderdøgn i dansk tid, 10 koder pr. IP pr. time, 150 i alt pr. døgn, 5 forsøg pr. kode, 50 gem pr. konto pr. døgn) står også i `konto/worker/src/regler.js`. En test (`npm run test:konto`) tjekker, at de passer sammen.

## Sådan køres de (Joachim, når projektet findes)

1. Opret Supabase-projektet **`ni-konto`** i eu-central-1 (Frankfurt). Supabase-forbindelsen må ikke oprette projekter, så det gøres i dashboardet.
2. **Authentication → Sign In / Providers:** slå "Allow new users to sign up" og anonyme logins **fra** (her skal der aldrig være brugere).
3. **Integrations → Cron:** slå pg_cron til (eller lad `003` gøre det).
4. **SQL Editor:** kør `001_skema.sql`, så `002_funktioner.sql`, så `003_cron.sql` — hver fil for sig, i den rækkefølge. 001 og 002 kører hver i én transaktion (`begin … commit`).
5. Gem filerne som migrationer, når de er kørt (samme navne).
6. Hent **Project URL** og en **secret key** (`sb_secret_…`) under Project Settings → API keys. URL'en skrives i `konto/worker/wrangler.toml` (`NI_KONTO_URL`), nøglen sættes som secret: `npx wrangler@4 secret put NI_KONTO_SERVICE_KEY --env production` (og `--env staging` mod staging-databasen).
7. Valgfrit, men anbefalet: **API → GraphQL** slås fra (bruges ikke).

## Tjek efter kørslen (forventet resultat i parentes)

```sql
select has_schema_privilege('anon', 'public', 'USAGE'),                     -- false
       has_schema_privilege('authenticated', 'public', 'USAGE'),            -- false
       has_table_privilege('anon', 'public.kunder', 'SELECT'),              -- false
       has_function_privilege('anon', 'public.kode_tjek(uuid,text,text,text)', 'EXECUTE'),   -- false
       has_function_privilege('service_role', 'public.kode_tjek(uuid,text,text,text)', 'EXECUTE'), -- true
       (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'), -- true
       (select count(*) from pg_policies where schemaname = 'public'),      -- 0
       (select count(*) from auth.users);                                   -- 0
select jobname, schedule, active from cron.job where jobname like 'ni-konto-%';   -- 2 job, active
```

Og udefra: `GET <url>/rest/v1/kunder` med den offentlige nøgle (publishable/anon) skal give fejl (permission denied), og `POST <url>/rest/v1/rpc/kode_aktiv` med den offentlige nøgle ligeså.

## Prøverne (12-11-2026)

- **PGlite (Postgres 18.3):** `PGLITE=C:/dev/ni-underskriv/node_modules/@electric-sql/pglite/dist/index.js node konto/sql/proeve/paritet-pglite.mjs` → 76 sammenligninger mellem SQL og fake-db, 0 afvigelser; anon/authenticated uden USAGE, tabeller og funktioner; RLS på alle tabeller, 0 politikker.
- **ERP-prøven** (`lav-erp-proeve.mjs` → én DO-blok, `RAISE EXCEPTION 'PROEVE_OK: …'`): samme blok giver `PROEVE_OK` i PGlite, og skemaet findes ikke bagefter. Kørslen i ERP-projektet blev afvist af tilladelsen i agent-sessionen og er **ikke kørt der**. Kør den med godkendelse via Supabase-forbindelsen (`execute_sql`, ERP-projektet) og tjek bagefter: `select count(*) from pg_namespace where nspname = 'konto_proeve'` → 0.
