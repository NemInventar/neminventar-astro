"""Bevis for forsidens 3D med designerens indlejring (indlejr.v1.js).
  python scripts/test_forside_designer.py                 (lokal dist)
  python scripts/test_forside_designer.py https://neminventar.dk/
Tjekker: indlejringen indlæses (lærred i #hpCanvas), læsefeltet får designerens spec, kulør og antal ændrer permalinket,
produktskift giver en ny indlejring, "Hent IFC" har &hent=ifc — og uden WebGL bliver stillbilledet stående."""
import base64, json, subprocess, sys, time
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
        tjek("ingen JS-fejl", not jsfejl, jsfejl[:3])
        # uden WebGL: stillbilledet bliver
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script("HTMLCanvasElement.prototype.getContext = function() { return null; };")
        q = ctx.new_page(); q.goto(URL, wait_until="load"); q.wait_for_timeout(2500)
        tjek("uden WebGL: stillbilledet står, ingen 3D", q.locator("#hpStill img").is_visible() and q.locator("#hpStage.is-3d").count() == 0)
        b.close()
finally:
    if srv:
        srv.terminate()
print(f"\n{ok} ok · {fejl} fejl")
sys.exit(1 if fejl else 0)
