-- D1 konverteringslag (05-10-2026): kilde og spor på web-henvendelser.
-- Kun nye, nullable kolonner. Live-sitet (main) læser ikke tabellen, og v5-kald skriver uændret.
ALTER TABLE web_henvendelser_2026_10_04
  ADD COLUMN IF NOT EXISTS spor text,
  ADD COLUMN IF NOT EXISTS kilde_svar text,
  ADD COLUMN IF NOT EXISTS referrer_host text,
  ADD COLUMN IF NOT EXISTS landingsside text,
  ADD COLUMN IF NOT EXISTS utm jsonb,
  ADD COLUMN IF NOT EXISTS konfiguration jsonb,
  ADD COLUMN IF NOT EXISTS permalink text,
  ADD COLUMN IF NOT EXISTS lead_kanal text,
  ADD COLUMN IF NOT EXISTS crm_deal_id uuid;

COMMENT ON COLUMN web_henvendelser_2026_10_04.spor IS 'besked | skitse | udbud | designer | variant — hvor formularen blev åbnet';
COMMENT ON COLUMN web_henvendelser_2026_10_04.kilde_svar IS 'Besøgerens svar på "Hvor fandt I os?" (valgfrit)';
COMMENT ON COLUMN web_henvendelser_2026_10_04.referrer_host IS 'Hostname på den eksterne side ved første sidevisning (fx chatgpt.com)';
COMMENT ON COLUMN web_henvendelser_2026_10_04.crm_deal_id IS 'Leadet i crm_deals_2026_04_12, som contact-form v6 oprettede eller føjede til';
