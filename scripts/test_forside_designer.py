"""Bevis for forsidens 3D med designerens indlejring (indlejr.v1.js).
  python scripts/test_forside_designer.py                 (lokal dist)
  python scripts/test_forside_designer.py https://neminventar.dk/
Tjekker: indlejringen indlæses (lærred i #hpCanvas), læsefeltet får designerens spec, kulør og antal ændrer permalinket,
produktskift giver en ny indlejring, "Hent IFC" har &hent=ifc — og uden WebGL bliver stillbilledet stående."""
import base64, json, subprocess, sys, tempfile, time
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
DIST = Path(__file__).resolve().parent.parent / "dist"
REMOTE = sys.argv[1].rstrip("/") + "/" if len(sys.argv) > 1 else None
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


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = b.new_page(viewport={"width": 1440, "height": 900})
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
        # resten af lockertjekket: skift til lockers
        pg.locator('#hpProd button[data-k="locker"]').click()
        pg.wait_for_selector("#hpStage.is-3d", timeout=20000); pg.wait_for_timeout(800)
        spec = pg.locator("#hpSpec").inner_text()
        tjek("læsefeltet viser designerens spec", "locker" in spec.lower(), spec)
        d0 = pg.locator("#hpDesigner").get_attribute("href")
        tjek("Åbn i designeren peger på ni-designer med tilstand", "designer.neminventar.dk" in d0 and "t=" in d0, d0)
        # kulør: anden knap
        pg.locator("#hpSw button").nth(1).click(); pg.wait_for_timeout(500)
        st = tilstand(pg.locator("#hpDesigner").get_attribute("href"))
        slug = pg.locator("#hpSw button").nth(1).get_attribute("data-slug")
        tjek(f"kuløren følger med i permalinket ({slug})", (st.get("farve") or {}).get("kryds") == slug, st)
        # antal: flere søjler
        pg.locator('.hp-steps[data-for="locker"] [data-d="c,1"]').click(); pg.wait_for_timeout(500)
        st2 = tilstand(pg.locator("#hpDesigner").get_attribute("href"))
        tjek("antal søjler følger med", st2.get("soejler") == 7, st2)
        ifc = pg.locator("#hpIfc").get_attribute("href")
        tjek("Hent IFC har &hent=ifc", "hent=ifc" in ifc and "t=" in ifc, ifc)
        # produktskift
        pg.locator('#hpProd button[data-k="hoejskab"]').click()
        pg.wait_for_selector("#hpStage.is-3d", timeout=20000)
        pg.wait_for_timeout(800)
        h = pg.locator("#hpDesigner").get_attribute("href")
        tjek("højskab: permalink med p=hoejskab", "p=hoejskab" in h, h)
        tjek("højskab: læsefeltet skifter", "højskab" in pg.locator("#hpSpec").inner_text().lower() or "skab" in pg.locator("#hpSpec").inner_text().lower(), pg.locator("#hpSpec").inner_text())
        # akustik (15-10-2026): bredde i hele paneler, hulmønster og kulør på birk
        pg.locator('#hpProd button[data-k="akustik"]').click()
        pg.wait_for_selector("#hpStage.is-3d", timeout=20000)
        pg.wait_for_timeout(800)
        a = pg.locator("#hpDesigner").get_attribute("href")
        tjek("akustik: permalink med p=akustik", "p=akustik" in a, a)
        tjek("akustik: læsefeltet skifter", "302 × 240" in pg.locator("#hpSpec").inner_text(), pg.locator("#hpSpec").inner_text())
        tjek("akustik: knapperne for bredde og huller vises", pg.locator('.hp-steps[data-for="akustik"]').is_visible() and not pg.locator('.hp-steps[data-for="locker"]').is_visible())
        pg.locator('#hpB button[data-b="423"]').click(); pg.locator('#hpHul button[data-t="taet"]').click(); pg.wait_for_timeout(600)
        sa = tilstand(pg.locator("#hpDesigner").get_attribute("href"))
        tjek("akustik: bredde og hulmønster følger med", sa.get("b") == 423 and sa.get("hul") == 6 and sa.get("cc") == 12 and sa.get("taethed") == "taet", sa)
        tjek("akustik: læsefeltet følger bredden", "423 × 240" in pg.locator("#hpSpec").inner_text(), pg.locator("#hpSpec").inner_text())
        tjek("ingen JS-fejl", not jsfejl, jsfejl[:3])
        # uden WebGL: stillbilledet bliver
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script("HTMLCanvasElement.prototype.getContext = function() { return null; };")
        q = ctx.new_page(); q.goto(URL, wait_until="load"); q.wait_for_timeout(2500)
        tjek("uden WebGL: stillbilledet står, ingen 3D", q.locator("#hpStill img").is_visible() and q.locator("#hpStage.is-3d").count() == 0)
        # telefon (18-10-2026): højskab + rumbillede først, ingen 3D før tryk, knappen bygger 3D'en
        t = b.new_context(**p.devices["iPhone 13"]).new_page()
        tfejl = []
        t.on("pageerror", lambda e: tfejl.append(str(e)))
        t.goto(URL, wait_until="load"); t.wait_for_timeout(4000)
        t.screenshot(path=str(Path(tempfile.gettempdir()) / "forside-telefon-1.png"))
        tjek("telefon: starter på højskab", t.locator('#hpStage[data-produkt="hoejskab"].wow').count() == 1)
        tjek("telefon: rumbilledet vises", "skabsvaeg-aften-telefon" in (t.evaluate("document.getElementById('hpStillImg').currentSrc") or ""))
        tjek("telefon: ingen 3D af sig selv", t.locator("#hpStage.is-3d").count() == 0)
        tjek("telefon: 3D-hint skjult på billedet", not t.locator("#hpHint").is_visible())
        tjek("telefon: billedet står over de tre veje", t.locator("#hpStage").bounding_box()["y"] < t.locator(".hp-paths").bounding_box()["y"])
        tjek("telefon: knappen ind i 3D", "3D" in t.locator("#hpToggle").inner_text(), t.locator("#hpToggle").inner_text())
        t.locator("#hpToggle").click()
        try:
            t.wait_for_selector("#hpStage.is-3d", timeout=20000); tjek("telefon: tryk giver 3D", True)
        except Exception as e:
            tjek("telefon: tryk giver 3D", False, str(e)[:120])
        tjek("telefon: permalink med p=hoejskab", "p=hoejskab" in t.locator("#hpDesigner").get_attribute("href"))
        tm = tilstand(t.locator("#hpDesigner").get_attribute("href"))
        tjek("telefon: 3D'en er billedets skabsvæg (6 skabe i mørk eg)", tm.get("mat") == "eg" and tm.get("n") == 6, tm)
        tjek("telefon: hint skjult på billedet, vist i 3D", t.locator("#hpHint").is_visible())
        t.wait_for_timeout(1500)
        t.screenshot(path=str(Path(tempfile.gettempdir()) / "forside-telefon-2.png"))
        tjek("telefon: ingen JS-fejl", not tfejl, tfejl[:3])
        b.close()
finally:
    if srv:
        srv.terminate()
print(f"\n{ok} ok · {fejl} fejl")
sys.exit(1 if fejl else 0)
