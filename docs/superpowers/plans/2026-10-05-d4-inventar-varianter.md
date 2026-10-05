# D4 · /inventar og varianter — implementeringsplan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Det, mockuppen viste om kataloget, virker på neminventar.dk: en side `/inventar` med alle typer og filtre pr. familie; på typesiden vælger man en variant med billederne under hovedbilledet, og "Få pris på denne" følger valget; forsidens katalog og inspiration åbner typesiden med varianten valgt og sender varianten med til formularen.

**Architecture:** En variant udledes af data, der allerede findes: et godkendt billede i `v_web_products.images_meta` med en kulør, der er en Rubio-kulør (`v_web_colors`) eller står i `MATERIALEFARVER` (laminat, HPL, stof). Logikken ligger i én ren fil, `src/lib/varianter.ts`, testet med `node --test`. Formularen får varianten som `spor=variant` + `konfiguration` (via `?v=<slug>~<kulør>` på `/kontakt` eller `ni:tilbud` på forsiden). `contact-form` v6 tager allerede imod felterne. Ingen ændring i databasen eller edge-funktionen.

**Tech Stack:** Astro 6 (statisk), React 19-øer (`ContactForm`, `SendPanel`), TypeScript, `node --test`, Playwright (Python), `scripts/lint-web-copy.py`.

**Spec:** `docs/superpowers/specs/2026-10-05-ny-forside-design.md` §7, §4, B5. **Gren:** `inventar-varianter`. **Forhåndsvisning:** `https://inventar-varianter.neminventar-preview.pages.dev`. **Mockup (godkendt 05-10-2026, v2):** https://claude.ai/artifact/BNg5Gzjsbho7DjDKSWRbY1. Merge til `main` først efter Joachims ok på forhåndsvisningen.

---

## Beslutninger (Joachim 05-10-2026, efter mockup og sparring med Fable)

1. **Varianter udledes af `images_meta`.** Ingen liste med billed-URL'er i koden. Ny render med `color` + `approved_for_web` = ny variant ved næste build. I koden står kun `MATERIALEFARVER` og forsidens udvalg.
2. **Kun Rubio-kulører og materialefarver er varianter.** Lockerens tre renders fra før Rubio (`deep-burgundy`, `sage-mint-green`, `powder-blue`, alt-tekst "linolie") bliver i galleriet uden at være varianter. Spørgsmålet om de skal ud, går til Joachim.
3. **Én vælger øverst.** Joachim: "Hvorfor kører vi med 2?" Miniaturerne og farveknapperne bliver til én række større billeder med kulørens navn under ("billederne lidt større"). "Få pris på denne · Blå" følger det viste billede. Viser billedet et foto fra en leverance eller en render uden variant, gælder knappen typen. Ingen separat sektion "Varianter".
4. **Designer og IFC pr. variant bygges ikke nu.** Uden kulør i designerens `?t=` ville de åbne det samme for alle kulører. Designer-linjen på typesiden mister sit døde anker `#designer` og sit prisløfte og fører til forsidens 3D (`#design`).
5. **Forsidens "Få pris på denne" åbner "Send os materialet" på forsiden** med varianten udfyldt, så formularen kan se, hvor besøgeren kom fra. Uden JS: `/kontakt?v=`.
6. **"Inventar" og "Hele kataloget" peger på `/inventar`.** Ankeret `#katalog` på forsiden bliver.
7. **To tekster retter sig efter B5:** "ser resultatet i 3D med pris" → "vi tegner det i 3D, før vi bygger".
8. **Dybe links bruger anker, ikke query:** `/produkter/<slug>#v-<kulør>`. Billederne bærer `data-v`, ikke `id`, så Base.astro's anker-rulning ikke trækker siden ned til miniaturen. Sidens script vælger varianten.
9. **Ikke med:** sektionen "Varianter", "Se 4 varianter" på kortene, designer/IFC-knapper pr. variant, Plausible-målene for designer og IFC, tabellen `web_varianter` (V2), `ifc_url`.

## Filkort

| Fil | Ny/ret | Ansvar |
|---|---|---|
| `src/lib/varianter.ts` + `.test.ts` | ny | `varianterAf`, `galleriAf`, `variantId`, `prisHref`, `variantFraUrl`, `variantTilbud`, `MATERIALEFARVER` |
| `src/components/ContactForm.tsx` | ret | `konfiguration`-prop, `?v=` → `spor=variant` |
| `src/components/SendPanel.tsx` | ret | `ni:tilbud` kan bære et variant-objekt |
| `src/pages/produkter/[slug].astro` | ret | Én vælger (større billeder med navn), knappen følger valget, `#v-` vælger, designer-linje, `/inventar`, B5 |
| `src/pages/inventar.astro` | ny | Alle typer, filtre pr. familie, ItemList + BreadcrumbList |
| `src/components/InspirationMosaic.astro`, `HeroPaths.astro`, `src/pages/index.astro` | ret | Varianterne: billede, `#v-`-link, pris med `data-variant`; `a[data-variant]` åbner "Send" |
| `Nav.astro`, `Footer.astro`, `404.astro`, `[slug].astro`, `llms.txt.ts` | ret | Links til `/inventar`, "Designeren" → `#design` |
| `scripts/test_inventar_varianter.py` | ny | Playwright-bevis (lokal dist eller preview-URL). Intet sendes |
| `CLAUDE.md` (repo), spec §7 | ret | Opskriften "ny variant" og V1 som bygget |

Kommandoer med absolutte stier (`git -C`, `npm --prefix`, `node --test C:/dev/neminventar-astro/src/lib/…`). De står i `trusted_scripts.json`.

---

### Task 1: `varianter.ts` (TDD)
- [ ] Tests i `src/lib/varianter.test.ts`: rækkefølge (color_order → farvekort → materialefarver), én pr. kulør, første billede vinder, ukendte kulører og billeder uden kulør springes over, materialefarver uden hex, tom type; `galleriAf` (foto først, dubletter fjernet, variant pr. billede, `v` kun på variantens eget billede); `variantId` med æøå og mellemrum; `prisHref` med og uden variant; `variantFraUrl` gyldig/ugyldig; `variantTilbud`.
- [ ] `node --test C:/dev/neminventar-astro/src/lib/varianter.test.ts` → FAIL (modul mangler).
- [ ] Skriv `varianter.ts`. Ingen imports.
- [ ] `node --test C:/dev/neminventar-astro/src/lib/` → `# fail 0`.
- [ ] Commit.

### Task 2: Formularen tager imod varianten
- [ ] `ContactForm`: prop `konfiguration?`; `urlVariant` fra `variantFraUrl(location.search)` efter mount; `sporNu = konfiguration ? spor : urlVariant ? 'variant' : spor`; send `spor: sporNu` + `konfiguration`; Plausible og pladsholder bruger `sporNu`.
- [ ] `SendPanel`: `somTilbud(detail)` accepterer tekst (designer) eller `{ besked, spor: 'variant'|'designer', konfiguration }`; `ContactForm key` indeholder spor + besked.
- [ ] Build → `Complete!`. Commit.

### Task 3: Typesiden — én vælger
- [ ] `getStaticPaths` henter også `getWebColors()` og giver `colors` med.
- [ ] `varianter = varianterAf(product, colors)`, `galleri = galleriAf(productImage(product).img, product.images_meta ?? [], varianter)`. Fjern `colorGroups`/swatches og de gamle miniaturer.
- [ ] Markup: hovedbillede + `.vtiles` (3 kolonner, 2 på telefon; billede 4:3 + kulørens navn med prik, eller "Foto fra leverancen"/"3D-visualisering"). Hvert billede bærer `data-src`, `data-tag`, `data-alt`, `data-label`, `data-pris` og `data-v` (kun variantens første billede).
- [ ] Knappen `#pris-knap`: `prisHref` for første billedes variant (eller typen); teksten `Få pris på denne · <kulør>`.
- [ ] Script: klik vælger (billede, mærke, alt, knap, aktiv), `replaceState('#v-…')`; ved load vælger `#v-…` den variant.
- [ ] Designer-linjen: kun for typer i `DESIGNER_AF`; tekst uden pris; link `DESIGNER_URL ?? /#design`.
- [ ] Brødkrumme (synlig + JSON-LD) og "Hele kataloget" → `/inventar`; B5-tekst under "Andre typer".
- [ ] Build; tjek `dist/produkter/hoejskab-krydsfiner/index.html` for `data-v="v-blaa"`, `v=hoejskab-krydsfiner~` og `/inventar`. Commit.

### Task 4: `/inventar`
- [ ] `src/pages/inventar.astro`: 17 typer + de typer uden arketype, der har en landingsside (v2's fem), sorteret pr. familie; filtre skjult uden JS; `types expanded`; ItemList + BreadcrumbList; `ContactCta`.
- [ ] Build; ≥ 17 `class="tcard"` i `dist/inventar/index.html`; `/inventar/` i sitemap. Commit.

### Task 5: Links
- [ ] Nav "Inventar" → `/inventar`, "Designeren" → `DESIGNER_URL ?? /#design` (snart, til den findes). Footer, 404, landingssidernes "Hele kataloget" → `/inventar` (+ B5-tekst). HeroPaths "Se alle typer og varianter" → `/inventar`. `llms.txt`: linje til `/inventar`.
- [ ] `grep "#katalog"` i `src`: kun forsidens egne ankre og kommentarer. Commit.

### Task 6: Forsiden
- [ ] `InspirationMosaic` (får `colors`) og `HeroPaths`' katalogpanel slår varianten op med `varianterAf`; billedet linker til `/produkter/<slug>#v-<kulør>`; "Få pris på denne" = `prisHref` + `data-variant` (`variantTilbud`). Typer uden kulør: som i dag.
- [ ] `HeroPaths`-script: `a[data-variant]` → `ni:tilbud` + `window.niTilbud`, åbn "Send", rul dertil.
- [ ] Build; 12 × `data-variant=` i `dist/index.html`. Commit.

### Task 7: Bevis og forhåndsvisning
- [ ] `scripts/test_inventar_varianter.py` (lokal dist eller URL; POST til contact-form opfanges): uden JS på `/inventar`; filtre; typeside: vælg billede → knaptekst og `v=`; dybt link `#v-blaa` → knappen siger Blå; `/kontakt?v=` sender `spor: variant` + konfiguration; forsidens flise-knap åbner "Send" og sender variant; ingen vandret scroll (1440 og 390); ingen JS-fejl.
- [ ] `node --test`, `lint-web-copy.py` (før og `--dist` efter build) med 0 FEJL, Playwright lokalt → 0 fejl.
- [ ] Push grenen; vent på preview-kørslen; Playwright mod preview-URL → 0 fejl.

### Task 8: Dokumentation
- [ ] Repoets `CLAUDE.md`: rækken "Ny variant på en type".
- [ ] Spec §7: V1 som bygget (udledt, én vælger, `#v-`).
- [ ] Commit + push. Vis Joachim forhåndsvisningen; merge efter hans ok.

## Efter merge (ikke kode)
- Luk backlog `1ea79a39` (farve-swatch): erstattet af vælgeren i D4.
- Spørg Joachim om lockerens tre renders fra før Rubio (ud, eller render i Rubio-kulørerne).
- Kanon: udvid en eksisterende række i `canon_register` med, at varianter på web udledes af `images_meta.color` + `web_colors`/`MATERIALEFARVER`.
- Luk handoff `fd25bbf3` med pointer til det, der står tilbage: designer/IFC pr. variant (efter designerens `?t=`), designeren som top på landingssider (D3b), V2-tabellen.
