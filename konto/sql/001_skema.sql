-- ni-konto 001: tabellerne bag Min side (konto.neminventar.dk). Plan: plan-teknik-v3.md §3.1, §4 (R1–R7), §5.
--
-- Køres i det NYE Supabase-projekt `ni-konto` (eu-central-1) — aldrig i ERP'et. Rækkefølge 001 → 002 → 003 (README.md).
-- Kun Workeren `ni-konto-backend` skriver, med servernøglen (service_role) og kun gennem funktionerne i 002.
-- anon og authenticated får ingen rettigheder, og der oprettes ingen Auth-brugere. RLS er slået til uden politikker
-- på alle tabeller, så en fejlagtig GRANT en dag stadig ikke åbner rækkerne (service_role omgår RLS).
-- Her ligger kun konto-data: e-mail, koder (HMAC), sessioner (SHA-256), designs gemt med login, lofter og en
-- hændelseslog uden e-mail. Ingen ordredata, ingen rumbilleder — de bliver i ERP'et og hentes gennem broen.

begin;

-- Kunden er en e-mail og intet andet (fable a "Senere" nr. 8). Oprettes først, når koden er skrevet rigtigt (kode_tjek).
create table public.kunder (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique
             check (email = lower(email) and length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  sprog      text not null default 'da' check (sprog in ('da', 'en')),
  oprettet   timestamptz not null default now(),
  sidst_set  timestamptz not null default now()     -- til varsel/sletning efter 24 mdr. uden login (bygges senere, R60)
);
comment on table public.kunder is 'Min side: én række pr. konto (kun e-mail og sprog). Slettes af kunden (konto_slet). Kun service_role.';

-- Engangskoder (R1, R2). Koden selv gemmes aldrig: kode_hmac = HMAC-SHA256(KODE_PEBER_<peber_v>, email:kode_id:kode),
-- regnet i Workeren. Log ind gælder 15 min, slet 10 min. Højst 5 forsøg pr. kode. Slettes 24 t efter udløb (003).
create table public.koder (
  id         uuid primary key,                      -- Workeren vælger id'et, fordi det indgår i HMAC'en
  email      text not null check (email = lower(email) and length(email) between 3 and 254),
  formaal    text not null check (formaal in ('log_ind', 'slet')),
  sprog      text not null default 'da' check (sprog in ('da', 'en')),
  kode_hmac  text not null check (kode_hmac ~ '^[0-9a-f]{64}$'),
  peber_v    int  not null check (peber_v >= 1),
  retur      text check (retur is null or length(retur) <= 2000),   -- R21: allerede renset af Workeren
  oprettet   timestamptz not null default now(),
  udloeber   timestamptz not null,
  forsoeg    int  not null default 0 check (forsoeg between 0 and 5),
  brugt      timestamptz                            -- sat ved rigtig kode, ny kode eller login (R4): koden virker ikke mere
);
create index koder_email_idx on public.koder (email, formaal, oprettet desc);
create index koder_udloeber_idx on public.koder (udloeber);
comment on table public.koder is 'Engangskoder (kun HMAC). Slettes 24 t efter udløb (pg_cron, 003).';

-- Lofter (R3). Nøgler: forkert:<email_hmac>:<dag> · ip:<ip_hash>:<time> · alle:<dag> · gem:<kunde>:<dag> ·
-- visning:<ip_hash>:<time> · forkert_alle:<time> · byge:<time>. <dag> og <time> er dansk tid (Europe/Copenhagen).
-- Ingen e-mail eller IP i klartekst. Slettes 24 t efter udløb.
create table public.lofter (
  noegle    text primary key check (length(noegle) between 3 and 200),
  antal     int  not null default 0 check (antal >= 0),
  udloeber  timestamptz not null
);
create index lofter_udloeber_idx on public.lofter (udloeber);
comment on table public.lofter is 'Tællere til lofterne (R3). Kun HMAC-nøgler. Slettes 24 t efter udløb (pg_cron, 003).';

-- Sessioner (R6). Cookien (32 tilfældige bytes) gemmes kun som SHA-256. 30 dage uden besøg, højst 90 dage i alt.
create table public.sessioner (
  id                uuid primary key default gen_random_uuid(),
  kunde_id          uuid not null references public.kunder (id) on delete cascade,
  token_sha256      text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  oprettet          timestamptz not null default now(),
  sidst_brugt       timestamptz not null default now(),
  udloeber_absolut  timestamptz not null,
  lukket            timestamptz
);
create index sessioner_kunde_idx on public.sessioner (kunde_id);
comment on table public.sessioner is 'Sessioner (kun SHA-256 af cookien). Lukkes ved log ud; slettes 24 t efter, de er udløbet eller lukket.';

-- Designs gemt MED login (fable c3). tilstand = designerens t (base64url-JSON), renset for eget foto af Workeren (R11).
-- pris_ved_gem er regnet på serveren via api.neminventar.dk/pris, i øre, inkl. moms; null = "—".
create table public.designs (
  id            uuid primary key default gen_random_uuid(),
  kunde_id      uuid not null references public.kunder (id) on delete cascade,
  produkt       text not null check (produkt ~ '^[a-z][a-z0-9_-]{0,39}$'),
  tilstand      text not null check (length(tilstand) between 1 and 6000 and tilstand ~ '^[A-Za-z0-9_-]+$'),
  navn          text check (navn is null or length(navn) between 1 and 80),
  pris_ved_gem  bigint check (pris_ved_gem is null or pris_ved_gem between 0 and 1000000000),
  miniature     text,                                -- sti i en privat bucket (bruges ikke endnu)
  oprettet      timestamptz not null default now()
);
create index designs_kunde_idx on public.designs (kunde_id, oprettet desc);
comment on table public.designs is 'Designs gemt med login. Slettes af kunden (design_slet) eller med kontoen (on delete cascade).';

-- Hændelseslog (S15, R17). Aldrig e-mail, kode, cookie eller nøgle: kun HMAC(e-mail) og en dagshash af IP'en.
create table public.haendelser (
  id          bigint generated always as identity primary key,
  type        text not null check (type ~ '^[a-z_]{1,40}$'),
  email_hmac  text check (email_hmac is null or email_hmac ~ '^[0-9a-f]{64}$'),
  ip_dag      text check (ip_dag is null or ip_dag ~ '^[0-9a-f]{8,64}$'),
  tid         timestamptz not null default now()
);
create index haendelser_tid_idx on public.haendelser (tid);
comment on table public.haendelser is 'Hændelser uden persondata i klartekst. Slettes efter 12 mdr. (pg_cron, 003).';

-- Adgang ---------------------------------------------------------------------------------------------------------
alter table public.kunder     enable row level security;
alter table public.koder      enable row level security;
alter table public.lofter     enable row level security;
alter table public.sessioner  enable row level security;
alter table public.designs    enable row level security;
alter table public.haendelser enable row level security;

-- Supabase giver som standard anon og authenticated alt i public. Det tages tilbage, også for fremtidige objekter.
revoke all on all tables    in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
-- Postgres giver USAGE på public til PUBLIC (alle roller); anon og authenticated arver det. Det tages også.
revoke usage on schema public from public, anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
