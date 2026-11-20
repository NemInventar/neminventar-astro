-- ni-konto 003: oprydning med pg_cron (plan-teknik-v3.md §5). Kør efter 001 og 002.
--   · koder og lofter 24 t efter udløb, lukkede/udløbne sessioner 24 t efter → rydop(), hver time
--   · hændelser efter 12 mdr. → rydop_haendelser(), hver nat
-- pg_cron kører i UTC. cron.schedule med et navn erstatter et job med samme navn, så filen kan køres igen.
-- Konto, designs og sessioner i brug slettes ikke her: de slettes af kunden. Varsel og sletning efter 24 mdr. uden
-- login bygges senere (backlog, nov. 2028).

create extension if not exists pg_cron;

select cron.schedule('ni-konto-rydop', '17 * * * *', $$select public.rydop()$$);
select cron.schedule('ni-konto-rydop-haendelser', '27 2 * * *', $$select public.rydop_haendelser()$$);

-- Tjek: select jobname, schedule, command, active from cron.job where jobname like 'ni-konto-%';
--       select * from cron.job_run_details where jobid in (select jobid from cron.job where jobname like 'ni-konto-%')
--        order by start_time desc limit 10;
