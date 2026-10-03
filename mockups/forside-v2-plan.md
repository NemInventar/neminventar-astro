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
