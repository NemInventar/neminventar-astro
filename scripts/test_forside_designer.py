"""Bevis for forsidens 3D med designerens indlejring (indlejr.v1.js).
  python scripts/test_forside_designer.py                 (lokal dist)
  python scripts/test_forside_designer.py https://neminventar.dk/
  … --indlejr=<sti til indlejr.v1.js>    en lokal bundle i stedet for den udgivne (ni-apps dist/offentlig/public/)
  … --uden-fremvisning                   den udgivne indlejring kan ikke fremvise endnu: de tjek springes over
Tjekker: indlejringen indlæses (lærred i #hpCanvas), læsefeltet får designerens spec, kulør og antal ændrer permalinket,
produktskift giver en ny indlejring, "Hent IFC" har &hent=ifc — og uden WebGL bliver stillbilledet stående.
Fremvisningen og teksten på 3D'en (23-10-2026): teksten vises på 3D'en og peger på designeren med det, man ser; på computer
skifter indretningen af sig selv og stopper ved et tryk på 3D'en eller en knap; lockers og akustik har deres egen første gang, man
skifter fane (25-10-2026), og højskabet ikke igen; ingen fremvisning på
telefon eller med reduceret bevægelse; på telefon står teksten ikke oven i knappen "Se den i et rum"."""
import base64, json, subprocess, sys, tempfile, time
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
DIST = Path(__file__).resolve().parent.parent / "dist"
FLAG = [a for a in sys.argv[1:] if a.startswith("--")]
POS = [a for a in sys.argv[1:] if not a.startswith("--")]
INDLEJR_FIL = next((a.split("=", 1)[1] for a in FLAG if a.startswith("--indlejr=")), None)
FREMVIS = "--uden-fremvisning" not in FLAG
REMOTE = POS[0].rstrip("/") + "/" if POS else None
srv = None if REMOTE else subprocess.Popen([sys.executable, "-m", "http.server", "8775", "--bind", "127.0.0.1", "-d", str(DIST)],
                                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0 if REMOTE else 1.2)
URL = REMOTE or "http://127.0.0.1:8775/"
ok = fejl = 0


def tjek(navn, c, info=""):
    global ok, fejl
    if c:
        ok += 1; print("ok  ", navn)
    else:
        fejl += 1; print("FEJL", navn, info)


def tilstand(href):
    t = parse_qs(urlparse(href).query).get("t", [""])[0]
    return json.loads(base64.urlsafe_b64decode(t + "=" * (-len(t) % 4)).decode()) if t else {}


def ny_side(ctx):
    """En side, der henter den lokale indlejring (--indlejr), når den er givet. Formularen sendes aldrig."""
    s = ctx.new_page()
    if INDLEJR_FIL:
        s.route("**/indlejr.v1.js*", lambda r: r.fulfill(path=INDLEJR_FIL, content_type="text/javascript", headers={"access-control-allow-origin": "*"}))
    s.route("**/contact-form", lambda r: r.abort())
    return s


def href(s):
    return s.locator("#hpDesigner").get_attribute("href")


def vent_paa_skift(s, fra, maks_ms):
    """Venter, til permalinket ikke længere er `fra` (fremvisningen har ændret noget) — True, hvis det sker inden maks_ms."""
    slut = time.time() + maks_ms / 1000
    while time.time() < slut:
        if href(s) != fra:
            return True
        s.wait_for_timeout(200)
    return False


def staar_stille(s, ms):
    """Permalinket ændrer sig ikke i ms millisekunder (ingen fremvisning)."""
    fra = href(s)
    return not vent_paa_skift(s, fra, ms)


# Milots link 23-10-2026 (rumbilledets skabsvæg): fremvisningen bygger den ud fra computerens start
LINK = {"n": 6, "h": 200, "mat": "eg", "indl": 1, "eg": "dark-roast",
        "m": [{"i": 2, "t": "aaben", "inde": "garderobe_skuffer"}, {"i": 3, "t": "baenk", "bsk": 1, "ob": 0},
              {"i": 4, "t": "baenk", "bsk": 1, "ob": 0}, {"i": 5, "t": "baenk", "bsk": 1, "ob": 0}]}


def som_linket(st, med_m=True):
    """Væggen som linket (antal, højde, egefinér, indeliggende, Dark Roast) — og med med_m også skabene for sig."""
    ok_vaeg = (st.get("n"), st.get("h"), st.get("mat"), st.get("indl"), (st.get("farve") or {}).get("eg")) == (LINK["n"], LINK["h"], LINK["mat"], LINK["indl"], LINK["eg"])
    return ok_vaeg and (not med_m or st.get("m") == LINK["m"])


def vent_paa(s, betingelse, maks_ms):
    slut = time.time() + maks_ms / 1000
    while time.time() < slut:
        if betingelse():
            return True
        s.wait_for_timeout(200)
    return False


def overlapper(a, b):
    return a and b and a["x"] < b["x"] + b["width"] and b["x"] < a["x"] + a["width"] and a["y"] < b["y"] + b["height"] and b["y"] < a["y"] + a["height"]


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = ny_side(b.new_context(viewport={"width": 1440, "height": 900}))
        jsfejl = []
        pg.on("pageerror", lambda e: jsfejl.append(str(e)))
        pg.goto(URL, wait_until="load")
        try:
            pg.wait_for_selector("#hpStage.is-3d", timeout=20000)
            tjek("indlejringen er indlæst (is-3d)", True)
        except Exception as e:
            tjek("indlejringen er indlæst (is-3d)", False, str(e)[:120])
        tjek("lærred i #hpCanvas", pg.locator("#hpCanvas canvas").count() >= 1)
        # computer (19-10-2026): starter på højskab som telefonen
        tjek("computer: starter på højskab", pg.locator('#hpStage[data-produkt="hoejskab"]').count() == 1
             and pg.locator('#hpProd button[data-k="hoejskab"]').get_attribute("aria-pressed") == "true")
        tjek("computer: permalink med p=hoejskab", "p=hoejskab" in pg.locator("#hpDesigner").get_attribute("href"))
        tjek("computer: læsefeltet viser højskabe", "skab" in pg.locator("#hpSpec").inner_text().lower(), pg.locator("#hpSpec").inner_text())
        # teksten på 3D'en (23-10-2026): synlig, siger designeren og peger på det samme som "Byg selv i designeren"
        ret = pg.locator("#hpRet")
        tjek("teksten på 3D'en vises", ret.is_visible() and "i designeren" in ret.inner_text(), ret.inner_text() if ret.count() else "")
        tjek("teksten siger skabene", "ændre skabene" in ret.inner_text(), ret.inner_text())
        # computerens start (Milot 23-10-2026: "start med det simple skab på 4 moduler"): 4 blå skabe i krydsfiner, 210 cm
        st0 = tilstand(href(pg))
        tjek("computer: 3D'en starter i de 4 blå skabe (krydsfiner, 210 cm)", (st0.get("n"), st0.get("h"), st0.get("mat"), (st0.get("farve") or {}).get("kryds")) == (4, 210, "kryds", "blaa"), st0)
        trykket = [b.get_attribute("data-slug") for b in pg.locator("#hpSw button[aria-pressed='true']").all()]
        tjek("computer: kuløren Blå er valgt", trykket == ["blaa"], trykket)
        tjek("computer: 4 skabe og 210 trykket ind", pg.locator('.hp-steps[data-for="hoejskab"] output').inner_text() == "4"
             and pg.locator("#hpH button[aria-pressed='true']").get_attribute("data-h") == "2.1")
        tjek("computer: stillbilledet er den blå render", "1791308242382" in (pg.locator("#hpStillImg").get_attribute("src") or ""), pg.locator("#hpStillImg").get_attribute("src"))
        tjek("teksten ligger på 3D'en", overlapper(ret.bounding_box(), pg.locator("#hpStage").bounding_box()))
        if FREMVIS:
            # fremvisningen: indretningen skifter af sig selv (permalinket får skabe for sig, m), og teksten følger med
            h0 = href(pg)
            tjek("fremvisning: indretningen skifter af sig selv", vent_paa_skift(pg, h0, 8000))
            tjek("fremvisning: permalinket har det, man ser (skabe for sig)", "m" in tilstand(href(pg)), tilstand(href(pg)))
            tjek("fremvisning: teksten peger på det samme som knappen", ret.get_attribute("href") == href(pg))
            pg.screenshot(path=str(Path(tempfile.gettempdir()) / "forside-fremvisning.png"))
            # Milot 23-10-2026: "byg skabet i linket ud fra det første design du viser" — runden ender i linket
            # runden ender i linket — og i samme øjeblik viser knapperne under 3D'en det: 6 skabe, Dark Roast, ingen højdeknap
            # (200 cm). Tjekket i ét kald: linket står kun pausen ud (3 s), så starter næste runde forfra.
            knapper = """() => [document.querySelector('.hp-steps[data-for="hoejskab"] output').textContent,
              [...document.querySelectorAll('#hpSw button[aria-pressed="true"]')].map((b) => b.dataset.slug).join(),
              document.querySelectorAll('#hpH button[aria-pressed="true"]').length]"""
            saa = {}
            def linket_og_knapper():
                saa["st"], saa["k"] = tilstand(href(pg)), pg.evaluate(knapper)
                return som_linket(saa["st"]) and saa["k"] == ["6", "dark-roast", 0]
            tjek("fremvisning: runden ender i linkets skabsvæg, og knapperne følger med (6 skabe, Dark Roast, ingen højdeknap)",
                 vent_paa(pg, linket_og_knapper, 25000), saa)
            pg.screenshot(path=str(Path(tempfile.gettempdir()) / "forside-fremvisning-linket.png"))
            # et tryk på 3D'en: fremvisningen stopper (intet skifter mere)
            pg.locator("#hpCanvas canvas").click(position={"x": 60, "y": 60})
            tjek("fremvisning: stopper ved et tryk på 3D'en", staar_stille(pg, 7000))
            # en knap på siden: fremvisningen stopper, og det, man så, bliver stående med den nye kulør
            k = ny_side(pg.context)
            k.on("pageerror", lambda e: jsfejl.append(str(e)))
            k.goto(URL, wait_until="load"); k.wait_for_selector("#hpStage.is-3d", timeout=20000)
            vent_paa_skift(k, href(k), 8000)
            slug0 = k.locator("#hpSw button").nth(0).get_attribute("data-slug")   # rødbrun — ikke den valgte blå
            k.locator("#hpSw button").nth(0).click(); k.wait_for_timeout(400)
            sk = tilstand(href(k))
            tjek("fremvisning: en kulør-knap virker midt i den (den plade, man ser, i den nye kulør)", (sk.get("farve") or {}).get(sk.get("mat")) == slug0 and "m" in sk, sk)
            tjek("fremvisning: stopper ved en knap på siden", staar_stille(k, 7000))
            k.close()
        # resten af lockertjekket: skift til lockers
        pg.locator('#hpProd button[data-k="locker"]').click()
        pg.wait_for_selector("#hpStage.is-3d", timeout=20000); pg.wait_for_timeout(800)
        spec = pg.locator("#hpSpec").inner_text()
        tjek("læsefeltet viser designerens spec", "locker" in spec.lower(), spec)
        tjek("teksten på 3D'en siger lockerne", "ændre lockerne" in pg.locator("#hpRet").inner_text(), pg.locator("#hpRet").inner_text())
        # lockerens egen fremvisning (25-10-2026, Joachim: "alle steder"): første gang man skifter til fanen — et tryk stopper den
        if FREMVIS:
            tjek("lockers: fremvisningen kører første gang, man skifter til fanen", vent_paa_skift(pg, href(pg), 8000), tilstand(href(pg)))
            pg.locator("#hpCanvas canvas").click(position={"x": 60, "y": 60})
            tjek("lockers: fremvisningen stopper ved et tryk på 3D'en", staar_stille(pg, 5000))
        d0 = pg.locator("#hpDesigner").get_attribute("href")
        tjek("Åbn i designeren peger på ni-designer med tilstand", "designer.neminventar.dk" in d0 and "t=" in d0, d0)
        # kulør: anden knap
        pg.locator("#hpSw button").nth(2).click(); pg.wait_for_timeout(500)
        st = tilstand(pg.locator("#hpDesigner").get_attribute("href"))
        slug = pg.locator("#hpSw button").nth(2).get_attribute("data-slug")
        # lågerne i egen farve (fremvisningen kan have nået dem): så er det lågerne, kuløren farver
        tjek(f"kuløren følger med i permalinket ({slug})", (st.get("farve") or {}).get("laage" if st.get("front") == "farve" else "kryds") == slug, st)
        # antal: flere søjler — fra det antal, knapperne viser (de følger fremvisningen)
        c0 = int(pg.locator('.hp-steps[data-for="locker"] output[data-o="c"]').inner_text())
        pg.locator('.hp-steps[data-for="locker"] [data-d="c,1"]').click(); pg.wait_for_timeout(500)
        st2 = tilstand(pg.locator("#hpDesigner").get_attribute("href"))
        tjek(f"antal søjler følger med ({c0} → {min(c0 + 1, 10)})", st2.get("soejler") == min(c0 + 1, 10), st2)
        ifc = pg.locator("#hpIfc").get_attribute("href")
        tjek("Hent IFC har &hent=ifc", "hent=ifc" in ifc and "t=" in ifc, ifc)
        # produktskift
        pg.locator('#hpProd button[data-k="hoejskab"]').click()
        pg.wait_for_selector("#hpStage.is-3d", timeout=20000)
        pg.wait_for_timeout(800)
        h = pg.locator("#hpDesigner").get_attribute("href")
        tjek("højskab: permalink med p=hoejskab", "p=hoejskab" in h, h)
        tjek("højskab: læsefeltet skifter", "højskab" in pg.locator("#hpSpec").inner_text().lower() or "skab" in pg.locator("#hpSpec").inner_text().lower(), pg.locator("#hpSpec").inner_text())
        if FREMVIS: tjek("højskab: ingen fremvisning anden gang i samme sidevisning", staar_stille(pg, 5000))
        # akustik (15-10-2026): bredde i hele paneler, hulmønster og kulør på birk
        pg.locator('#hpProd button[data-k="akustik"]').click()
        pg.wait_for_selector("#hpStage.is-3d", timeout=20000)
        pg.wait_for_timeout(800)
        a = pg.locator("#hpDesigner").get_attribute("href")
        tjek("akustik: permalink med p=akustik", "p=akustik" in a, a)
        tjek("akustik: læsefeltet skifter", "302 × 240" in pg.locator("#hpSpec").inner_text(), pg.locator("#hpSpec").inner_text())
        # akustikvæggens egen fremvisning (25-10-2026): hulmønstrene skifter af sig selv — knapperne nedenfor stopper den
        if FREMVIS: tjek("akustik: fremvisningen kører første gang, man skifter til fanen", vent_paa_skift(pg, href(pg), 8000), tilstand(href(pg)))
        tjek("akustik: knapperne for bredde og huller vises", pg.locator('.hp-steps[data-for="akustik"]').is_visible() and not pg.locator('.hp-steps[data-for="locker"]').is_visible())
        pg.locator('#hpB button[data-b="423"]').click(); pg.locator('#hpHul button[data-t="taet"]').click(); pg.wait_for_timeout(600)
        sa = tilstand(pg.locator("#hpDesigner").get_attribute("href"))
        tjek("akustik: bredde og hulmønster følger med", sa.get("b") == 423 and sa.get("hul") == 6 and sa.get("cc") == 12 and sa.get("taethed") == "taet", sa)
        tjek("akustik: læsefeltet følger bredden", "423 × 240" in pg.locator("#hpSpec").inner_text(), pg.locator("#hpSpec").inner_text())
        tjek("akustik: teksten på 3D'en siger akustikvæggen", "ændre akustikvæggen" in pg.locator("#hpRet").inner_text(), pg.locator("#hpRet").inner_text())
        tjek("akustik: teksten følger permalinket", pg.locator("#hpRet").get_attribute("href") == href(pg))
        tjek("ingen JS-fejl", not jsfejl, jsfejl[:3])
        pg.context.close()   # hver side lukkes efter brug: en fremvisning i software-3D tager ellers CPU'en fra den næste
        # reduceret bevægelse: 3D'en kommer, men ingen fremvisning
        r = ny_side(b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce"))
        r.goto(URL, wait_until="load"); r.wait_for_selector("#hpStage.is-3d", timeout=20000)
        tjek("reduceret bevægelse: ingen fremvisning", staar_stille(r, 7000))
        tjek("reduceret bevægelse: teksten vises stadig", r.locator("#hpRet").is_visible())
        r.context.close()
        # uden WebGL: stillbilledet bliver
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script("HTMLCanvasElement.prototype.getContext = function() { return null; };")
        q = ctx.new_page(); q.goto(URL, wait_until="load"); q.wait_for_timeout(2500)
        tjek("uden WebGL: stillbilledet står, ingen 3D", q.locator("#hpStill img").is_visible() and q.locator("#hpStage.is-3d").count() == 0)
        ctx.close()
        # telefon (Milot 23-10-2026: "på samme måde som hjemmesiden på pc, altså nærmest med det samme"): rumbilledet står,
        # til 3D'en kommer af sig selv med fremvisningen fra de 4 blå skabe
        t = ny_side(b.new_context(**p.devices["iPhone 13"]))
        tfejl = []
        t.on("pageerror", lambda e: tfejl.append(str(e)))
        t.goto(URL, wait_until="load")
        tjek("telefon: starter på højskab med rumbilledet", t.locator('#hpStage[data-produkt="hoejskab"]').count() == 1
             and "skabsvaeg-aften-telefon" in (t.evaluate("document.getElementById('hpStillImg').currentSrc") or ""))
        try:
            t.wait_for_selector("#hpStage.is-3d", timeout=20000); tjek("telefon: 3D'en kommer af sig selv", True)
        except Exception as e:
            tjek("telefon: 3D'en kommer af sig selv", False, str(e)[:120])
        tjek("telefon: 3D'en står over de tre veje", t.locator("#hpStage").bounding_box()["y"] < t.locator(".hp-paths").bounding_box()["y"])
        tjek("telefon: permalink med p=hoejskab", "p=hoejskab" in href(t))
        tjek("telefon: hint og tekst vises i 3D", t.locator("#hpHint").is_visible() and t.locator("#hpRet").is_visible())
        tb, kb, sb = t.locator("#hpRet").bounding_box(), t.locator("#hpToggle").bounding_box(), t.locator("#hpStage").bounding_box()
        tjek("telefon: teksten står ikke oven i knappen", not overlapper(tb, kb), (tb, kb))
        tjek("telefon: teksten er inden for 3D'en", tb and sb and tb["x"] >= sb["x"] and tb["x"] + tb["width"] <= sb["x"] + sb["width"] and tb["y"] + tb["height"] <= sb["y"] + sb["height"], (tb, sb))
        if FREMVIS:
            t0 = href(t)
            tjek("telefon: fremvisningen kører som på computeren", vent_paa_skift(t, t0, 8000) and "m" in tilstand(href(t)), tilstand(href(t)))
        t.screenshot(path=str(Path(tempfile.gettempdir()) / "forside-telefon-2.png"))
        tjek("telefon: ingen JS-fejl", not tfejl, tfejl[:3])
        t.context.close()
        # telefon med datasparetilstand: som før (Joachim 18-10-2026) — rumbilledet og én knap ind i 3D, intet af sig selv
        sc = b.new_context(**p.devices["iPhone 13"])
        sc.add_init_script("Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });")
        u = ny_side(sc)
        ufejl = []
        u.on("pageerror", lambda e: ufejl.append(str(e)))
        u.goto(URL, wait_until="load"); u.wait_for_timeout(4000)
        u.screenshot(path=str(Path(tempfile.gettempdir()) / "forside-telefon-1.png"))
        tjek("datasparetilstand: rumbilledet med knappen, ingen 3D af sig selv", u.locator('#hpStage[data-produkt="hoejskab"].wow').count() == 1
             and u.locator("#hpStage.is-3d").count() == 0 and "3D" in u.locator("#hpToggle").inner_text(), u.locator("#hpToggle").inner_text())
        tjek("datasparetilstand: hint og tekst skjult på billedet", not u.locator("#hpHint").is_visible() and not u.locator("#hpRet").is_visible())
        u.locator("#hpToggle").click()
        try:
            u.wait_for_selector("#hpStage.is-3d", timeout=20000); tjek("datasparetilstand: tryk giver 3D", True)
        except Exception as e:
            tjek("datasparetilstand: tryk giver 3D", False, str(e)[:120])
        um = tilstand(href(u))
        tjek("datasparetilstand: 3D'en er billedets skabsvæg (6 skabe i mørk eg)", um.get("mat") == "eg" and um.get("n") == 6, um)
        tjek("datasparetilstand: ingen fremvisning efter tryk", staar_stille(u, 6000))
        tjek("datasparetilstand: ingen JS-fejl", not ufejl, ufejl[:3])
        b.close()
finally:
    if srv:
        srv.terminate()
print(f"\n{ok} ok · {fejl} fejl")
sys.exit(1 if fejl else 0)
