-- ni-konto 002: funktionerne, Workeren kalder via PostgREST (/rest/v1/rpc/<navn>) med servernøglen.
-- Plan: plan-teknik-v3.md §4 (R1–R7, R17), kontrakter.md §6. Kør efter 001.
--
-- Alle tilstandsovergange sker her, i én transaktion pr. kald. Workeren regner det, der kræver en hemmelighed
-- (HMAC af koden og e-mailen, SHA-256 af cookien), og sender kun resultatet. Funktionerne er SECURITY INVOKER:
-- kun service_role har rettigheder til tabellerne, så en fejlagtig GRANT EXECUTE til anon giver stadig intet.
-- Tal i lofterne skal passe med konto/worker/src/regler.js (en test sammenligner dem).
-- Svar er jsonb: {ok: true, …} eller {fejl: '<kode>', …}. Kun programmeringsfejl rejses som 'ni:<kode>'.

begin;

-- Hjælpere -------------------------------------------------------------------------------------------------------

-- R3/R20: kalenderdøgn og time regnes i dansk tid
create or replace function public.intern_dag() returns text
language sql stable set search_path = public, pg_temp as $$
  select to_char(now() at time zone 'Europe/Copenhagen', 'YYYY-MM-DD');
$$;

create or replace function public.intern_time() returns text
language sql stable set search_path = public, pg_temp as $$
  select to_char(now() at time zone 'Europe/Copenhagen', 'YYYY-MM-DD"T"HH24');
$$;

-- Midnat dansk tid efter i dag (der hvor et døgnloft nulstilles)
create or replace function public.intern_doegn_slut() returns timestamptz
language sql stable set search_path = public, pg_temp as $$
  select (((now() at time zone 'Europe/Copenhagen')::date + 1)::timestamp) at time zone 'Europe/Copenhagen';
$$;

create or replace function public.intern_time_slut() returns timestamptz
language sql stable set search_path = public, pg_temp as $$
  select date_trunc('hour', now()) + interval '1 hour';
$$;

-- Tæller op uden loft og giver det nye antal
create or replace function public.intern_tael(p_noegle text, p_udloeber timestamptz) returns int
language plpgsql set search_path = public, pg_temp as $$
declare
  v_n int;
begin
  insert into lofter (noegle, antal, udloeber) values (p_noegle, 1, p_udloeber)
  on conflict (noegle) do update set antal = lofter.antal + 1
  returning antal into v_n;
  return v_n;
end $$;

-- Lofter ---------------------------------------------------------------------------------------------------------

-- R3: generelt loft til Workeren (fx visning af ordresiden pr. IP). Tæller kun op, hvis der er plads (atomisk).
-- p_periode: 'time' eller 'doegn' (dansk tid). → {ok, antal}
create or replace function public.loft_tael(p_noegle text, p_max int, p_periode text) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_noegle text;
  v_slut timestamptz;
  v_n int;
begin
  if p_noegle is null or p_noegle !~ '^[a-z_]{1,30}:[A-Za-z0-9_-]{1,100}$' then raise exception 'ni:noegle'; end if;
  if p_max is null or p_max < 1 then raise exception 'ni:max'; end if;
  if p_periode = 'time' then
    v_noegle := p_noegle || ':' || intern_time();
    v_slut := intern_time_slut();
  elsif p_periode = 'doegn' then
    v_noegle := p_noegle || ':' || intern_dag();
    v_slut := intern_doegn_slut();
  else
    raise exception 'ni:periode';
  end if;
  insert into lofter (noegle, antal, udloeber) values (v_noegle, 1, v_slut)
  on conflict (noegle) do update set antal = lofter.antal + 1 where lofter.antal < p_max
  returning antal into v_n;
  return jsonb_build_object('ok', v_n is not null, 'antal', coalesce(v_n, p_max));
end $$;

-- Koder ----------------------------------------------------------------------------------------------------------

-- R1, R3, R5: opret en kode. Samme vej, uanset om kontoen findes (kunder læses ikke). Lofterne:
--   20 forkerte koder pr. e-mail pr. kalenderdøgn → {fejl:'doegn'} (login lukket til i morgen)
--    3 koder pr. e-mail pr. 15 minutter (glidende)  → {fejl:'loft', hvor:'email'}
--   10 koder pr. IP pr. time · 150 koder i alt pr. døgn → {fejl:'loft', hvor:'ip'|'alle'}
-- 'byge' = antal afviste kald i denne time (alarm ved 429-byger, R19). 'alle' = koder sendt i dag (alarm ved 75).
create or replace function public.kode_opret(
  p_email text, p_email_hmac text, p_ip_hash text, p_formaal text, p_sprog text,
  p_kode_id uuid, p_kode_hmac text, p_peber_v int, p_retur text default null
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_dag  text := intern_dag();
  v_time text := intern_time();
  v_n    int;
  v_ip   int;
  v_alle int;
  v_hvor text;
begin
  if p_formaal is null or p_formaal not in ('log_ind', 'slet') then raise exception 'ni:formaal'; end if;
  if p_email is null or p_email <> lower(p_email) then raise exception 'ni:email'; end if;
  if p_email_hmac is null or p_email_hmac !~ '^[0-9a-f]{64}$' then raise exception 'ni:email_hmac'; end if;

  -- Én kode ad gangen pr. e-mail: samtidige kald venter på hinanden, så loftet ikke kan løbes over
  perform pg_advisory_xact_lock(hashtextextended('ni-konto:kode:' || p_email, 0));

  select antal into v_n from lofter where noegle = 'forkert:' || p_email_hmac || ':' || v_dag;
  if coalesce(v_n, 0) >= 20 then
    return jsonb_build_object('fejl', 'doegn', 'byge', intern_tael('byge:' || v_time, intern_time_slut()));
  end if;

  select count(*) into v_n from koder where email = p_email and oprettet > now() - interval '15 minutes';
  if v_n >= 3 then
    return jsonb_build_object('fejl', 'loft', 'hvor', 'email', 'byge', intern_tael('byge:' || v_time, intern_time_slut()));
  end if;

  -- IP og i alt tælles op; nås et loft, rulles tællingen tilbage (undertransaktionen), så afviste kald ikke tæller
  begin
    v_ip   := intern_tael('ip:' || coalesce(p_ip_hash, 'ukendt') || ':' || v_time, intern_time_slut());
    v_alle := intern_tael('alle:' || v_dag, intern_doegn_slut());
    if v_ip > 10 then raise exception using errcode = 'NIL01', message = 'ip'; end if;
    if v_alle > 150 then raise exception using errcode = 'NIL01', message = 'alle'; end if;
  exception when sqlstate 'NIL01' then
    v_hvor := sqlerrm;
  end;
  if v_hvor is not null then
    return jsonb_build_object('fejl', 'loft', 'hvor', v_hvor, 'byge', intern_tael('byge:' || v_time, intern_time_slut()));
  end if;

  -- Fable c1 "Ny kode": den forrige kode til samme formål virker ikke længere
  update koder set brugt = now() where email = p_email and formaal = p_formaal and brugt is null;

  insert into koder (id, email, formaal, sprog, kode_hmac, peber_v, retur, udloeber)
  values (p_kode_id, p_email, p_formaal, case when p_sprog = 'en' then 'en' else 'da' end, p_kode_hmac, p_peber_v, p_retur,
          now() + case p_formaal when 'slet' then interval '10 minutes' else interval '15 minutes' end);

  return jsonb_build_object('ok', true, 'alle', v_alle);
end $$;

-- Den nyeste åbne kode til e-mailen (id og pebervesion, så Workeren kan regne HMAC'en). {} hvis der ingen er.
create or replace function public.kode_aktiv(p_email text, p_formaal text) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    (select jsonb_build_object('kode_id', id, 'peber_v', peber_v)
       from koder
      where email = p_email and formaal = p_formaal and brugt is null
      order by oprettet desc
      limit 1),
    '{}'::jsonb);
$$;

-- R2 + R3: ét forsøg på en kode. Dagsbudgettet (20 forkerte pr. e-mail) reserveres først, atomisk; derefter tælles
-- forsøget og koden tjekkes i ÉN sætning, så 50 samtidige gæt højst giver 5 vurderinger. Kun forkerte koder tæller
-- i budgettet. p_email_krav: koden skal tilhøre denne e-mail (slet konto).
-- → {rigtig, email, retur, sprog} · {fejl:'forkert', tilbage, forkerte_time} · {fejl:'laast'|'udloebet'|'doegn'}
create or replace function public.intern_forsoeg(
  p_kode_id uuid, p_formaal text, p_kode_hmac text, p_email_hmac text, p_email_krav text
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_budget  text := 'forkert:' || p_email_hmac || ':' || intern_dag();
  v_n       int;
  v_rigtig  boolean;
  v_forsoeg int;
  v_email   text;
  v_retur   text;
  v_sprog   text;
  v_fh      int;
begin
  insert into lofter (noegle, antal, udloeber) values (v_budget, 1, intern_doegn_slut())
  on conflict (noegle) do update set antal = lofter.antal + 1 where lofter.antal < 20
  returning antal into v_n;
  if v_n is null then
    return jsonb_build_object('fejl', 'doegn');
  end if;

  update koder
     set forsoeg = forsoeg + 1,
         brugt   = case when kode_hmac = p_kode_hmac then now() end
   where id = p_kode_id
     and formaal = p_formaal
     and brugt is null
     and forsoeg < 5
     and udloeber > now()
     and (p_email_krav is null or email = p_email_krav)
  returning kode_hmac = p_kode_hmac, forsoeg, email, retur, sprog
       into v_rigtig, v_forsoeg, v_email, v_retur, v_sprog;

  if not found then
    -- Intet forsøg: koden findes ikke, er brugt, udløbet eller spærret. Reservationen gives tilbage.
    update lofter set antal = antal - 1 where noegle = v_budget;
    select forsoeg into v_forsoeg from koder
     where id = p_kode_id and formaal = p_formaal and (p_email_krav is null or email = p_email_krav);
    return jsonb_build_object('fejl', case when coalesce(v_forsoeg, 0) >= 5 then 'laast' else 'udloebet' end);
  end if;

  if v_rigtig then
    update lofter set antal = antal - 1 where noegle = v_budget;
    return jsonb_build_object('rigtig', true, 'email', v_email, 'retur', v_retur, 'sprog', v_sprog);
  end if;

  v_fh := intern_tael('forkert_alle:' || intern_time(), intern_time_slut());
  return jsonb_build_object(
    'fejl', case when v_n >= 20 then 'doegn' when v_forsoeg >= 5 then 'laast' else 'forkert' end,
    'tilbage', 5 - v_forsoeg,
    'forkerte_time', v_fh);
end $$;

-- Log ind (fable c1): rigtig kode → R4 (alle åbne koder til e-mailen ugyldige), kunden oprettes eller genfindes
-- (UNIQUE + ON CONFLICT), og sessionen oprettes med SHA-256 af cookien (R6). Alt i samme transaktion.
-- → {ok, ny, retur, udloeber_absolut} · fejlene fra intern_forsoeg
create or replace function public.kode_tjek(
  p_kode_id uuid, p_kode_hmac text, p_email_hmac text, p_token_sha256 text
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v       jsonb;
  v_kunde uuid;
  v_ny    boolean;
  v_slut  timestamptz := now() + interval '90 days';
begin
  if p_token_sha256 is null or p_token_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'ni:token'; end if;
  v := intern_forsoeg(p_kode_id, 'log_ind', p_kode_hmac, p_email_hmac, null);
  if not coalesce((v ->> 'rigtig')::boolean, false) then
    return v;
  end if;

  update koder set brugt = now() where email = v ->> 'email' and brugt is null;

  insert into kunder (email, sprog) values (v ->> 'email', coalesce(v ->> 'sprog', 'da'))
  on conflict (email) do update set sidst_set = now()
  returning id, (xmax = 0) into v_kunde, v_ny;

  insert into sessioner (kunde_id, token_sha256, udloeber_absolut) values (v_kunde, p_token_sha256, v_slut);

  return jsonb_build_object('ok', true, 'ny', v_ny, 'retur', v -> 'retur', 'udloeber_absolut', v_slut);
end $$;

-- Sessioner ------------------------------------------------------------------------------------------------------

-- R6: gyldig session → fornyes (sidst_brugt) og giver kunden. Ugyldig (lukket, 30 dage uden besøg, over 90 dage) → {}.
create or replace function public.session_forny(p_token_sha256 text) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_kunde uuid;
  v_email text;
  v_sprog text;
  v_slut  timestamptz;
begin
  update sessioner s
     set sidst_brugt = now()
    from kunder k
   where s.token_sha256 = p_token_sha256
     and k.id = s.kunde_id
     and s.lukket is null
     and s.sidst_brugt > now() - interval '30 days'
     and s.udloeber_absolut > now()
  returning s.kunde_id, k.email, k.sprog, s.udloeber_absolut into v_kunde, v_email, v_sprog, v_slut;
  if not found then
    return '{}'::jsonb;
  end if;
  update kunder set sidst_set = now() where id = v_kunde and sidst_set < now() - interval '1 hour';
  return jsonb_build_object('kunde_id', v_kunde, 'email', v_email, 'sprog', v_sprog, 'udloeber_absolut', v_slut);
end $$;

-- R6: log ud lukker rækken på serveren
create or replace function public.session_luk(p_token_sha256 text) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  update sessioner set lukket = now() where token_sha256 = p_token_sha256 and lukket is null;
  return jsonb_build_object('ok', true);
end $$;

-- Fable c7: log ud alle steder. Kræver en gyldig session; lukker alle kundens sessioner, også denne.
create or replace function public.session_luk_alle(p_token_sha256 text) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_kunde uuid;
  v_n int;
begin
  select kunde_id into v_kunde from sessioner
   where token_sha256 = p_token_sha256 and lukket is null
     and sidst_brugt > now() - interval '30 days' and udloeber_absolut > now();
  if v_kunde is null then
    return jsonb_build_object('ok', false);
  end if;
  update sessioner set lukket = now() where kunde_id = v_kunde and lukket is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'antal', v_n);
end $$;

-- Slet konto (R7, fable c6): slette-koden (10 min, 5 forsøg, dagsbudget) skal tilhøre kundens e-mail. Rigtig kode
-- sletter kunden (sessioner og designs følger med, on delete cascade) og alle kundens koder.
-- → {ok} · fejlene fra intern_forsoeg
create or replace function public.konto_slet(
  p_kunde_id uuid, p_kode_id uuid, p_kode_hmac text, p_email_hmac text
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v       jsonb;
  v_email text;
begin
  select email into v_email from kunder where id = p_kunde_id;
  if v_email is null then
    return jsonb_build_object('fejl', 'udloebet');
  end if;
  v := intern_forsoeg(p_kode_id, 'slet', p_kode_hmac, p_email_hmac, v_email);
  if not coalesce((v ->> 'rigtig')::boolean, false) then
    return v;
  end if;
  delete from kunder where id = p_kunde_id;
  delete from koder where email = v_email;
  return jsonb_build_object('ok', true);
end $$;

-- Designs gemt med login -----------------------------------------------------------------------------------------

-- Fable c3: gem et nyt design. Højst 50 pr. konto pr. døgn (værn mod en løbsk klient). → {ok, id} · {fejl:'loft'}
-- p_miniature = designerens miniature som base64 (Fable port 3 runde 2, R4; Workeren har tjekket, at det er en JPEG under
-- 150 kB) og p_miniature_type = 'image/jpeg' — begge eller ingen; kolonnernes check i 001 afviser resten.
create or replace function public.design_gem(
  p_kunde_id uuid, p_produkt text, p_tilstand text, p_navn text, p_pris_oere bigint, p_titel text default null,
  p_miniature text default null, p_miniature_type text default null
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_n  int;
  v_id uuid;
begin
  insert into lofter (noegle, antal, udloeber) values ('gem:' || p_kunde_id || ':' || intern_dag(), 1, intern_doegn_slut())
  on conflict (noegle) do update set antal = lofter.antal + 1 where lofter.antal < 50
  returning antal into v_n;
  if v_n is null then
    return jsonb_build_object('fejl', 'loft');
  end if;
  insert into designs (kunde_id, produkt, tilstand, navn, titel, pris_ved_gem, miniature, miniature_type)
  values (p_kunde_id, p_produkt, p_tilstand, p_navn, nullif(left(p_titel, 160), ''), p_pris_oere,
          case when p_miniature is null then null else decode(p_miniature, 'base64') end, p_miniature_type)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Kundens designs, nyeste først. Ejerskabet ligger i forespørgslen (ingen IDOR). Billedet selv kommer ikke med — kun om der er
-- et (har_miniature); Workeren laver adressen /api/design/miniature?id=… (kontrakter §6).
create or replace function public.design_liste(p_kunde_id uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'produkt', produkt, 'navn', navn, 'titel', titel, 't', tilstand, 'pris_oere', pris_ved_gem, 'gemt', oprettet,
           'har_miniature', miniature is not null)
           order by oprettet desc, id), '[]'::jsonb)
    from designs
   where kunde_id = p_kunde_id;
$$;

-- Miniaturen til GET /api/design/miniature (R4): kun kundens eget design. → {type, b64} · {fejl:'ukendt'} (andet designs id,
-- intet billede eller ukendt — samme svar)
create or replace function public.design_miniature(p_kunde_id uuid, p_id uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    (select jsonb_build_object('type', miniature_type, 'b64', encode(miniature, 'base64'))
       from designs where id = p_id and kunde_id = p_kunde_id and miniature is not null),
    jsonb_build_object('fejl', 'ukendt'));
$$;

create or replace function public.design_slet(p_kunde_id uuid, p_id uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  delete from designs where id = p_id and kunde_id = p_kunde_id;
  if not found then
    return jsonb_build_object('fejl', 'ukendt');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.design_navn(p_kunde_id uuid, p_id uuid, p_navn text) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  if p_navn is null or length(p_navn) not between 1 and 80 then
    return jsonb_build_object('fejl', 'navn');
  end if;
  update designs set navn = p_navn where id = p_id and kunde_id = p_kunde_id;
  if not found then
    return jsonb_build_object('fejl', 'ukendt');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Hændelser og oprydning -----------------------------------------------------------------------------------------

-- S15/R17: kun type, HMAC(e-mail) og en dagshash af IP'en
create or replace function public.haendelse(p_type text, p_email_hmac text default null, p_ip_dag text default null)
returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  insert into haendelser (type, email_hmac, ip_dag) values (p_type, p_email_hmac, p_ip_dag);
  return jsonb_build_object('ok', true);
end $$;

-- Plan §5: koder og lofter 24 t efter udløb; sessioner 24 t efter, de er lukket eller udløbet. Køres hver time (003).
create or replace function public.rydop() returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_koder int;
  v_lofter int;
  v_sessioner int;
begin
  delete from koder where udloeber < now() - interval '24 hours';
  get diagnostics v_koder = row_count;
  delete from lofter where udloeber < now() - interval '24 hours';
  get diagnostics v_lofter = row_count;
  delete from sessioner
   where coalesce(lukket, least(udloeber_absolut, sidst_brugt + interval '30 days')) < now() - interval '24 hours';
  get diagnostics v_sessioner = row_count;
  return jsonb_build_object('koder', v_koder, 'lofter', v_lofter, 'sessioner', v_sessioner);
end $$;

-- Plan §5: hændelser efter 12 mdr. Køres hver nat (003).
create or replace function public.rydop_haendelser() returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_n int;
begin
  delete from haendelser where tid < now() - interval '12 months';
  get diagnostics v_n = row_count;
  return jsonb_build_object('haendelser', v_n);
end $$;

-- Adgang: kun service_role må køre funktionerne -------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

commit;
