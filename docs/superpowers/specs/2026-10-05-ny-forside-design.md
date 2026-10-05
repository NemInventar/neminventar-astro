# Ny forside og konvertering på neminventar.dk — design

**Status:** godkendt retning af Joachim 05-10-2026 ("forsiden er vild, det er præcis sådan det skal være"). Denne fil er designet; implementeringsplanen skrives bagefter.
**Mockup (facit for udseendet):** https://claude.ai/artifact/ACF5Y1htujtn7Yrz9ZfhMx · kilde i session-scratchpad `forside-ny/index.html` (kopieres til `mockups/forside-v3.html` på grenen).
**Gren:** `forside-v3` (fra `forside-v2`). `forside-v2` merges ikke for sig — v3 bygger oven på dens komponenter.
**Skrevet af:** Claude for js@neminventar.dk.

---

## 1. Hvorfor

- Sitet giver allerede opgaver. **26030 Borgerskolen** kom fra ChatGPT via neminventar.dk, og der kom 3 småsager i tilbud@ i uge 40 fra ChatGPT eller Google. Samlet er det næsten 2 mio. kr. i tilbudsomsætning på omkring en uge.
- **Kilden registreres ikke.** I CRM står `lead_kanal` som "Google" én gang, og det er en test. Plausible viser, at henvendelserne kommer som **mailklik**: 12 af ca. 65 besøgende har klikket i alt 21 gange siden 26-09. Når nogen klikker på en mailadresse, går det tabt, hvor de kom fra.
- Trafikken er lille, men den vokser. Search Console gik fra 14 til 148 visninger om dagen efter 24-09. Plausible: Direct 30, Google 27, ChatGPT 7 besøgende. Søgninger, som en AI har formuleret, ses også i Search Console. Folk lander mest på forsiden (45 af ca. 80 indgange).
- v2 er pæn, men lang (15.500 px og 15 sektioner), og den nævner Mørkhøj ca. 28 gange.

**Målet:** Entreprenører og købere, der er klar til at sende tegninger eller købe i dag, skal kunne komme i gang med ét klik. Arkitekter skal kunne finde filer, de kan bruge, fx IFC. Det skal være synligt, at vi har styr på det.

## 2. Beslutninger (Joachim 05-10-2026)

| # | Beslutning |
|---|---|
| B1 | Toppen er **A · Værkstedet i browseren**: en levende 3D-model. B (scroll-film) er fravalgt |
| B2 | Toppen har **tre veje**: *Design det selv* · *Vælg fra kataloget* · *Send os materialet (skitse, udbud eller mail)* |
| B3 | **Kort forside med almindelig scroll.** Ingen scroll-film og ingen video i fuld skærm. Ca. 7 sektioner, og hver fører til sin egen side. *Opmærksomhedspunkt, ikke en hård regel* |
| B4 | **En sag nævnes sparsomt.** Mørkhøj ét sted pr. side som udgangspunkt. Fotos får en billedtekst om, hvad de viser, ikke hvor de er fra. *Opmærksomhedspunkt.* Tekst-tjekket må højst give ADVAR |
| B5 | **Priser:** nu "fra ca." på godkendte prisbogsprodukter og svar inden for én arbejdsdag. Designerens pris vises først, når prisgitteret er valideret. Indtil da står der "Få et tilbud". **Toppen regner ingen pris** (Fable 05-10): læsefeltet viser kun spec og "Få et tilbud på denne". Antal × stykpris er et prisgitter i forklædning, og den perforerede locker med kodelås er ikke regnet. "Fra ca." står kun på katalogkort for godkendte prisbogsprodukter med samme udformning som billedet |
| B6 | **Inspiration via renders.** Begrebet er en *variant* (§7): render + forudindstilling i designeren + IFC + pris |
| B7 | **Få designere:** højskab og lockers nu, bænk og garderobe senere. De øvrige typer er projektvarer med "Få pris" |
| B8 | Designeren bliver i `ni-apps` (designer-sessionens plan §12a: "Ingen kopi på GitHub Pages — tekst og SEO bor i Astro og linker/indlejrer") |
| B9 | Private må gerne skrive. Der er ingen særskilt privatside. Fra-priser og formularen sorterer selv |

## 3. Delprojekter og rækkefølge

| # | Delprojekt | Repo | Ejer | Afhænger af |
|---|---|---|---|---|
| **D1** | Konverteringslaget: formular med kilde → CRM, mailto med emne, Plausible-mål. **Merges til `main` for sig**, fordi formularen allerede bruges på /kontakt og landingssiderne | `neminventar-astro` (gren `konvertering` fra `main`) + edge fn `contact-form` | denne session | — |
| **D3a-lite** | Designeren offentligt: tilstand i URL'en (permalink) og et separat Pages-projekt uden pris-filer | `ni-apps` | **designer-sessionen** (ejer `core/`) | — |
| **D2** | Den nye forside (7 sektioner), først med stillbillede og "Åbn designeren" | `neminventar-astro` (gren `forside-v3`) | denne session | D1. "Åbn designeren" kræver D3a-lite; indtil da linker knappen til "Send os materialet" |
| **D3b** | Indlejring i toppen (`indlejr.v1.js`) + "Få et tilbud" i designeren → `contact-form` | `ni-apps` | designer-sessionen | D1-kontrakten, D3a-lite |
| **D4** | `/inventar` og typesider med varianter | `neminventar-astro` (fast liste først, tabel senere) | denne session | D3a-lite for "Åbn i designeren" |
| **D5** | Bænk- og garderobedesigner | `ni-apps` | designer-sessionen | prisbogs-opskrifter |
| Spor | IFC til varianter uden designer · prisvalidering → "Bestil" | `ni-apps` / prisbog | designer-sessionen / Milot | — |

**Rækkefølge:** D1 → D3a-lite → D2 → D3b → D4. Det, der kan gå live i denne uge, er D1 og D2 med stillbillede. D3a-lite går live, så snart designer-sessionen er klar.

Denne session retter **ikke** i `ni-apps/public/prisbog/designer/core/` eller `produkter/`. Ønsker til designeren sendes som overdragelse i `handoffs_2026_05_28`, med en pointer på huskelisten til js@.

## 4. D1 · Konverteringslaget

**Formularen** (`src/components/ContactForm.tsx`, v2 med filer op til 10 × 50 MB) udvides med:

| Felt | Hvordan | Gemmes i |
|---|---|---|
| `spor` | `skitse` · `udbud` · `designer` · `variant` · `besked`, ud fra hvor formularen er åbnet | `web_henvendelser.spor` (ny kolonne) |
| `kilde_svar` | "Hvor fandt I os?": Google · ChatGPT eller anden AI · Anbefaling · LinkedIn · Vi har arbejdet sammen før · Andet. Valgfrit | ny kolonne |
| `referrer_host`, `landingsside`, `utm_*` | Den eksterne side, der sendte besøgeren **til den side, formularen står på**, som hostname, plus sidens sti og utm_*. **Intet gemmes på enheden**: ingen sessionStorage og ingen cookie. Det er en tidligere bevidst beslutning (intet samtykke-banner), og cookiereglerne gælder også for anden lagring til statistik. Kom besøgeren via en intern side, er kilden tom, og `kilde_svar` er reserven. Forsiden og landingssiderne har formularen på selve siden, så det er tit landingssiden, der giver kilden (rettet 05-10 under implementeringen; Fable foreslog sessionStorage) | nye kolonner |
| `konfiguration` + `permalink` | Kun når `spor` er `designer` eller `variant`. jsonb, højst 4 KB. Er samme JSON som designerens `?t=` | ny kolonne |

Formularen beholder skiftet **Erhverv/Privat** og linket til handelsbetingelserne fra v2 (B9).

**`contact-form` v6** (bagudkompatibel: v5-kald uden de nye felter virker uændret, fordi live-sitet bruger samme funktion):
- **Usynlig Turnstile** på formularen, verificeret server-side. Uden gyldig token sendes mailen stadig, men der oprettes intet lead. Rate-limit som ved `kind=opkald`.
- `kind="besked"` opretter **best effort** et lead i `crm_deals_2026_04_12`: `source_channel 'Hjemmeside: formular'`, `pipeline_stage 'lead'`, `created_by 'claude_auto'`, `assigned_to 'milot'` og en pointer på huskelisten som ved opkald. Fejler insert, sendes mailen med "Lead: fejlede".
- **`lead_kanal`-mapning** (CHECK-reglen tillader kun disse værdier): Google → `Google` · ChatGPT eller anden AI → `ChatGPT/AI` · Anbefaling → `Anbefaling` · LinkedIn → `LinkedIn` · Vi har arbejdet sammen før → `Relation` · Andet → `Andet` · tomt → `leadKanal(referrer_host)` (samme funktion som ved opkald) · ellers `Ukendt`.
- **Dedup:** findes der i forvejen et lead med samme e-mail i `pipeline_stage = 'lead'` inden for 30 dage, tilføjes henvendelsen til dets `description`, og der oprettes ingen ny række.
- Mailens emne får `[CRM <id8>]`, og brødteksten får linjen "Lead i CRM: <id> · kilde: <kanal> · side: <landingsside>". Så opretter hverken mennesker eller mailscan leadet en gang til.
- `ALLOWED_ORIGINS` får designerens offentlige origin (D3b).
- `dry_run=true` validerer og returnerer det, der *ville* være skrevet, uden at skrive eller sende noget. Så kræver tests ingen sletning bagefter.
- Felterne valideres og afkortes. Ingen ekstra persondata ud over det, formularen allerede har. Privatlivspolitikken §2 opdateres med "hvor I fandt os".

**Mailto med emne:** alle `mailto:`-links får `?subject=Forespørgsel fra neminventar.dk – <sidens navn>`. Én hjælpefunktion i `src/lib/` bruges alle steder. Det er en hjælp, ikke en garanti, fordi "Kopiér" og indtastede adresser omgår den. Formularen er den primære vej.

**"Bestil et opkald"** (`CallbackForm`, Milot ringer) findes allerede og ligger i Send-panelet under "Bare en mail".

**Plausible-mål:** `Henvendelse sendt` (props: spor, kilde_svar), `IFC hentet` / `DXF hentet` (props: produkt, side), `Designer åbnet`. **Målene oprettes som goals i Plausible-dashboardet**, ellers vises de ikke. "Mail" findes allerede.

**Ikke med:** chat-widget, booking af møder, automatisk svar-mail med tilbud.

## 5. D2 · Forsiden

Mockuppen er facit for rækkefølge, tekst og udseende. Komponenterne fra v2 genbruges, hvor de findes (`ProcessSteps`, `ProjectCard`, `ContactCta`, `ContactForm`, kulørbåndet, `Nav`, `Footer`).

| # | Sektion | Data | Komponent |
|---|---|---|---|
| 1 | **Top: tre veje** | Paneler: *Design selv* (3D, §6), *Katalog* (6 typer fra `v_web_products` + mærkerne designer og IFC), *Send* (ContactForm med tre spor: skitse · udbud · bare en mail) | ny `HeroPaths.astro` + `HeroDesigner.astro` (ø) |
| 2 | **Bevisbjælke** | 4 tal fra 4 forskellige sager, parset fra `delivery_label` (som v2's Ticker), men statisk og med én sag pr. tal | `ProofRow.astro` |
| 3 | **Inspiration** "Set i 3D, før det bygges." | Mosaik af 7 udvalgte varianter fra en fast liste i `src/lib/catalog.ts` (§7) | `InspirationMosaic.astro` |
| 3b | **Det laver vi** (`id="ydelser"`) | Kompakt række af pills: målgrupper og emner fra `v_web_landing_pages`, med beskrivende ankertekst. Det er sitets link-hub til de 30 landingssider | v2's ydelses-liste, gjort kompakt |
| 4 | **Fra 3D-model til færdigt rum** | v2 + linjen "Dokumentation og filer" (Svanemærket byggeri · DGNB · EPD · IFC · Dalux · iBinder) | `ProcessSteps` |
| 5 | **Projekter** | 3 sager af forskellig art (skole · boliger · idræt) fra `v_web_cases`. Udvalget står i koden | `ProjectCard` |
| 6 | **Syv kulører** | `v_web_colors`, **uden sagsmærker**, plus 3 punkter om olie | kulørbåndet (v2) |
| 7 | **Kontakt** (mørk) | holdet fra `src/lib/team.ts` | `ContactCta` (ny variant med hold) |

**Krav:**
- Toppens tekst og knapper er synlige med det samme. **LCP er toppens stillbillede**, en render af standardvarianten, ikke WebGL. Mål: LCP under 2,5 s på 4G og CLS under 0,05.
- 3D indlæses først efter `load` og kun på enheder, der kan WebGL. Ellers vises stillbilledet med knappen "Se den i et rum".
- Fanerne virker uden JS. Det er links til `#design`, `#katalog` og `#send`, og uden JS vises alle tre paneler under hinanden.
- **Ankre og SEO:** katalogpanelet har `id="katalog"`, og "Det laver vi" har `id="ydelser"`, fordi landingssider, Nav, 404, produktsidernes brødkrumme (JSON-LD) og `/en/` linker dertil. `#projekter` peger på `/projekter` som i v2. Kickeren bliver en del af `<h1>`: "Fast inventar til byggeri. *Se det, før vi bygger det.*", så H1 har et kategoriord. Katalogpanelet får JSON-LD `ItemList` over typerne. Organization-JSON-LD fra v2 bevares.
- **Telefon (under 980 px) og `saveData`:** 3D hentes kun ved tryk på "Se i 3D". Stillbilledet er standard, fordi three og en løbende animation er for dyrt for alle besøgende. Reduced motion respekteres.
- Forsiden har som udgangspunkt kun én navngiven sagshenvisning ud over Projekter-sektionen, nemlig bevisbjælken.
- **Svarløftet** "Svar inden for én arbejdsdag" står ét sted i toppen og ét sted i formularen, ikke seks. Joachim 05-10-2026: det gælder altid, også i ferier.
- **Terminologi:** "bejdset" bruges kun om bejdsede låger, mens overfladen generelt hedder "olieret" (overflade-guiden er kilden).
- `lint-web-copy.py`: ny **ADVAR**-regel, når et sagsnavn fra `case_web.public_title` står mere end 2 gange i den renderede HTML for en side.
- Ingen målangivelser i mm i kundetekst, ingen stednavne fra egenproduktionen, ingen mærkenavne på dele (uændrede regler).

**Fravalg fra v2:** "Fire ting, vi lægger vægt på" · "To veje ind" (erstattes af toppen) · designer-teaseren · det mørke Mørkhøj-opslag · Rubio-videoerne (flytter til overflade-guiden) · tal-tickeren (bliver bevisbjælken).

## 6. D2/D3 · 3D i toppen (designerens kerne, ikke en kopi)

**D3a-lite (designer-sessionen, før indlejringen):**
- **Tilstand i URL'en:** `designer.html?p=<id>&t=<base64url(JSON-tilstand)>` læses ved start og skrives ved ændring (`replaceState`). `konfiguration` i leadet er samme JSON. Det er grundlaget for "Åbn i designeren", varianterne og leadet.
- **Eget Pages-projekt (`ni-designer`)**, bygget af ni-apps' gate fra en `dist/offentlig/`, der kun indeholder kerne, produkter og three. Ingen `pris/`, ingen `*/pris.js`, ingen `prisgitter.json`, ingen `intern.js`. Ingen Access og ingen bypass på `ni-apps`, fordi en bypass på `/prisbog/designer/*` ville åbne prisgitteret ved siden af. Testen kører på **dist-fillisten**, ikke kun importgrafen. Download-API'et får usynlig Turnstile.
- **Domæne (Joachim 05-10-2026):** `ni-designer.pages.dev` fra start. neminventar.dk's DNS ligger i Microsoft 365 (ns1-4.bdm.microsoftonline.com), så `designer.neminventar.dk` kræver en CNAME, som en M365-administrator skal lægge ind. Det kan ske senere uden kodeændring ud over `DESIGNER_URL`.

**D3b · indlejring i toppen:** én bundlet og versioneret fil `indlejr.v1.js` (esbuild med three indbygget, ca. 170 KB brotli). API'et er frosset pr. version og dækket af `test/designer-indlejr.test.mjs`:

```js
const d = await indlejr(element, { produkt: 'locker' | 'hoejskab', tilstand });
d.saet(tilstand)        // ændr mål, antal, kulør
d.on('aendret', fn)     // tilstand + menneskelæsbar spec ("12 lockers · 182 × 203 cm")
d.permalink()           // URL til designeren med samme tilstand (IFC, DXF og billede sker dér)
d.ryd()
```

- Astro importerer den **pinnede URL** (`/indlejr.v1.js`) i try/catch med 4 sekunders timeout. Ved fejl vises stillbilledet. En ny version får et nyt filnavn, så natlige pushes i `ni-apps` ikke kan vælte forsiden.
- `ni-designer` sender CORS til `https://neminventar.dk` og `*.neminventar-preview.pages.dev`.
- Hjemmesiden ejer **knapperne rundt om** 3D'en: kulør, antal og højde, læsefeltet og "Få et tilbud". Designeren ejer scenen og geometrien. "Hent IFC" i toppen åbner permalinket med `&hent=ifc`.
- **Mellemtrin, hvis bundlen trækker ud:** en iframe (`embed.html` + postMessage) på `ni-designer` (ikke `ni-apps`, som sender `X-Frame-Options: DENY`). Så bor knapperne i rammen.
- **Indtil D3b findes** (Joachim ok 05-10-2026): toppen bruger `src/scripts/hero3d.ts`, mockuppens scene, uden pris og uden IFC. Den indlæses efter `load` på computer og ved tryk på telefon, og stillbilledet er LCP. Når `indlejr.v1.js` findes, erstatter den `hero3d.ts`, som så fjernes, så der kun er én geometri.

**"Få et tilbud" i designeren (D3b):** sender `kind=besked, spor=designer, konfiguration, permalink` og evt. billedet som fil til `contact-form` v6, med Turnstile-token. Samme felter fra både hjemmesiden og designeren.

## 7. D4 · Varianter, `/inventar` og typesider

En **variant** er en bestemt udgave af en type, som vi har en render af. Titel, kulør og materiale følger allerede af typen (`v_web_products`) og billedets `color`, så de gentages ikke.

**V1 (nu):** en fast liste i `src/lib/catalog.ts`:
`{ image_url, product_slug, designer_produkt: 'hoejskab' | 'locker' | null, designer_tilstand, featured, order }`.

**V2 (når Marianne skal redigere i /tekster):** en tynd tabel ved siden af, `web_varianter` med `image_id → product_catalog_images`, `designer_produkt`, `designer_tilstand jsonb`, `featured`, `web_display_order`, `is_web_published`, og et view `v_web_varianter` (GRANT SELECT TO anon). `ifc_url`/`dxf_url` til typer uden designer venter på arkitektens svar fra BIM-spiken (designer-planen §12a trin 1b). Ingen eksisterende tabel eller view ændres (databasereglen i repoets CLAUDE.md).
- Knapper pr. variant: *Åbn denne i designeren* (findes `designer_produkt`, permalink med tilstanden) · *Hent IFC* (designeren laver filen ud fra tilstanden, ellers `ifc_url`, og ellers vises knappen ikke) · *Få pris på denne* (formular med `spor=variant` og konfigurationen udfyldt).
- `/inventar`: alle typer med familie-filtre (fra v2's katalog). Typesiden `/produkter/<slug>` får sektionen "Varianter" med alle typens varianter.
- Landingssider med en designer (`/lockers/`, højskabssiderne) får designeren som top. Google oplyser ikke søgeordet, men folk lander på den side, der passer til deres søgning.
- Marianne kan tilføje varianter i `/tekster` (ny fane), når tabellen findes. Renders laves med render-studio.

## 8. D5 og sporene (ikke denne sessions arbejde)

- **Bænk** (Pladebænk og Skærmvægsbænk findes som opskrifter) og **garderobe** (Børnegarderobe-fag er godkendt) som produkt 3 og 4 i designeren. Det dækker ca. 11 af 17 typer.
- **IFC til varianter uden designer:** statiske filer → `ifc_url`.
- **Prisvalidering:** når locker- og højskabsgitteret er valideret mod motoren, viser toppen og designeren prisen. "Få et tilbud" bliver til "Bestil" med en ordrebekræftelse fra os inden for én arbejdsdag, men ikke betaling.

## 9. Opmærksomhedspunkter

- **Rubio (Joachim 05-10-2026):** vi må bruge Rubio Monocoats prøver og klip, og renderfarverne baseres på dem. Rubios kort har i dag ingen sort eller grå, fordi deres "Black" og "Charcoal" er brune toner på alle træsorter. Båndet viser derfor Rubios prøve på ask for natur (Pure), røget eg (Cocoa) og skovgrøn (Fern), vores egne låger for rødbrun og blå, og sort og charcoal som farveflade. `web_colors.finish_note` og `prompt_modifier` bærer Rubio-navnet, og `swatch_hex` for røget eg og skovgrøn er målt på Rubios prøve.
- **Foto 01** (børnenes navne) må ikke bruges, og fotos med navnemærker i fuld størrelse skal retoucheres først.
- **Priser:** ingen i toppen, før prisgitteret er valideret (B5). "Fra ca." kun på katalogkort for godkendte prisbogsprodukter. Den perforerede locker med kodelås er ikke regnet.
- **Én sandhed:** sagstal, kulører og typer kommer fra views. I koden står kun udvalg og rækkefølge.

## 10. Test og bevis

- `npm run build` uden fejl og `lint-web-copy.py` med 0 FEJL på alle sider. ADVAR gennemgås.
- Playwright (computer 1440 og telefon 390): ingen vandret scroll, fanerne skifter (også uden JS), formularens tre spor, filvalg, kilde-feltet, mailto-emnet og ingen konsolfejl.
- **Formular-test uden mail:** `test_form_ui.py` (v2) udvides til `spor` og `kilde_svar`. Edge-funktionen testes med `dry_run=true`, som returnerer lead, henvendelse og mail som JSON uden at skrive eller sende noget: mapningen for alle 6 svar + tomt, dedup-grenen og manglende Turnstile.
- Lighthouse på forsiden på mobil: LCP under 2,5 s og CLS under 0,05.
- Forhåndsvisning: `https://forside-v3.neminventar-preview.pages.dev` (preview.yml). Merge til `main` først efter Joachims ok.

## 11. Beslutninger (Joachim 05-10-2026)

1. **D1 til `main`:** ja. PR #1 er merget og live 05-10.
2. **Lead-automatik:** ja. Formularen opretter lead i CRM med `assigned_to 'milot'` og en huskeliste-pointer (`contact-form` v6).
3. **Midlertidig 3D i toppen:** ja (§6).
4. **Domæne:** `ni-designer.pages.dev` nu, eget domæne senere (§6).
5. **Rubio:** vi må bruge deres materiale (§9).
6. **Svarløftet:** "Svar inden for én arbejdsdag" gælder altid.
7. **Forsiden live:** når Joachim har set forhåndsvisningen eller planen for resten.

## 12. Fable-gennemgang 05-10-2026 — hvad der blev ændret

| Fables fund | Ændring |
|---|---|
| En Access-bypass eller custom domain på `ni-apps` åbner prisgitteret, `/cashflow` og `/bilag` | Eget Pages-projekt `ni-designer` fra en dist uden pris-filer, og testen kører på fillisten (§6) |
| Cross-origin ESM-graf med bare `'three'`, uden CORS, og den skifter ved natlige pushes | Én bundlet og versioneret `indlejr.v1.js` med pinnet URL og timeout → stillbillede (§6) |
| Permalink findes ikke | D3a-lite trin 0: `?t=` med tilstanden (§6) |
| `lead_kanal` har CHECK, honeypot alene giver spam-leads, og 1 times dedup er for kort | Eksplicit mapning, Turnstile, best effort, 30-dages dedup, `[CRM id8]` i emnet (§4) |
| Toppen regnede priser | Ingen pris i toppen, før gitteret er valideret (B5) |
| Link-hubben `#ydelser` og `#katalog` forsvandt, og H1 havde intet kategoriord | "Det laver vi"-række, ankre bevaret, H1 med kategoriord, JSON-LD (§5) |
| D1 er uafhængig af v3 | D1 merges til `main` for sig (§3) |
| Variant-tabellen duplikerede data | Fast liste nu, tynd tabel senere (§7) |
