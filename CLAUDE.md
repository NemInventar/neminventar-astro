# neminventar-astro — CLAUDE.md

Det **nye** marketingsite for Nem Inventar (neminventar.dk). Bygget for at løse crawl-barhed (SEO) og for at gøre indhold redigerbart fra Supabase uden kode. Erstatter det gamle site (se "Forhold til det gamle site").

> Parent-scope: workspace-roden `CLAUDE.md` (virksomhed, hold, regler). Gentages ikke her.

---

## Flere Claude-sessioner samtidig — GitHub er sandheden, ikke SharePoint

- **Arbejd kun i din egen klon: `C:\dev\neminventar-astro`** (alle maskiner, alle brugere). Mangler den:
  `git clone https://github.com/NemInventar/neminventar-astro.git C:\dev\neminventar-astro` og kopiér `.env`
  (SUPABASE_URL + SUPABASE_ANON_KEY — den offentlige anon-nøgle, hent med Supabase MCP `get_publishable_keys`).
  SharePoint-kopien (`99. Hjemmesider/neminventar-astro`) er låst: git-hooks afviser commit og push. OneDrive synker
  `.git` fil for fil, og to skrivende maskiner i samme mappe ødelægger repoet.
- **Før du går i gang:** `git pull --rebase`. Større arbejde (fx overhalingen på `forside-v2`) sker på en **branch**
  og merges til `main` med en pull request; små tekst- og billedrettelser må gå direkte på `main`.
- **Hver branch tjekkes og forhåndsvises automatisk** (`.github/workflows/preview.yml`): samme tekst-lint og build som
  udgivelsen, og en forhåndsvisning på `https://<branch>.neminventar-preview.pages.dev` (noindex, adressen står i
  kørslens Summary på GitHub). Rød kørsel = merges ikke.
- **`main` er live** (GitHub Pages ved push + natligt build kl. 04) og **beskyttet**: ingen force-push, ingen sletning.
  Rul tilbage med `git revert <commit>` + push.
- **Databasen er fælles og har ingen branches — og natbygget læser den.** Ændrer en branch en tabel eller et view, som
  `main` læser, går det levende site i stykker kl. 04, selv om koden ligger på en branch. Derfor: byg nyt *ved siden af*
  (ny kolonne, nyt view, fx `v_web_*_v2`), lad branchen læse det nye, og fjern det gamle først efter merge.
  Gem SQL-ændringer som fil i `sql/`. Tekst rettet i Supabase (fx i /tekster) går live ved næste build — også fra en branch-session.

---

## Hvorfor dette site findes (kort historik)

Det gamle site (`../NeminventarHomepage`) er en **Vite + React SPA med HashRouter** (`#/`-routes). Problem: crawlere (Google/AI) ser **kun en tom skal** — alt indhold injiceres af JS. Derfor blev neminventar.dk ikke indekseret. Dette site er en **statisk genereret Astro-side** hvor hver rute er rigtig HTML med tekst, meta, canonical og sitemap → crawlbart.

Designet kommer fra mockup **C2** (`../NeminventarHomepage/mockups/C2-fable-arketyper-projekter.html`) — den retning Joachim valgte. Positionering: selvsikker, "mennesker der bygger for mennesker", fokus på håndværk + det digitale + certificeringer + samarbejde. **Holdet er ingeniører** — undgå at overdrive "snedker"-ordet og gør dem aldrig til håndværkere ved høvlebænken.

---

## Stack

- **Astro 6** (static output) + **React 19** (islands, kun hvor interaktivt) + **Tailwind v4** (`@tailwindcss/vite`)
- **@astrojs/sitemap** — auto-genererer `sitemap-index.xml`
- Designsystemet er håndskrevet CSS i `src/styles/site.css` (porteret 1:1 fra C2 — Archivo-overskrifter + Inter brødtekst). Tailwind er tilgængelig til småjusteringer, men forsidens look styres af `site.css`.
- Data: **build-time fetch fra Supabase** (ingen runtime/DB-kald i browseren).

---

## Arkitektur — sådan flyder data

```
ERP-Supabase (guhbrpektblabndqttgp)
  product_catalog_2026_05_03        ← kanonisk arketype (delt med ERP)
  product_catalog_images_2026_05_03 ← renders, har color/approved_for_web
  projects_2026_01_15_06_45         ← projekter (internt)
        │
        │  web-præsentationslag (peger på ovenstående, duplikerer IKKE)
        ▼
  product_web_2026_06_11   (web-tekst, SEO, hero, farve-rækkefølge, is_web_published)
  case_web_2026_06_11      (offentlig case-tekst, is_web_published, show_customer_name, status)
        │
        │  kuraterede READ-ONLY views (kun web-publiceret + web-sikkert data)
        ▼
  v_web_products   v_web_cases     ← anon må KUN læse disse, aldrig rå tabeller
        │
        │  build-time fetch (src/lib/supabase.ts, kører i Node ved `astro build`)
        ▼
  Statisk HTML i dist/  → GitHub Pages
```

**Vigtigt:**
- **ERP-projektet** er `guhbrpektblabndqttgp` — IKKE det gamle sites Supabase-projekt (`nlyqbvwryocpzrwicxmf`, som kun har company_info/team/kontakt).
- **Tilbuds-tekst** lever i `project_quote_line_items` (pr. projekt) — IKKE her. Web-laget er ren præsentation og kan afvige frit fra både katalog og tilbud.
- Selve produktet/arketypen findes **én gang** i `product_catalog`. Web-laget tilføjer kun præsentation ovenpå.

---

## Web-præsentationslaget (det du redigerer for at ændre indhold)

To tabeller i ERP-Supabase (oprettet 2026-06-11, migration `create_web_presentation_layer_2026_06_11`):

**`product_web_2026_06_11`** (1:1 med arketype via `product_id`)
- `is_web_published` — web-specifik publish (uafhængig af ERP'ets `is_published`)
- `hero_tagline`, `web_intro`, `web_story` — web-tekst (falder tilbage til katalog-tekst hvis NULL, se view)
- `seo_title`, `seo_description`
- `hero_image_id` → valgt forsidebillede (ellers primært approved_for_web-billede)
- `color_order text[]` — rækkefølge af farve-varianter (matcher `images.color`)
- `web_display_order`

**`case_web_2026_06_11`** (1:1 med projekt via `project_id`)
- `is_web_published` — **det eksplicitte "vis-på-web"-flag.** Kun cases markeret her vises. (NB: ERP'ets `phase`-felt er IKKE pålideligt for leveret/vundet — derfor dette flag.)
- `show_customer_name` — om kundenavn må vises. Hvis false viser view'et "Hovedentreprenør" i stedet. (Ason + Enemærke & Petersen er godkendt til offentlig visning pr. 2026-06-11.)
- `web_slug` — URL på `/projekter/<slug>`
- `public_title`, `hero_tagline`, `web_summary`, `web_story`
- `status_label` ("I produktion · 2026" / "Leveret"), `status_live` (pulserende dot)
- `delivery_label`, `contractor_label`, `hero_image_url`, `seo_*`

**Views:** `v_web_products`, `v_web_cases` — joiner web-lag + katalog + approved billeder, filtrerer `is_web_published=true`. Kun disse er `GRANT SELECT TO anon`.

---

## Sådan redigerer du indhold UDEN kode

Alt drives af Supabase ved build. Efter en ændring: **kør et build** (push til main → GitHub Actions bygger, eller `npm run build` lokalt).

| Jeg vil... | Gør dette i Supabase | 
|---|---|
| Rette en arketypes web-tekst/SEO | UPDATE `product_web_2026_06_11` (`web_story`, `seo_*`, ...) |
| Tilføje en arketype til kataloget | Sæt `product_catalog_2026_05_03.is_published=true` + opret en `product_web`-række med `is_web_published=true`. (Akustikpanel + skohylde-locker er pt. `is_published=false` — derfor 4, ikke 6, i kataloget.) |
| Vise/skjule en case | Toggle `case_web_2026_06_11.is_web_published` |
| Tilføje en ny case | INSERT i `case_web` (peg på et rigtigt `projects`-id, sæt `web_slug`, `is_web_published=true`) |
| Vise kundenavn på en case | `case_web.show_customer_name=true` |
| Rette/tilføje en landingsside (`/kompaktlaminat`, `/inventar-til-skoler` …) | UPDATE/INSERT i `landing_web_2026_09_24` (`is_web_published=true`). Ruten er `src/pages/[slug].astro`; forsidens "Det laver vi", footer og `/llms.txt` følger med. Billeder i `images` har `kind` = `foto`/`visualisering`/`tegning`/`video` (video kræver `poster`). Arbejdsgangen: skill `seo` |
| Vise entreprenør/arkitekt på en case | `case_web.show_customer_name` / `show_architect_name` = true — KUN efter skriftligt ok |
| Ny variant på en type (vælgeren på typesiden, forsidens inspiration) | Render i kuløren som samme skab (render-studio farveskift) → billedet får `color` = en slug fra `web_colors` (Rubio) eller en nøgle i `MATERIALEFARVER` (`src/lib/varianter.ts`) og `approved_for_web=true`. Andre kulører og billeder uden kulør vises ikke i vælgeren |
| "Åbn designeren" og "Hent IFC" på en type | Typen skal have en model i designeren: `DESIGNER_AF` + `TILSTAND` i `src/lib/forside.ts` (`designerLink`). Linket følger vælgerens kulør. Bevis: `scripts/test_designer_ifc.py` |
| Se alle varianter og hvad der mangler | ni-apps `/web-varianter`, læser `/varianter.json` (bygges af `src/pages/varianter.json.ts` med samme regler som typesiderne) |

---

## Web-farvevarianter (opskrift)

Arketyper vises i et fast sæt **standardfarver** — Rubio Monocoat hardwax-olie, **IKKE linolie** (det bruges ikke; for besværligt). Paletten lever i `web_colors_2026_06_11` (`slug`, `label`, `swatch_hex`, `prompt_modifier`, `sort_order`, `is_active`); `v_web_colors` viser kun de aktive. Fra 06-10-2026 = designerens 7 lagerfarver med samme slugs (`natur` = Klar olie, `roedbrun`, `blaa`, `cotton-white`, `cocoa`, `dark-roast`, `fern`; ni-apps `scripts/designer/rubio.py` LAGER) + vores `charcoal` (Joachim: "vil dog gerne se charcoal"). Skifter designeren en lagerfarve, skiftes den også her — samme slug begge steder. (`roedbrun`/`blaa`/`charcoal` er vores egne pigmenterede kulører, ikke fra Rubios kort.) Kompaktlaminat, HPL/laminat og stof er ikke olie: deres farver står i `MATERIALEFARVER` (`src/lib/varianter.ts`). HPL og laminat = Arpa HPL Bloom fra Riisfort (7 farver), kompakt = Sanders 6 lagerfarver (vi køber hos Sander Kabin), stof = Kvadrat Field 2 (Joachim 06/07-10-2026).

Sådan kommer en arketype web-klar med farver — **gør det samme hver gang**:

1. **Render** — kør `render-studio`/`arketype-studio` på arketypen, én render pr. aktiv farve i `web_colors` (brug farvens `prompt_modifier` i prompten). Træ-arketyper bruger hele paletten; akustik/tekstil har egne farver (Kvadrat) og håndteres separat.
2. **Navngiv + tag** — hvert godkendt billede gemmes i `product_catalog_images_2026_05_03` med `color = <web_colors.slug>` (fx `'cocoa'`) og `approved_for_web = true`. Slug'en er join-nøglen — derfor navngives varianter ens på tværs af alle produkter.
3. **Rækkefølge** — sæt `product_web.color_order = ARRAY['natur','blaa',...]`.
4. **Beskrivelse** — den gode beskrivelse hører til ARKETYPEN (`product_web.web_story`), ikke pr. farve. En farve er kun et billede + et navn.
5. **Vis** — typesiden viser én vælger med et billede pr. kulør (navn + hex fra `web_colors`, `src/lib/varianter.ts`); valget skifter hovedbilledet og "Få pris på denne". Renders i samme kulør skal vise samme skab, ellers giver vælgeren ikke mening.

Tilføj/ret en standardfarve → UPDATE/INSERT i `web_colors_2026_06_11`. Den slår igennem på alle produkter der har en render i den farve. **Ingen separat "upload produkt"-skill** — det er render-pipelinen + denne opskrift.

---

## Sikkerhed (LÆS DETTE)

- **Følsomme ERP-tabeller er RLS-beskyttede** (verificeret 2026-06-11): `projects_*`, `crm_*`, `economic_*`, `project_quote*`, `companies_*` m.fl. returnerer tomt for anon. Men nogle ikke-følsomme/oversete tabeller mangler RLS og er direkte anon-læsbare: `product_catalog_2026_05_03`, `product_catalog_images_2026_05_03`, `quote_line_images_2026_05_28`, `bank_tag_rules`, `bank_tag_overrides`. Katalog/billeder er ikke følsomt (vi udgiver det alligevel), men `bank_tag_*` bør lukkes. **Åben opgave (afventer Joachims ok):** slå RLS til på de resterende RLS=false-tabeller + verificér at ERP-appen stadig virker. Sitet er uafhængigt: det læser kun de kuraterede views (postgres-owned → bypasser RLS).
- **Nøgle-håndtering:** `SUPABASE_ANON_KEY` læses via `astro:env/server` — **kun ved build**, aldrig i browser-bundtet (statisk site → `dist/` har ingen nøgle). Den ligger i `.env` lokalt (gitignored) og som **GitHub Actions secret** i CI. **Hardkod aldrig nøglen i kildekoden.**
- Det eneste anon-eksponerede er `v_web_products` / `v_web_cases`.

---

## Deploy

GitHub Pages via `.github/workflows/deploy.yml` (push til `main` → build → deploy). Samme mønster som det gamle site (org: **NemInventar**).

**Påkrævede GitHub-secrets** på repoet:
- `SUPABASE_URL` (= `https://guhbrpektblabndqttgp.supabase.co`)
- `SUPABASE_ANON_KEY` (ERP anon-nøgle)

Ud over push kører workflowet **hver nat** (cron), så tekster rettet i Supabase/`/tekster` går live uden push. Manuelt nu: `gh workflow run deploy.yml --repo NemInventar/neminventar-astro`. Tekst-tjekket `scripts/lint-web-copy.py` kører før build — et FEJL-fund stopper deployet. Efter deploy kan CDN'et give 404 i et par minutter; test med `?x=<tilfældigt>`. Interne links er base-bevidste via `import.meta.env.BASE_URL`.

---

## Dev-kommandoer

```bash
npm install
npm run dev      # localhost:4321
npm run build    # → dist/ (henter live fra Supabase-views; kræver .env)
npm run preview  # serv dist/ lokalt
```

`.env` skal findes lokalt (se Sikkerhed). Uden den fejler build med en tydelig astro:env-fejl.

---

## Filkort

```
src/
├── layouts/Base.astro        # html-skal + SEO-meta (title, description, canonical, OG), fonts, Nav+Footer
├── components/Nav.astro       # sticky nav, base-bevidste links
├── components/Footer.astro
├── pages/
│   ├── index.astro            # forside (hero, katalog, bridge, cases, værdier, cert, proces, CTA)
│   ├── produkter/[slug].astro # produkt-detalje, getStaticPaths fra v_web_products
│   └── projekter/[slug].astro # case-detalje, getStaticPaths fra v_web_cases
├── lib/supabase.ts            # build-time Supabase-klient + getWebProducts/getWebCases + typer
├── integrations/lokale-billeder.mjs # efter build: Supabase-billeder → dist/_b på eget domæne
├── lib/api.ts                 # API_AKTIV-flaget: formular + Plausible via api.neminventar.dk (med fallback)
└── styles/site.css            # designsystem (porteret fra C2-mockup)
api/public/_worker.js          # proxyen bag api.neminventar.dk (Cloudflare Pages neminventar-api), test: api/test/
.github/workflows/deploy.yml   # Pages-deploy
.github/workflows/api.yml      # udgiver proxyen (push med ændringer i api/) · api-domaene.yml lægger domænet på
```

---

## SEO — hvordan sitet bliver fundet

**Brug skill `seo` (`plugins/seo/`).** Den ejer arbejdsgangen: status og plan, ny landingsside, billeder/tegninger/video, brochure, IndexNow, snapshot og søgeord. Den er skrevet, så indholdsejeren (Marianne, DRI for processen *Hjemmeside-drift & indhold*) kan køre alt selv.

Filen her bærer ingen status. Den står i kilderne:
- **Score over tid:** `v_seo_udvikling`
- **Plan:** huskelisten med tag `seo`
- **Sider:** `v_web_landing_pages`
- **Regler for teksterne:** `canon_detail('landingssider')`

Fælder, der gælder kode-ændringer her:
- Nye `kind`-værdier på billeder skal med i `WebImage` (`src/lib/supabase.ts`) og `imgLabel` i `src/pages/[slug].astro`.
- Filer i `public/` kommer først med ved push. Et billede, der kun ligger lokalt, er brudt på sitet.
- Billeder fra Supabase serveres fra neminventar.dk (firmafiltre vurderer hvert domæne for sig). `cdn()` returnerer stadig Supabase-URL'en; efter build henter `src/integrations/lokale-billeder.mjs` hvert billede ned i `dist/_b/` og skriver URL'en om. Fejler en hentning, bliver den fjerne URL stående med en ADVAR i loggen. Buildet fejler aldrig på et billede. Test: `node --test src/integrations/lokale-billeder.test.mjs`.
- Formularen og Plausible kan gå via vores eget domæne `api.neminventar.dk` (proxy i `api/`). Det styres af ét flag, `API_AKTIV` i `src/lib/api.ts`. Formularen prøver supabase.co én gang ved netværksfejl, aldrig ved et HTTP-svar. Ny formular eller nyt statistikkald → brug `formularFetch`/`plausible` derfra, aldrig en hardkodet supabase.co- eller plausible.io-adresse. Test: `node --test src/lib/api.test.ts api/test/*.test.mjs`, proxyen `scripts/test_api_proxy.py`, et build med flaget sandt `scripts/test_api_aktiv.py`. Browsertests skal opfange `**/contact-form` (begge adresser), ellers sendes der rigtige henvendelser, når flaget er sandt.
- Sitet serverer `neminventar.dk` siden cutover 2026-06-22. `../NeminventarHomepage` er udfaset.
