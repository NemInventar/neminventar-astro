# neminventar-astro — CLAUDE.md

Det **nye** marketingsite for Nem Inventar (neminventar.dk). Bygget for at løse crawl-barhed (SEO) og for at gøre indhold redigerbart fra Supabase uden kode. Erstatter det gamle site (se "Forhold til det gamle site").

> Parent-scope: `../CLAUDE.md` (mappe-oversigt) og workspace-roden `../../CLAUDE.md` (virksomhed, hold, regler). Gentages ikke her.

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
| Farve-varianter på en arketype | Render i farver via arketype-studio-skillen → sæt billeders `approved_for_web=true` + `color` → sæt `product_web.color_order` |

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

**Base-sti:** Workflowet sætter `BASE_PATH=/<repo>/` + `SITE_URL=https://<org>.github.io` til **projekt-side** (prøveside). Alle interne links er base-bevidste via `import.meta.env.BASE_URL`, så de virker på både `/repo/` og `/`.
**Ved cutover til neminventar.dk:** fjern `BASE_PATH` (base bliver `/`), sæt `SITE_URL=https://neminventar.dk`, tilføj en `public/CNAME` med `neminventar.dk`, og flyt DNS fra det gamle repo.

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
└── styles/site.css            # designsystem (porteret fra C2-mockup)
.github/workflows/deploy.yml   # Pages-deploy
```

---

## Status (pr. 2026-06-11) — hvad mangler før go-live

Færdigt: forside + katalog (4 arketyper) + 2 cases (Mørkhøj, Bølholmen) + detaljesider, crawlbar HTML, web-lag + live fetch, deploy-workflow.

Mangler:
1. **Repo + Pages + secrets** oprettes (kræver GitHub-login) → prøveside-URL.
2. **Politik-sider** (privatliv + cookies) — porteres fra det gamle site (lovkrav).
3. **Logo + favicon** — pt. wordmark-tekst + Astro default-favicon.
4. **Kontaktformular** — det gamle site har en (Supabase edge function + Resend). Pt. mailto-knapper.
5. **ERP-RLS** (sikkerhed, se ovenfor).
6. Nice-to-have: rigtige projektfotos, flere publicerede arketyper, farve-galleri, enrich Bølholmen-scope.

---

## Forhold til det gamle site

`../NeminventarHomepage` (repo: `NemInventar/NeminventarHomepage`) serverer pt. det live neminventar.dk. Dette nye site er bygget **ved siden af** og rører ikke det live domæne før et bevidst cutover (DNS/CNAME flyttes). Indtil da deployer dette til en projekt-side-URL som prøveside.
