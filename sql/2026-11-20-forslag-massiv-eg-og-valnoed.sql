-- FORSLAG, IKKE KØRT: massiv eg og valnød på neminventar.dk (Milot 20-11-2026, branch seo-massiv-eg).
-- Teksterne skal godkendes af Milot, før filen køres. Kør den først, når PR'en er merget: billederne
-- (/billeder/designer-eksempler/*massiv*.jpg) og eksemplerne i designer-eksempler.json kommer med PR'en.
-- Kørt = udgivet ved nattens build (is_web_published = true). Bagefter: tjek-SQL'en i skill seo
-- (references/sider-og-medier.md §1 trin 5), lint-web-copy.py, IndexNow og dagbogsrækker (skill seo).
-- Priserne i kr. er regnet i designerens prismotor 20-11-2026 (api.neminventar.dk/pris). Bænkene med hynde regnet om
-- efter ni-apps #387 (hynden i pristrappen): 7.875 → 8.450, 8.575 → 9.200, 9.950 → 10.575, 11.825 → 12.400. Massivt træ har ingen pris
-- i prisgitteret endnu ("pris følger"): når det får en, skal sætningerne "Prisen på massivt træ regner vi …" rettes
-- og priser på massiv eg og valnød skrives ind med link til præcis det design.

BEGIN;

-- 1-2. To nye sider
INSERT INTO landing_web_2026_09_24 (slug, kind, nav_label, kicker, h1, lead, body, highlights, faq, keywords, case_slugs, product_slugs,
  related_slugs, images, designer_eksempler, seo_title, seo_description, is_web_published, web_display_order) VALUES (
  $t$massiv-eg-og-valnoed$t$, $t$emne$t$, $t$Massiv eg og valnød$t$, $t$Massivt træ$t$,
  $t$Møbler i massiv eg og valnød efter mål$t$,
  $t$Bænke, garderobeskabe og skabsvægge i massiv eg eller massiv valnød, bygget efter dine mål i vores egenproduktion. Træet går hele vejen igennem, og skufferne er fingertappede, så samlingerne ses.$t$,
  $b$Massivt træ er træ hele vejen igennem. Det, du ser på fronten, er det samme træ, som sidder i kanten og i skuffen, og det er åretegningen, du mærker, når hånden glider hen over en kant. Vi bygger bænke, garderobeskabe og skabsvægge i massiv eg og massiv valnød efter dine mål, og du tegner møblet i [vores 3D-designer](https://designer.neminventar.dk/designer?p=baenk&bredde=120&materiale=egmassiv&skuffer=2&hynde=1).

## Massiv eg eller massiv valnød

Eg er lys og har en tydelig åretegning. Massiv eg olieres klart, så træets egen farve står frem, eller i en af vores syv farver fra hvid til næsten sort. Farven ser du på møblet i designeren, før du sender det.

Valnød er mørk og varm i tonen, med en åre, der skifter mellem lyse og mørke partier. Den olieres altid klart, for det er træets egen farve, man vælger valnød for.

## Fingertappede skuffer

I massivt træ er skufferne samlet med fingertappe. Kanterne er skåret i tappe, der griber ind i hinanden, og samlingen ses som et mønster op ad frontens kanter. Det er samlingen, der viser, at skuffen er træ hele vejen igennem.

På bænken sidder skufferne plant i rammen. På et garderobeskab i massivt træ er skufferne under bøjlestangen også fingertappede.

## Bænk i massiv eg eller valnød

Bænken kan være 40 til 160 cm bred og 30 til 60 cm dyb, og sædet sidder 42 cm over gulvet. Under sædet vælger du op til tre skuffer side om side eller en åben skohylde i to etager. I massivt træ går top og bund hen over siderne, så sædet hviler direkte på dem. Læs mere om [bænk i egetræ](/baenk-i-egetrae).

## Garderobeskab og skabsvæg i massivt træ

Garderobeskabene bygges som vores andre [garderobeskabe](/garderobeskab): skab ved siden af skab, hvert med sin egen bredde, og med hylder, bøjlestang eller skuffer indeni. Lågerne kan sidde udenpå, eller de kan sidde plant i skabet, så rammen af massivt træ ses rundt om lågen. Et skab kan også stå åbent med hylderne helt frem, og så er det en [reol i massiv eg](https://designer.neminventar.dk/designer?p=hoejskab&antal=2&bredde=80&materiale=egmassiv&type=aaben&indretning=hylder&hylder=5).

## Massivt træ eller finér

Finér er et tyndt lag ægte træ på en plade af MDF, og i egetræsfinér er det laget af eg, du ser på lågerne. I massivt træ er det eg eller valnød hele vejen igennem, også i kanter og skuffer, og en flade, der er blevet slidt, kan slibes og olieres op igen.

Vil du have egens overflade til en lavere pris, er egetræsfinér vejen. Læs mere om pladerne i [krydsfiner, MDF eller spånplade](/krydsfiner-mdf-eller-spaanplade).

| I egetræsfinér | Pris inkl. moms |
|---|---|
| Garderobeskab, 60 cm bredt og 210 cm højt | [11.250 kr.](https://designer.neminventar.dk/designer?p=hoejskab&t=e30) |
| Bænk, 100 cm bred, to skuffer og hynde | [8.450 kr.](https://designer.neminventar.dk/designer?p=baenk&t=e30) |

Priserne er for møbler leveret fladpakket og uden levering. Prisen på massiv eg og valnød regner vi, når du sender designet til os, og den kommer sammen med tegningen.

## Til byggeri

Massivt træ bruger vi også i fast inventar, hvor der er slid. Til omklædningen i [Sundby Idrætspark](/projekter/idraetspark-koebenhavn) bygger vi bænke i massiv fyr. Skal I bruge inventar i massiv eg til et byggeri, så [send tegninger og beskrivelse](/kontakt?emne=Massivt%20tr%C3%A6).

## Fra design til møbel

Når du sender møblet fra designeren, er det en forespørgsel, ikke en ordre. Vi regner prisen og sender et tilbud og en tegning med de endelige mål, og du godkender tegningen, før vi går i produktion. Leveringstiden står i tilbuddet, og vi leverer i hele Danmark. Kan designeren ikke det, du ønsker, så [send os en skitse](/kontakt?emne=Massivt%20tr%C3%A6) med mål.$b$,
  $j$[{"k": "Træsorter", "v": "Massiv eg og massiv valnød"}, {"k": "Olie", "v": "Eg klar eller i syv farver, valnød klar"}, {"k": "Skuffer", "v": "Fingertappede i massivt træ"}, {"k": "Møbler", "v": "Bænke, garderobeskabe og skabsvægge"}, {"k": "Pris", "v": "Regnet ud fra dit design, med tegningen"}, {"k": "Levering", "v": "I hele Danmark"}]$j$::jsonb,
  $j$[{"q": "Hvad er forskellen på massiv eg og egetræsfinér?", "a": "Egetræsfinér er et tyndt lag ægte eg på en plade af MDF. Massiv eg er eg hele vejen igennem, også i kanter og skuffer, og en slidt flade kan slibes og olieres op igen. Et garderobeskab i egetræsfinér, 60 cm bredt og 210 cm højt, koster [11.250 kr.](https://designer.neminventar.dk/designer?p=hoejskab&t=e30) inkl. moms. Prisen på massiv eg regner vi ud fra dit design."}, {"q": "Hvilken træsort er valnød?", "a": "Valnød er et løvtræ med et mørkt, brunt kernetræ og en åre, der skifter mellem lyse og mørke partier. Vi olierer valnød klart, så træets egen farve står frem."}, {"q": "Kan massiv eg olieres i en farve?", "a": "Ja. Massiv eg olieres klart eller i en af vores syv farver, og du ser farven på møblet i designeren. Massiv valnød olieres klart."}, {"q": "Hvad koster møbler i massiv eg?", "a": "Prisen regner vi, når du sender møblet fra [designeren](https://designer.neminventar.dk/designer?p=hoejskab&antal=3&bredde=60&hoejde=210&materiale=egmassiv&indretning=garderobe_skuffer), og den kommer sammen med tegningen. Massivt træ koster mere end finér. Til sammenligning koster en bænk i egetræsfinér, 100 cm bred med to skuffer og hynde, [8.450 kr.](https://designer.neminventar.dk/designer?p=baenk&t=e30) inkl. moms."}, {"q": "Hvad er fingertappede skuffer?", "a": "Skuffens hjørner er samlet med tappe, der er skåret i kanterne og griber ind i hinanden. Samlingen ses som et mønster op ad frontens kanter. I bænke og skabe i massivt træ er skufferne altid fingertappede."}]$j$::jsonb,
  ARRAY[$t$massiv eg$t$, $t$massivt egetræ$t$, $t$møbler i massiv eg$t$, $t$egetræsmøbler$t$, $t$massiv valnød$t$, $t$valnød møbler$t$, $t$møbler i valnød$t$, $t$garderobeskab massivt træ$t$, $t$fingertappede skuffer$t$, $t$massivt træ eller finér$t$]::text[], ARRAY[$t$idraetspark-koebenhavn$t$]::text[], '{}'::text[],
  ARRAY[$t$garderobeskab$t$, $t$baenk-i-egetrae$t$, $t$opbevaringsbaenk$t$, $t$skohylde-og-skoreol$t$, $t$krydsfiner-mdf-eller-spaanplade$t$]::text[],
  $j$[{"src": "/billeder/designer-eksempler/skabsvaeg-massiv-eg.jpg", "alt": "Tre garderobeskabe i massiv eg med indeliggende låger, det midterste åbent med bøjlestang og to fingertappede skuffer", "kind": "visualisering", "caption": "Garderobeskabe i massiv eg, fra designeren"}, {"src": "/billeder/designer-eksempler/baenk-massiv-valnoed.jpg", "alt": "Bænk i massiv valnød med to fingertappede skuffer under sædet", "kind": "visualisering", "caption": "Bænk i massiv valnød, fra designeren"}, {"src": "/billeder/designer-eksempler/baenk-massiv-eg.jpg", "alt": "Bænk i massiv eg med to fingertappede skuffer og hynde i gråt møbelstof", "kind": "visualisering", "caption": "Bænk i massiv eg, fra designeren"}, {"src": "/billeder/designer-eksempler/garderobeskab-massiv-valnoed.jpg", "alt": "To garderobeskabe i massiv valnød uden greb", "kind": "visualisering", "caption": "Garderobeskab i massiv valnød, fra designeren"}]$j$::jsonb,
  ARRAY[$t$skabsvaeg-massiv-eg$t$, $t$baenk-massiv-eg$t$, $t$baenk-massiv-valnoed$t$, $t$garderobeskab-massiv-valnoed$t$]::text[],
  $t$Møbler i massivt egetræ og valnød efter mål | Nem Inventar$t$,
  $t$Bænke og garderobeskabe i massiv eg og valnød efter dine mål, med fingertappede skuffer. Byg møblet i vores 3D-designer, og få tilbud og tegning.$t$,
  true, 64);

INSERT INTO landing_web_2026_09_24 (slug, kind, nav_label, kicker, h1, lead, body, highlights, faq, keywords, case_slugs, product_slugs,
  related_slugs, images, designer_eksempler, seo_title, seo_description, is_web_published, web_display_order) VALUES (
  $t$baenk-i-egetrae$t$, $t$emne$t$, $t$Bænk i egetræ$t$, $t$Bænke på mål$t$,
  $t$Bænk i egetræ efter mål, i massiv eg eller egetræsfinér$t$,
  $t$En bænk til entréen i massiv eg med fingertappede skuffer, i massiv valnød eller i egetræsfinér. I egetræsfinér koster en bænk på 100 cm med to skuffer og hynde 8.450 kr. inkl. moms, og du vælger bredde, skuffer eller skohylde og hynde i vores 3D-designer.$t$,
  $b$En bænk i entréen er et sted at sidde, når skoene skal på, og et sted at gøre af dem, når du kommer hjem. I egetræ er den også et møbel, du ser på hver dag. Du bygger bænken i [designeren](https://designer.neminventar.dk/designer?p=baenk&bredde=120&materiale=egmassiv&skuffer=2&hynde=1) og vælger mål, træ og det, der skal være under sædet.

## Massiv eg eller egetræsfinér

I massiv eg er bænken eg hele vejen igennem. Top og bund går hen over siderne, så sædet hviler direkte på dem, og skufferne sidder plant i rammen. Skufferne er fingertappede, så tappene ses op ad frontens kanter. Massiv eg olieres klart eller i en af vores syv farver, og bænken kan også bygges i massiv valnød, som er mørkere og olieres klart.

Egetræsfinér er et tyndt lag ægte eg på en plade af MDF. Overfladen er den samme træsort, og bænken koster mindre. Prisen på massiv eg og valnød regner vi, når du sender bænken til os, og den kommer sammen med tegningen. Bænken i egetræsfinér har sin pris i designeren:

| Bænk i egetræsfinér med hynde | Under sædet | Pris inkl. moms |
|---|---|---|
| 100 cm bred, 40 cm dyb | 2 skuffer | [8.450 kr.](https://designer.neminventar.dk/designer?p=baenk&t=e30) |
| 100 cm bred, 50 cm dyb | 2 skuffer | [9.200 kr.](https://designer.neminventar.dk/designer?p=baenk&t=eyJkIjo1MH0) |
| 120 cm bred, 40 cm dyb | 3 skuffer | [10.575 kr.](https://designer.neminventar.dk/designer?p=baenk&t=eyJiIjoxMjAsImJzayI6M30) |
| 160 cm bred, 40 cm dyb | 3 skuffer | [12.400 kr.](https://designer.neminventar.dk/designer?p=baenk&t=eyJiIjoxNjAsImJzayI6M30) |

Priserne er fladpakket og uden levering.

## Skuffer, skohylde eller hynde

Under sædet vælger du op til tre skuffer side om side eller en åben skohylde i to etager. På skohylden tørrer våde sko i luften, og i skufferne er handsker og huer ude af syne. Flere bænke kan stå side om side under én gennemgående sædeplade, hver med sine egne skuffer eller skohylde.

Sædet sidder 42 cm over gulvet, og hynden gør det 48 cm. Hynden er koldskum i et betræk med lynlås, som kan tages af og renses, og to rækker burrebånd holder den fast på sædet. Uden hynde sidder du direkte på træet, og i massiv valnød kan det være grunden til at vælge hynden fra.

## Bænken i en skabsvæg

Bænken kan også sidde mellem garderobeskabe i en skabsvæg. Så bygger du hele væggen i [designeren til garderobeskabe](https://designer.neminventar.dk/designer?p=hoejskab&antal=3&bredde=60&hoejde=210&materiale=egmassiv&indeliggende=1), hvor et af skabene kan være en bænk, og bænken får væggens dybde og træ. I massivt træ er bænkens skuffer fingertappede, når lågerne i væggen er indeliggende.

## Fra designet til bænken

Når du sender bænken fra designeren, er det en forespørgsel, ikke en ordre. Vi sender et tilbud og en tegning med de endelige mål, og du godkender tegningen, før bænken går i produktion i vores egenproduktion. En bænk i egetræsfinér er leveret 3 til 6 uger efter bestilling, og for massivt træ står leveringstiden i tilbuddet. Vi leverer i hele Danmark.

Skal bænken passe ind i en niche, så skriv målene i beskeden, eller [send os en skitse](/kontakt?emne=B%C3%A6nk). Læs mere om [massiv eg og valnød](/massiv-eg-og-valnoed) og om [skobænke og opbevaringsbænke](/opbevaringsbaenk).$b$,
  $j$[{"k": "Træ", "v": "Massiv eg, massiv valnød eller egetræsfinér"}, {"k": "Mål", "v": "40-160 cm bred, 30-60 cm dyb"}, {"k": "Sæde", "v": "42 cm over gulvet, 48 cm med hynde"}, {"k": "Under sædet", "v": "Op til 3 skuffer eller åben skohylde"}, {"k": "Skuffer i massivt træ", "v": "Fingertappede og plant i rammen"}, {"k": "Egetræsfinér, 100 cm", "v": "8.450 kr. med to skuffer og hynde"}]$j$::jsonb,
  $j$[{"q": "Hvilket træ skal en bænk i entréen være af?", "a": "Eg er et hårdt træ, der tåler at blive siddet på hver dag. I massiv eg er bænken træ hele vejen igennem, og sædet kan slibes og olieres op igen, hvis det bliver slidt. Egetræsfinér har samme overflade til en lavere pris, og massiv valnød er det mørke valg."}, {"q": "Hvad koster en bænk i egetræ?", "a": "En bænk i egetræsfinér, 100 cm bred og 40 cm dyb med to skuffer og hynde, koster [8.450 kr.](https://designer.neminventar.dk/designer?p=baenk&t=e30) inkl. moms, fladpakket og uden levering. Prisen på massiv eg og valnød regner vi, når du sender bænken fra designeren, og den kommer sammen med tegningen."}, {"q": "Hvor høj er en bænk til entréen?", "a": "Sædet er 42 cm over gulvet og 48 cm med hynde. Højden er den samme, uanset om du vælger skuffer eller skohylde."}, {"q": "Kan jeg få en skobænk i eg?", "a": "Ja. Vælg skohylden under sædet i stedet for skuffer, så får du en åben hylde i to etager til sko, i massiv eg eller egetræsfinér. Prøv [skobænken i massiv eg](https://designer.neminventar.dk/designer?p=baenk&bredde=100&materiale=egmassiv&skuffer=0&skohylde=1&hynde=1) i designeren."}, {"q": "Kan bænken olieres i en farve?", "a": "Ja. Massiv eg og egetræsfinér olieres klart eller i en af vores syv farver, og du ser farven på bænken i designeren. Massiv valnød olieres klart."}, {"q": "Hvad er fingertappede skuffer?", "a": "Skuffens hjørner er samlet med tappe, der er skåret i kanterne og griber ind i hinanden. Samlingen ses som et mønster op ad frontens kanter. På bænken i massivt træ er skufferne altid fingertappede."}]$j$::jsonb,
  ARRAY[$t$egetræ bænk$t$, $t$bænk egetræ$t$, $t$bænk i egetræ$t$, $t$bænk i eg$t$, $t$bænk massiv eg$t$, $t$skobænk eg$t$, $t$skobænk egetræ$t$, $t$bænk valnød$t$, $t$bænk med skuffer egetræ$t$, $t$entrébænk i eg$t$]::text[], '{}'::text[], '{}'::text[],
  ARRAY[$t$massiv-eg-og-valnoed$t$, $t$opbevaringsbaenk$t$, $t$skohylde-og-skoreol$t$, $t$garderobeskab$t$]::text[],
  $j$[{"src": "/billeder/designer-eksempler/baenk-massiv-eg.jpg", "alt": "Bænk i massiv eg med to fingertappede skuffer og hynde i gråt møbelstof", "kind": "visualisering", "caption": "Bænk i massiv eg, fra designeren"}, {"src": "/billeder/designer-eksempler/baenk-massiv-valnoed.jpg", "alt": "Bænk i massiv valnød med to fingertappede skuffer og uden hynde", "kind": "visualisering", "caption": "Bænk i massiv valnød, fra designeren"}, {"src": "/billeder/designer-eksempler/baenk-lang-moerk-eg.jpg", "alt": "Lang bænk i egetræsfinér med mørk olie, tre skuffer uden greb og hynde", "kind": "visualisering", "caption": "Bænk i egetræsfinér med mørk olie, fra designeren"}, {"src": "/billeder/designer-eksempler/baenk.jpg", "alt": "Bænk i egetræsfinér med tre skuffer under sædet og hynde i gråt møbelstof", "kind": "visualisering", "caption": "Bænk i egetræsfinér, fra designeren"}]$j$::jsonb,
  ARRAY[$t$baenk-massiv-eg$t$, $t$baenk-massiv-valnoed$t$, $t$baenk$t$, $t$baenk-lang-moerk-eg$t$, $t$entre-med-baenk$t$]::text[],
  $t$Bænk i egetræ på mål: massiv eg eller finér | Nem Inventar$t$,
  $t$Bænk i egetræ til entréen i massiv eg med fingertappede skuffer eller i egetræsfinér: 100 cm med skuffer og hynde til 8.450 kr. inkl. moms.$t$,
  true, 65);

-- 3. /garderobeskab/: afsnit om egetræ (finér eller massiv eg), FAQ, materialer i faktaboksen, søgeord, links, eksempel
UPDATE landing_web_2026_09_24 SET
  body = replace(body, $t$Kompaktlaminat er laminat hele vejen igennem. Det tåler vand og slid og er materialet til et skab på badeværelset eller i et andet fugtigt rum.$t$, $b$Kompaktlaminat er laminat hele vejen igennem. Det tåler vand og slid og er materialet til et skab på badeværelset eller i et andet fugtigt rum.

## Garderobeskab i egetræ: finér eller massiv eg

Et garderobeskab i egetræ kan bygges på to måder. I egetræsfinér er overfladen ægte eg på en plade af MDF, og et skab på 60 cm koster [11.250 kr.](https://designer.neminventar.dk/designer?p=hoejskab&t=e30). I massiv eg er skabet eg hele vejen igennem, også i kanterne, og vælger du skuffer, er de fingertappede, så samlingerne ses på frontens kanter. Skabet kan også bygges i massiv valnød, som er mørkere og olieres klart.

Prisen på massivt træ regner vi, når du sender skabet fra designeren, og den kommer sammen med tegningen. Læs mere om [massiv eg og valnød](/massiv-eg-og-valnoed), eller start fra [tre skabe i massiv eg](https://designer.neminventar.dk/designer?p=hoejskab&antal=3&bredde=60&hoejde=210&materiale=egmassiv&indretning=garderobe_skuffer).$b$),
  faq = faq || jsonb_build_array($j${"q": "Kan jeg få et garderobeskab i massiv eg eller valnød?", "a": "Ja. Garderobeskabe og skabsvægge kan bygges i massiv eg eller massiv valnød, og skufferne i dem er fingertappede. Massiv eg olieres klart eller i en af syv farver, valnød klart. Prisen regner vi, når du sender skabet fra [designeren](https://designer.neminventar.dk/designer?p=hoejskab&antal=3&bredde=60&hoejde=210&materiale=egmassiv&indretning=garderobe_skuffer), og den kommer sammen med tegningen."}$j$::jsonb),
  highlights = (SELECT jsonb_agg(CASE WHEN h->>'k' = 'Materialer' THEN jsonb_build_object('k', 'Materialer', 'v', $t$Melamin, finér, krydsfiner, kompaktlaminat, massiv eg og valnød$t$) ELSE h END ORDER BY n)
                FROM jsonb_array_elements(highlights) WITH ORDINALITY x(h, n)),
  keywords = keywords || ARRAY['garderobeskab egetræ', 'garderobeskab massiv eg', 'garderobeskab massivt træ', 'garderobeskab valnød'],
  related_slugs = related_slugs || ARRAY['massiv-eg-og-valnoed'],
  designer_eksempler = designer_eksempler[1:1] || ARRAY['skabsvaeg-massiv-eg'] || designer_eksempler[2:]
WHERE slug = 'garderobeskab' AND strpos(body, $t$Kompaktlaminat er laminat hele vejen igennem. Det tåler vand og slid og er materialet til et skab på badeværelset eller i et andet fugtigt rum.$t$) > 0 AND NOT 'massiv-eg-og-valnoed' = ANY(related_slugs);

-- 4. /opbevaringsbaenk/: afsnit om massiv eg og valnød under Materialet, FAQ, links, eksempel
UPDATE landing_web_2026_09_24 SET
  body = replace(body, $t$det kan være værd at overveje i en entré, hvor der kommer våde støvler ind.$t$, $b$det kan være værd at overveje i en entré, hvor der kommer våde støvler ind.

Bænken kan også bygges i massiv eg eller massiv valnød. Så er den træ hele vejen igennem, og skufferne er fingertappede og sidder plant i rammen, så samlingerne ses på frontens kanter. Prisen på massivt træ regner vi, når du sender bænken fra designeren. Læs mere om [bænk i egetræ](/baenk-i-egetrae).$b$),
  faq = faq || jsonb_build_array($j${"q": "Kan jeg få bænken i massivt egetræ?", "a": "Ja. Bænken kan bygges i massiv eg eller massiv valnød med fingertappede skuffer, og massiv eg kan olieres i farve. Prisen regner vi, når du sender bænken fra [designeren](https://designer.neminventar.dk/designer?p=baenk&bredde=120&materiale=egmassiv&skuffer=2&hynde=1). Se også [bænk i egetræ](/baenk-i-egetrae)."}$j$::jsonb),
  related_slugs = related_slugs || ARRAY['baenk-i-egetrae', 'massiv-eg-og-valnoed'],
  designer_eksempler = designer_eksempler[1:2] || ARRAY['baenk-massiv-eg'] || designer_eksempler[3:]
WHERE slug = 'opbevaringsbaenk' AND strpos(body, $t$det kan være værd at overveje i en entré, hvor der kommer våde støvler ind.$t$) > 0 AND NOT 'baenk-i-egetrae' = ANY(related_slugs);

-- 5. /skohylde-og-skoreol/: skoreol og skobænk i massivt træ, søgeord, links
UPDATE landing_web_2026_09_24 SET
  body = replace(body, $t$Hvid melamin er også en mulighed. Eksemplerne herunder har priserne.$t$, $b$Hvid melamin er også en mulighed, og både skobænken og skabene kan bygges i massiv eg eller massiv valnød, træ hele vejen igennem. Læs mere om [massiv eg og valnød](/massiv-eg-og-valnoed). Eksemplerne herunder har priserne.$b$),
  keywords = keywords || ARRAY['skoreol eg', 'skoreol egetræ', 'skohylde egetræ'],
  related_slugs = related_slugs || ARRAY['baenk-i-egetrae', 'massiv-eg-og-valnoed']
WHERE slug = 'skohylde-og-skoreol' AND strpos(body, $t$Hvid melamin er også en mulighed. Eksemplerne herunder har priserne.$t$) > 0 AND NOT 'baenk-i-egetrae' = ANY(related_slugs);

-- 6. Fokusord til den månedlige måling (skill seo, references/maaling.md §2). Volumen: fn_dfs_volumen 20-11-2026.
--    Startplacering: ingen af ordene i Google top 50 (fn_dfs_serp 20-11-2026); Search Console 90 dage i noten.
INSERT INTO seo_fokusord_2026_10_02 (soegeord, klynge, maalside, soegninger_pr_md, placering_start, prioritet, kanaler, aktiv, note) VALUES
  ('egetræ bænk', '11 massivt træ', '/baenk-i-egetrae/', 590, NULL, 1, ARRAY['google','gbp'], true, 'Milot 20-11-2026. Også bænk egetræ / bænk i egetræ (samme volumen). Google: snedkere med bænke i massivt egetræ. Search Console: ingen visninger.'),
  ('skobænk eg', '11 massivt træ', '/baenk-i-egetrae/', 170, NULL, 2, ARRAY['google','gbp'], true, 'Milot 20-11-2026. Google: webshops med sort eg/sonoma-eg. Search Console: 2-3 visninger, plads 8-18 (opbevaringsbaenk).'),
  ('massivt egetræ', '11 massivt træ', '/massiv-eg-og-valnoed/', 110, NULL, 1, ARRAY['google','gbp'], true, 'Milot 20-11-2026. Også massiv eg (90). Google: dba, pladesalg og møbelbutikker.'),
  ('valnød møbler', '11 massivt træ', '/massiv-eg-og-valnoed/', 90, NULL, 2, ARRAY['google','gbp'], true, 'Milot 20-11-2026. Google: snedkere og designmøbler. valnød/valnødtræ alene er have og nødder, ikke møbler.'),
  ('garderobeskab egetræ', '11 massivt træ', '/garderobeskab/', 110, NULL, 1, ARRAY['google','gbp'], true, 'Milot 20-11-2026. Search Console 90 dage: 4 visninger, plads 20,5. Google: snedkere og webshops.'),
  ('fingertappede skuffer', '11 massivt træ', '/massiv-eg-og-valnoed/', 110, NULL, 3, ARRAY['google'], true, 'Milot 20-11-2026. Klikpris 2,73 USD. Google: snedkerkøkkener.'),
  ('skoreol egetræ', '11 massivt træ', '/skohylde-og-skoreol/', 390, NULL, 2, ARRAY['google','gbp'], true, 'Milot 20-11-2026. Også skoreol eg (390).');

COMMIT;

-- Udgives intet alligevel: UPDATE landing_web_2026_09_24 SET is_web_published = false WHERE slug IN ('massiv-eg-og-valnoed', 'baenk-i-egetrae');
