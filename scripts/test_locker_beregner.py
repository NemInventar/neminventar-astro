"""Skærmbilleder og røgtest af lockerberegneren på den byggede side (npm run preview kører på :4321).
Kør: python scripts/test_locker_beregner.py <mappe til billeder> [adresse, standard http://localhost:4321]"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
UD = Path(sys.argv[1]); UD.mkdir(parents=True, exist_ok=True)
HOST = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:4321"
fejl = 0
with sync_playwright() as p:
    br = p.chromium.launch()
    for navn, w, h in [("1360", 1360, 900), ("390", 390, 844)]:
        ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
        ctx.route("**/api/event", lambda r: r.abort())
        pg = ctx.new_page()
        pg.goto(f"{HOST}/lockers/?brugere=25&rum=elev&mat=kryds&laas=kode#beregner", wait_until="networkidle")
        pg.wait_for_timeout(800)
        txt = pg.inner_text("#lb-res")
        print(navn, txt.replace("\n", " | ")[:300])
        ok = "27 rum" in txt and "9 søjler i 3 rækker" in txt
        href = pg.get_attribute("#lb-knap", "href")
        ok = ok and href.startswith("https://designer.neminventar.dk/designer.html?p=locker&t=")
        sw = pg.evaluate("document.documentElement.scrollWidth"); ok = ok and sw <= w
        print(navn, "scrollWidth", sw, "OK" if ok else "FEJL"); fejl += 0 if ok else 1
        pg.locator("#beregner").scroll_into_view_if_needed()
        pg.locator("#beregner").screenshot(path=str(UD / f"lockerberegner-{navn}.png"))
        pg.fill("#lb-brugere", "100"); pg.select_option("#lb-rum", "personale"); pg.wait_for_timeout(300)
        print(navn, "efter ændring:", pg.inner_text("#lb-res").replace("\n", " | ")[:200], "| adresse:", pg.url.split("?")[1])
        pg2 = ctx.new_page(); pg2.goto(f"{HOST}/hvad-koster-lockers/", wait_until="networkidle")
        print(navn, "hvad-koster-lockers har beregner:", pg2.locator("#beregner").count() == 1)
    br.close()
raise SystemExit(1 if fejl else 0)
