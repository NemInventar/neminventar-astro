-- Landingssider kan vise eksempler fra designeren (backlog b6ad6f44, 17-10-2026).
-- Kolonnen holder id'er fra src/data/designer-eksempler.json. Første id = hovedknappen "Byg den selv i designeren";
-- alle vises som kort under teksten (komponenten DesignerEksempler). Tom = ingen designer-blok.
-- Additivt: kolonnen står sidst i viewet, så main (select *) er upåvirket, indtil koden er merget.
-- Kørt som migration landing_web_designer_eksempler_2026_10_17.

ALTER TABLE landing_web_2026_09_24 ADD COLUMN IF NOT EXISTS designer_eksempler text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN landing_web_2026_09_24.designer_eksempler IS 'Eksempel-id''er fra designer-eksempler.json (neminventar-astro). Første id = hovedknappen "Byg den i designeren". Tom = ingen designer-blok.';

CREATE OR REPLACE VIEW v_web_landing_pages AS
 SELECT slug, kind, nav_label, kicker, h1, lead, body, highlights, faq, keywords, case_slugs, product_slugs, related_slugs, images,
    COALESCE(seo_title, h1 || ' | Nem Inventar'::text) AS seo_title,
    COALESCE(seo_description, lead) AS seo_description,
    web_display_order, updated_at,
    designer_eksempler
   FROM landing_web_2026_09_24
  WHERE is_web_published = true;
