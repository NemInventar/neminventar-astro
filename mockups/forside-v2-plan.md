# Forside v2 — plan

_03-10-2026. Mockup: [forside-v2.html](forside-v2.html) (ikke live). Bestilt af Milot: "forsiden viser ikke, at vi laver møbler". Sparret med to Opus-agenter (art direction og tekst)._

## Version 3 — Milots rettelser (samme dag)

Milot så v2 og bad om: mindre Mørkhøj som gennemgående tema · heroen smallere (samme bredde som resten) og lavere, så tal-striben kan ses på første skærm · to billedfelter, der skifter automatisk ét ad gangen fra ca. 1 sekund · "Flere projekter" tydeligt adskilt fra den fremhævede sag og ikke som liste · inventar-siden med mange flere typer i samme stil · behold designeren, "Fra 3D-model til færdigt rum" og tal-striben · billeder, der "popper lidt frem" ved hover.

Det gør v3:
- **Hero:** tekstrække + to felter i wrap-bredde (1,6:1), 360 px høje på computer. Bredt felt roterer 6 liggende fotos, smalt felt 7 højformater. Første skift efter 1,1 s, derefter hvert 3,2 s skiftevis. Pause ved hover og med knap. Mobil: kun det smalle felt (4:5), tryk = næste.
- **Fremhævet projekt** (mørk) som før, men mærket "fremhævet: Mørkhøj Skole".
- **Flere projekter** som egen lys sektion med fem kort (billede, status, navn, leverance, entreprenør) + et stiplet "Jeres byggeri"-kort, der fører til kontakt.
- **Inventar:** alle 17 typer fra det gamle katalog + 5 nye (Lockers med kodelås, Børnegarderober, Polstret siddeniche, Bænke med ryghynder, Glastavler og opslagstavler) = 22 fliser i 5 kolonner med familie-filtre øverst. 9 fliser har rigtige fotos, resten renders mærket "3D-visualisering". På telefon vises 8, resten bag "Vis alle".
- **Hover:** alle billedfliser (hero, mosaik, projektkort, inventar, proces) løfter sig 4 px med skygge, og billedet zoomer 4-5 %.
- De 5 nye typer findes ikke i `product_catalog` endnu — de skal oprettes som arketyper (med `product_web`-række), før de kan vises på det rigtige site.

## Hele sitet i samme designsprog — gren `forside-v2` (04-10-2026, runde 7)

Milot godkendte forsiden ("det er fint, jeg kan godt lide det her — det skal ikke online endnu") og bad om, at resten af sitet får samme designsprog. Gjort på samme gren, stadig ikke merget:

**Fælles byggeklodser** (`src/components/`): `ProductCard` (katalogkort), `ProjectCard` (projektkort med datarækker + "Se projektet"), `ProcessSteps` ("Fra 3D-model til færdigt rum", dansk/engelsk), `ContactCta` (kontakt-afsnit, fuld/kort, dansk/engelsk, `?emne=` til kontaktsiden), `Ticker` (tal-striben). Regler ét sted i `src/lib/catalog.ts` (familier, fotos, tal fra leverancen, datarækker) og holdet i `src/lib/team.ts`. Reveal- og video-scriptet ligger i `Base.astro`, så alle sider har det.

| Side | Før | Nu |
|---|---|---|
| **Nav** | 7 tekstlinks, intet på telefon ud over telefon + "Få pris" | Projekter · Inventar · Designeren (snart) · Sådan arbejder vi · Om os · EN · LinkedIn · telefon · Få en pris. På telefon/tablet: menu-knap med panel (virker uden JS); "Få en pris" flytter ind øverst i panelet ved ≤680 px, så alt står på én linje |
| **Footer** | Én lang linje med 30 links | Fire spalter: hvem vi er · Inventar og materialer (to kolonner) · Til + Guides · Nem Inventar + Det juridiske. Bundlinje med © og adresse |
| **Produktside** | Lille galleri, tekst, mailto-knap | Stort billede (4:3) med foto/visualisering-mærke, farve-swatches, familie som kicker, spec i rækker, "Få pris på denne" → kontaktformular med emnet forudfyldt, designer-boks (snart) på skabe/garderober, tre projekter fra samme familie (data fra landingssidernes `product_slugs`/`case_slugs`), tre andre typer, "Læs mere om"-pills, kontakt |
| **Projektside** | Titel, billede, tekst, 4 celler, gitter med 26 billeder blandet | Titel + faktaboks (Leverance/Entreprenør/Arkitekt/Status + "Har I et lignende projekt?"), hero 21:9 med mærke og tekst, talgitter fra `delivery_label`, tekst + "Det leverede vi"-liste (klæbende), fotos først med hvert 5. stort, visualiseringer for sig og mærket, **lysboks** (native `<dialog>`, piletaster, tæller), tre andre projekter, kontakt |
| **Landingssider (emne/segment)** | Galleri + tekst, cases i mørke kort uden data, arketyper som gamle kort, FAQ | Samme opbygning, men med nye kort (ProjectCard med datarækker, ProductCard), 3 kort pr. række (2×2 ved præcis fire), målgruppesider får "Fra 3D-model til færdigt rum", FAQ med label + overskrift, "Se også" som pills, kontakt med emne |
| **Guides** | Som emne-siderne | Artikel-layout: overskrift → stort billede 21:9 → "kort fortalt" i tre kolonner → tekst med klæbende kontaktboks i siden → ekstra billeder → FAQ |
| **Om os** | Tekst-spalte, hold, tekst om produktionen | Samme top som forsiden med 3D-video + prøveemne-video i de to felter, mærkater, tal-stribe; tre ting i et gitter (I/II/III); hold som kort med hover; produktionen som mørkt afsnit med proces-trinnene |
| **Kontakt** | Tekst + formular | Tekst + tre trin (Vi læser materialet → Tegning og pris → Vi bygger og leverer) + formular; "Hvem du taler med" med de tre |
| **EN** | Tekst-spalter | Samme top som forsiden (to fotos, mærkater), to kort + referencekort med tre fotos, proces-trin på engelsk, kontakt på engelsk |
| **404** | Lille tekstblok | Overskrift med kursiv-ord, pills til Forsiden/Inventar/Projekter/Om os/Kontakt, kontakt-afsnit |
| **Juridiske sider** | Hver sin kopi af `.legal`-styles | Fælles `.legal` i site.css |

Testet: build 61 sider · lint 0 FEJL på alle håndskrevne sider · ingen vandret overløb ved 390 px · menu åbner/lukker · lysboks med piletaster · kontakt-forudfyldning · farveskift på produktside · alle interne links på 7 nøglesider svarer 200.

**Datarettelser, der stadig venter:** foto 01 (børnenavne) i Mørkhøj-galleriet · de tre produkter, der viser et Mørkhøj-foto fra koden (`catalog.ts` PHOTO), skal have fotoet som `product_web.hero_image_id`, så listen kan væk · de 5 typer uden arketype.

## Bygget i koden — gren `forside-v2` (04-10-2026)

Milot bad om at få hele siden bygget i samme designsprog. Det ligger på grenen `forside-v2` (ikke på `main`, ikke deployet):
`src/pages/index.astro` (ny), `src/components/DesignerTeaser.astro` (ny), `src/styles/site.css` (nyt afsnit "FORSIDE v2" nederst — de gamle klasser bruges stadig af `/en/`), `Nav.astro` (Projekter · Inventar · Designeren snart · Sådan arbejder vi · Om os), `Footer.astro` (tagline).

Forskelle fra mockup v4 — Milots rettelser i runde 5:
- **Alle de gamle afsnit er tilbage** i deres oprindelige form og klasser: "Fire ting, vi lægger vægt på", "Ikke lakeret. Olieret …", "Dokumentationen følger med leverancen" og "To veje ind. Samme værksted" (nu med Send mål/Send udbud-knapper). "Fra 3D-model til færdigt rum" står før dem.
- **Flere projekter** fylder mere: to kort pr. række, 16:9-billede, resumé, datarækker (Leverance · Entreprenør · Arkitekt · Status — pladsholderen "Hovedentreprenør" vises ikke) og "Se projektet"-knap.
- Alt indhold kommer fra Supabase-views; kun rækkefølgen, de 13 hero-fotos og de 5 typer uden arketype står i koden. Tal-striben og talgitteret parses fra `delivery_label` ("342 lockers" → 342 + lockers).
- Ankrene `#katalog`, `#projekter`, `#ydelser`, `#cert`, `#kontakt` findes stadig, så landingssider, produktsider, `/en/` og brødkrummer virker.
- Lint: ingen FEJL på den byggede forside (kun ADVAR på "60 × 210 × 60 cm" i designer-teaseren — tilsigtet).
- Build lokalt: 61 sider, ingen fejl. Skærmbilleder taget på 1360 og 390 px.

**Live:** `git checkout main && git merge forside-v2 && git push` → GitHub Actions bygger og deployer (3-4 min). **Fortryd:** `git revert <merge-commit> && git push`.

## Version 4 — Milots rettelser til v3 (samme dag)

- **Inventar:** 5 små fliser pr. række var rodet. Nu 3 kort pr. række i samme størrelse som det nuværende katalog (4:3-billede, titel, beskrivelse, "Til mål · pris efter opmåling", "Se mere →"), men med foto/visualisering-mærke i stedet for nummer og familie som kicker. "Alle" viser 9 kort (et tværsnit: 6 fotos, 3 visualiseringer); "Vis alle 22 typer" eller et filter viser resten. Telefon: 2 kolonner, kompakte kort uden beskrivelse, 6 fremme.
- **Hero:** teksten "Garderober, lockers, bænke …" er flyttet ned under billederne sammen med fem mærkater (Bygget til mål · 3D-render før produktion · Egen produktion · Leverer til certificeret byggeri · Delleverancer efter tidsplan). Til højre for overskriften står kun de to knapper. Billederne er højere end i v3 (46 vh, ca. 415 px på en 900 px skærm) — og tal-striben er stadig synlig på første skærm på computer. Pauseknappen ligger oven på det smalle billede.
- Glastavle-kortet bruger et mobilfoto af klasserummet (det eneste vi har med tavlerne) — skal have et rigtigt foto.

## Hvad der er galt i dag

1. **Første skærm er tekst.** Ca. 70 ord og ét lille højformat-foto. På telefon kommer det første møbel efter ca. 800 px tekst.
2. **Det største i heroens billede er en stol, vi ikke har bygget** (foto 23). Problemet er formatet: ét højformat i 5/12 kan ikke bære siden.
3. **Næsten alt er renders.** 16 af 17 katalogkort og 5 af 6 projektkort er 3D-renders. 15 af fotografens 18 Mørkhøj-billeder bruges ikke på forsiden.
4. **Kataloget starter med bygningsdele** (vægbeklædning, skydedør, akustikpanel); garderober, skabe og køkkener ligger på plads 8-17.
5. **Teksten handler om proces, ikke om ting.** Fem af ti sektioner er proces, "3D" står seks gange, og ingen overskrift nævner et møbel.
6. **Siden er lang:** 14.900 px på computer, 30.200 på mobil.
7. **Hovedknappen fører til case-listen, ikke til kontakt.** Labelen "Snedkeri" peger mod høvlebænken, ikke mod ingeniørholdet.

## Hvad mockuppen gør (7 sektioner mod 10)

| # | Sektion | Indhold |
|---|---|---|
| 1 | **Hero** | Overskrift "Møbler til rum med mange *mennesker.*" over en fotoflade i fuld bredde med dias: 5 dias, de bedste højformater vist **parvis** (26+20, 32+27, 24+36) og liggende alene (21, 33). Ingen tekst oven på fotoet. 6 s pr. dias, stopper efter to runder, pause ved hover, pile og fremdriftslinje. Mobil: overskrift → foto 4:5 til kanten (swipe) → tekst og knapper. |
| 2 | **Tal-stribe** | Rullende tal fra sagerne: 342 lockers, 230 badeværelsesskabe, 150 m bænke, 92 børnegarderober, 68 glastavler, 43 skohylder, 16 omklædningsmøbler, 8-12 uger. |
| 3 | **Projekter** (mørk) | Mørkhøj som opslag: "342 lockers, 14 højskabe, 19 nicher. *Én skole.*", mosaik (25 bredt, 23, 28, 34, 37), talgitter med alle ni tal, kreditlinje. "Flere projekter" som fem tekstrækker — renderen kigger kun frem ved hover, mærket Visualisering. |
| 4 | **Inventar** | 6 familier i stedet for 17 kort: Garderober og lockers (30), Højskabe (22), Nicher og bænke (29), Tekøkkener (31), Omklædning og vådrum (render), Vægge, døre og akustik (render). Hver flise lister 3-5 typer; hover på et navn skifter flisens billede. Fotos mærket "Foto · Mørkhøj Skole", renders "3D-visualisering". Derunder segment- og materialelinks. |
| 5 | **Designeren** (kommer snart) | Interaktiv teaser af prismodulet: mål med skydere, fire materialer, farveprikker, greb, låger der åbner i 3D, "Drej". **Ingen prisbeløb** (priserne er ikke kalibreret). Prisfeltet siger "Pris · kommer snart", knap "Få besked, når den åbner". Bygget i ren CSS — ingen three.js på forsiden. |
| 6 | **Sådan arbejder vi** | Fire trin med rigtigt materiale: 3D-model (video), værkstedstegning, prøveemne (video), olieret og dokumenteret (foto 35 + chips Svanemærket/DGNB/EPD/Indeklima). Erstatter Bridge, "Fire ting", Overfladen, Certificering og "To veje". |
| 7 | **Kontakt** (mørk) | "Send os målene. Eller hele *udbuddet.*" + to kort (Udbud og projekter · Enkelte møbler) + telefon og mails. |

Hvert af fotografens 18 billeder bruges én gang. Siden er 8.800 px på computer og 12.700 på mobil.

## Beslutninger, der venter

- **Overskrift:** "Møbler til rum med mange *mennesker.*" (siger møbler først) eller beholde "Fra én bænk til en *hel skole.*"? Begge virker med fotoerne.
- **"Typisk 8-12 uger fra ordre til levering"** står offentligt i tal-striben og kontaktkortet. Er det et løfte, vi vil skrive?
- **"Private kan også bestille"** står nu to steder (kontaktkort + footer), ikke i heroen. Joachim besluttede 01-10 at det må stå; `00_Faelles/om-virksomheden.md` siger stadig "ikke privatkunder" og bør rettes.
- **Designeren:** "kommer snart" uden dato ligner stilstand efter et halvt år. Hvem ejer den, og hvornår åbner den? Skal teaseren have en måned?
- **Foto 01** (mobilfoto af garderoben) viser børnenes fornavne på skabene og ligger i dag offentligt i Mørkhøj-galleriet. Fjernes eller retoucheres. På 20 og 26 er navnemærker og en klasseliste små, men originalerne bør retoucheres før brug i fuld størrelse.

## Sådan bliver det live (i rækkefølge)

**Fase 0 — i dag, uafhængigt af redesignet**
- Tag foto 01 ud af `case_web_2026_06_11.gallery` for Mørkhøj (privatliv).
- Skift `og-default.png` til et beskåret 26 eller 33, så delinger på LinkedIn viser møbler.
- Ret "Start et projekt →" til kontakt.

**Fase 1 — forsiden (`src/pages/index.astro` + `site.css`)**
- Byg sektionerne fra mockuppen. Diasset gøres **datadrevet** (foto, fokuspunkt, billedtekst, link) ligesom resten af sitet — fx et `hero`-flag i `case_web.gallery` — så billedtekster kan rettes i `/tekster` uden kode.
- Billeder gennem `astro:assets <Picture>` (AVIF/WebP, srcset 640-2400), kun dias 1 forudindlæses. Mål: LCP under 2,5 s på 4G. Hent fotografens originaler (de nuværende er 1600-2000 px).
- Behold ankrene `#ydelser`, `#katalog`, `#projekter`, `#cert`, indtil `/inventar` og `/projekter` findes: alle 30 landingssider linker til `#ydelser`, og `/en/` skal følge med.
- Videoer: klip 3D-videoen, så den starter ved 4 s (de første sekunder er arkitektens 2D-plan), afspil kun i synsfeltet, stillbillede ved reduced motion.
- Kør `lint-web-copy.py` på al ny tekst før deploy.

**Fase 2 — Mørkhøj-siden**
Kapitler (Garderoben, Klasserummet, Fællesarealet, Tekøkkenet) med 2-4 fotos hver, tal og lysboks. Mobilfotos 02 og 05 under "Overblik".

**Fase 3 — produktsider, /inventar og /projekter**
Foto først, hvor fotoet viser arketypen, blok "Set på Mørkhøj Skole", renders i én katalogstil (samme vinkel, lys og baggrund via render-studio). "Få pris" bliver en kort formular med mål, antal, materiale og tegning. Ny arketype: polstret siddeniche (Mørkhøj har 19).

**Fase 4 — fotodag nr. 2**
Bølholmen og idrætshallen er leveret: fotografér dem i samme stil. 14 af 30 landingssider åbner med en render; de to sager dækker især kompaktlaminat- og idrætssiderne. Om os mangler fotos fra egenproduktionen (uden stednavne, uden EXIF).

**Fase 5 — designeren**
Når priserne er kalibreret: teaseren erstattes af prototypen i demo-tilstand, indlæst først når sektionen er synlig.

## Faldgruber

- **Påstande i billeder.** Stole, borde, fliser og lamper er ikke vores — billedtekster nævner kun det, vi har bygget. Ingen Mørkhøj-fotos på arketyper, de ikke viser.
- **Tung karrusel.** `cdn()` sender `/billeder/`-stier igennem uden skalering. Uden `<Picture>` bliver heroen flere MB på mobil.
- **Mails.** Alle knapper er `mailto:` i mockuppen. På sitet bør "Send udbud" og "Send mål" gå til kontaktformularen med forvalgt spor.

## Tilføjet 04-10-2026 (Milot)

**Filer i kontaktformularen.** "Få en pris" kan nu tage tegninger, udbudsmateriale og fotos med (op til 10 filer à 50 MB; pdf, dwg, dxf, ifc, rvt, skp, step, zip, billeder, Office, csv, txt). Flowet er to trin i `src/components/ContactForm.tsx`: `action=upload-urls` → browseren lægger filerne direkte i den private Storage-bucket `web-henvendelser` → beskeden sendes med `upload_id` + stier. Mailen til tilbud@/kontakt@ får links (30 dage), og henvendelsen gemmes i `web_henvendelser_2026_10_04`, så filerne kan findes igen, når linkene er udløbet (`files[].path`). Edge-funktionen `contact-form` er **v5 og allerede deployet** — den deles med live-sitet, og det gamle kald uden filer virker uændret. Kildekoden ligger i `supabase/functions/contact-form/index.ts`. Privatlivspolitikkens §2 nævner filerne.

**Rubio Monocoat ved navn.** Forsidens `#overflade` nævner Rubio Monocoat som fast partner (link til rubiomonocoat.dk) med en partner-blok: foto af den blå tekøkkenfront + kort med "Ét lag · Plantebaseret, 0 % VOC · Egne kulører". Aldrig farvekoder eller produktionssted. Produktsidernes spec-label hedder stadig "Hårdvoksolie" (`src/lib/labels.ts`) — ændres kun på Milots ord.

**Test uden mail:** `scratchpad/test_form_ui.py` lader trin 1-2 gå til den rigtige funktion og besvarer trin 3 lokalt med `page.route`, så der aldrig sendes en mail under test. Testfilerne ligger i bucketen under `2026-10/<upload_id>/` og kan slettes i Supabase → Storage.

**Toppen: blå til venstre, rød til højre.** Milot: aldrig to røde skabe ved siden af hinanden. Fordi felterne skifter ét ad gangen, kan farverne ikke veksle *pr. felt* uden at der opstår rød+rød-øjeblikke — derfor er `HERO_L` kun blå rum (liggende) og `HERO_R` kun røde (stående). Så veksler hvert skift mellem blå og rød, og parret er altid blandet. Fotos med røde lockers i baggrunden (21) hører ikke til venstre. Samme par (22 + 26) på EN-forsiden.

**Overfladen (v2, mørk).** Sektionen er nu `sec-dark`: to kulørfotos (35 rød, 36 blå), Rubios to trin med links til produkterne (`rubiomonocoat.dk/products/precolour`, `/products/oil-plus-2c`), partnerlinje med Rubio Monocoat (rubiomonocoat.com) og Rubio Monocoat Denmark (rubiomonocoat.dk), og en kulørstribe fra `v_web_colors` (7 standardkulører inkl. Skovgrøn; Rødbrun og Blå mærket Mørkhøj) + link til Rubios farvekort (`/pages/colour`). Lint-reglen "Rubio-produktnavn kun i overflade-guiden" (Joachim 02-10) advarer nu på forsiden og Mørkhøj — den skal udvides eller accepteres.

**Partnere på projektsiden.** Ny kolonne `case_web_2026_06_11.web_partners` (jsonb: `title`, `text`, `list[{name,url,role}]`), eksponeret i `v_web_cases` og rendret som `.cd-partner` efter brødteksten. Mørkhøj er udfyldt ("Samarbejde om overfladen" — Rubio Monocoat + Rubio Monocoat Denmark). Det gamle site ignorerer kolonnen, så blokken er usynlig indtil merge. Andre sager: NULL = ingen blok.

**Katalog-filtrene virkede ikke.** Scriptet satte `hidden` på kortene, men `.tcard{display:flex}` overtrumfede attributten, så intet forsvandt (samme for "Vis alle"-rækken). Rettet med `.tcard[hidden]{display:none!important}` + `.showmore-row[hidden]`. Test: `scratchpad/test_filter.py` — hver familie viser præcis sine kort (7/4/3/2/1/5 af 22), "Alle" viser 9, "Vis alle" viser 22 og skjuler sig selv.

**Overfladens blå foto.** 36 (tekøkkenet) viste bordpladen i en anden farve — nu 27 (det blå højskab), beskåret med `--zoom`/`--origin` på billedet, så gardinet og bænken ryger ud. "Fyrre hos Rubio" læstes som træsorten → "hele Rubios farvekort bagved — eller jeres egen".

**Overfladen v3 (lys, efter Opus-plan — `scratchpad/overfladen-plan.md`, Milot 04-10).** Milot: partnerskabet skal stå klart øverst, ikke mørkt, Rubios kulører (grøn) som grafik, mindre småtekst, direkte om Rubio-behandlingen ("holder sig pæne længst"), større fotos, Rubios videoer. Opbygning: (A) overskrift "Olieret med *Rubio Monocoat*." + én lede med påstanden og begrundelsen; til højre et Skovgrønt samarbejdskort med lockup "Nem Inventar × Rubio Monocoat" (kun typografi — vi har ikke Rubios logo), faktalinje om de to Mørkhøj-kulører og link til Rubio Monocoat Denmark. (B) To store fotos 4:5 (35 rød, 27 blå) med billedtekst under. (C) "Behandlet i *to* trin": to kort med hver sin video øverst — `YouTubeFacade.astro` ("klik for at afspille": intet hentes fra YouTube før klik, så cookiepolitikken holder; plakaten er en kulørflade, ikke YouTubes miniature) — Precolor Easy `IJjFtMQniR0` og Oil Plus 2C på skabe `rWPvOH_5b6g` (begge Rubio Monocoat USA, brugt på service.rubiomonocoat.com), tekst + produktlink, samtykkelinje, tre punkter (Pletreparation · 0 % VOC · Samme kulør igen). (D) Kulørbåndet: syv felter uden mellemrum fra `v_web_colors` i fast rækkefølge Natur · Røget eg · Rødbrun · Skovgrøn · Blå · Charcoal · Sort (grøn i midten), Mørkhøj-mærke på rød/blå, link til Rubios farvekort; på telefon syv vandrette striber. Cookiepolitikken har fået et punkt om YouTube-videoer. Intet om lak længere.

**Autoplay (Milot 04-10, senere samme dag).** Milot vil have videoerne til at spille af sig selv uden lyd — helst dem øverst på Rubios produktside. YouTube-autoplay er fravalgt (henter Google ved sidevisning → cookie-linjen holder ikke). I stedet: Rubios galleri-video fra `rubiomonocoat.dk/products/oil-plus-2c` (Shopify-mp4, olie hældes på egeplade og poleres ind, 10 s, 1000×1000) er omkodet til `public/video/rubio-oil-plus-2c.mp4` (800 px, H.264, uden lyd, 1,3 MB) + plakat og vises i trin 02 som `muted loop playsinline data-inview` (spiller kun i synsfeltet). **Rubio har ingen Precolor-film som videofil** (kun YouTube), så trin 01 beholder klik-for-at-afspille med foto 29 som plakat. ⛔ **Klippet er Rubios ophavsret — Rubio Monocoat Denmarks skriftlige ok skal ligge, før grenen merges.** Kilde-URL'er og de øvrige klip (værksted 0ac6, bordplade 33a4 — begge Oil Plus 2C) ligger i session-scratchpad `rubio_videos/`; menu-/inspirationsklippene er irrelevante (DuroGrit, udendørs, andres reels). Testet: spiller på PC og telefon, 0 kald til YouTube før klik.

**Kulørbåndet som træprøver (Milot 04-10).** De syv felter viser nu træ i stedet for flader, samme båndstørrelse: fem er Rubio Monocoats egne prøver på ask fra `rubiomonocoat.dk/pages/colour` (Pure → Natur, Cocoa → Røget eg, Fern → Skovgrøn, Charcoal, Black → Sort — kræver Rubios ok, samme ask som videoen), to er udsnit af vores egne låger på Mørkhøj (rødbrun = foto 35, blå = foto 27, højre låge), fordi de kulører er blandet til os og ikke findes i Rubios kort. Filer: `public/billeder/kuloerer/<slug>.jpg` (700 px); scriptet `make_swatches.py` i session-scratchpad. Rubios farvekort har 41 kulører i det nye navnesystem (Affogato, Cortado, Fern, Midnight Sky …) — "omkring 40" i teksten passer.

**Forhåndsvisning på telefon.** En tunnel til den lokale preview blev afvist af sikkerhedsklassifikatoren (ekstern adgang til maskinen), så forhåndsvisningen er pakket som en **privat Claude-artifact**: https://claude.ai/artifact/TmkhaHtA9PeY9zqGRreE9k — forside, kontakt, Projekter, alle seks projektsider og Om os som flade filer med relative stier, Supabase-renders hentet lokalt (viseren blokerer billeder fra andre værter), øvrige interne links peger på `#`. Scriptet `build_preview.py` (session-scratchpad) pakker fra `dist/` til `99. Hjemmesider/_preview-artifact/` (kort sti — Windows' 260-tegns-grænse) og omdøber `_astro` → `astro` (tjenesten reserverer navne med `_`). Genudgiv ved at køre scriptet og publicere samme `index.html` igen. Kontaktformularen virker ikke derfra (CORS) — med vilje.

**Om os v3 (Milot 04-10, plan: Opus).** Milot: "jeg kan ikke lide, at videoerne kommer op øverst — tænk siden om; mere om egenproduktionen og hvad den betyder for kunden i samarbejdet." Ny side: (1) tekst-først top — "Vi tegner det. Vi bygger det *selv*." + lede + to knapper + "kæden" (Hos os selv: 3D-model → Værkstedstegning → Opskæring → Samling → Overfladebehandling → Pakning), intet der bevæger sig; (2) ét stillfoto (33) med billedtekst; (3) tidslinjen `#samarbejdet` "Hvad det betyder for *jer*." — fem faser (før tilbud · under tegning · under produktion · ved levering · efter aflevering) hver med et "Det kan I"-kort (frie mål, kulør, sene ændringer + prøveemne, delleverancer, reservedele); (4) mørkt afsnit "Fra skærm til *byggeplads*." med ProcessSteps (videoerne spiller først her); (5) holdet "Én kontakt hele *vejen*."; (6) Ticker + "Dem, vi har bygget *med*." med tekst + ProjectCard for Mørkhøj; ContactCta. Meta-beskrivelse ny. Lint 0 fund; ingen stednavne. Scroll-"fejlen" (landede et stykke nede) var artifact-rammen, ikke sitet — målt scroll 0 på det rigtige site.

**Projekter som egen side (Milot 04-10, plan: Opus).** `/projekter` i topbjælken (før: ankeret `#projekter`): sidehoved "Fra en hel skole til 43 *skohylder*.", Ticker, alle seks ProjectCards, afsnit `#bygget-med` "Dem, vi har bygget *med*." med én række pr. firma — navn (Archivo), domæne-link ↗, én saglig linje (map `FIRM` i siden, til der er et felt i data), chips "Rolle · Sag →" til projektsiderne — først arkitekter, så entreprenører; skjulte navne samles i rækken "Uden navn — navnet følger efter aftale" med chips pr. sag; sager uden entreprenør får linjen "På … er aftalen direkte med bygherren" (fra data). Ingen logoer. **Data:** `case_web.contractor_url` / `architect_url` (nye kolonner, i `v_web_cases` kun når show-flaget er sat) + `has_contractor`/`has_architect`; `partnersOf()` i `catalog.ts` grupperer. Rettet i data: Vinge → Kanneworff & Viuff er *arkitekt* (var entreprenør), Hou → arkitekt TRANSFORM (skjult). **Navne:** Milot 04-10 (senere samme dag): *alle* entreprenør- og arkitektnavne må bruges overalt på sitet → `show_customer_name` og `show_architect_name` = true på alle offentlige sager, `public_title` "Sundby Idrætspark" (tekster rettet med), TRANSFORM har fået link (transform.dk). Båndet øverst på `/projekter` viser nu firmaerne (navn · rolle · sager) i stedet for leverancetallene. OBS: flagene læses også af det gamle live-site, så navnene står på de gamle projektkort efter næste deploy. `scripts/lint-web-copy.py` havde FEJL-regler for `\bJSP\b` og `\bSundby\b` (stopper deploy) — fjernet 04-10 på både `forside-v2` og `main` (cherry-pick), ellers var nattens deploy gået rødt. Alle gamle `#projekter`-links (nav, footer, 404, EN, landings-, produkt- og projektsider, JSON-LD) peger nu på `/projekter`; forsidens "Flere projekter" viser tre compact-kort + "Alle projekter, arkitekter og entreprenører →".

**Om os-tidslinjen v2 (Milot 04-10).** Overskrift i stor skrift "Vi har vores egen *produktion*." + lede ("Vi skærer, samler, olierer og pakker inventaret selv. Vi bestiller det ikke hos andre…"). Fem faser med ny tekst; "Sene ændringer" er ude (et låst design er en styrke: godkendt i 3D, set i rummet, prøveemne — så bygges det præcis sådan); nyt kort "Se det i rummet" med **Apple Vision Pro** (skrevet uden "2" — ingen officiel model hedder sådan; ret, hvis Milot insisterer). Fotobåndet lavere (21:8, max 380 px). Referencer-H2 "Et helt byggeri eller en enkelt *bænk*." med link til `/projekter`. Meta description uden "sene ændringer".

**Dalux og iBinder.** Tre steder med links: forsidens `#cert` ("Digitalt fra udbud til aflevering" + chips Dalux · iBinder · IFC-modeller), To veje spor 2 trin 1, kontaktsidens trin 1 — og én sætning på EN-forsiden. Adresser: `dalux.com/da/`, `ibinder.com/da/` (EN: `dalux.com/`, `ibinder.com/en/`).
