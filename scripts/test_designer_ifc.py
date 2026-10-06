"""Bevis for "Hent IFC" på typesiderne: hvert link til designeren med &hent=ifc giver en IFC-fil (STEP, IFC4).
  python scripts/test_designer_ifc.py                  (links fra lokal dist)
  python scripts/test_designer_ifc.py https://neminventar.dk/
Henter typesiderne, tager det første "Hent IFC"-link og et farvet, og åbner dem i designeren."""
import re, subprocess, sys, time, html
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
DIST = Path(__file__).resolve().parent.parent / "dist"
REMOTE = sys.argv[1].rstrip("/") + "/" if len(sys.argv) > 1 else None
srv = None if REMOTE else subprocess.Popen([sys.executable, "-m", "http.server", "8774", "--bind", "127.0.0.1", "-d", str(DIST)],
                                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0 if REMOTE else 1.2)
URL = REMOTE or "http://127.0.0.1:8774/"
TYPER = ["hoejskab-krydsfiner", "garderobeskab-perforerede-lager", "hoejskab-kompaktlaminat", "hoejskab-hpl-laager"]
ok = fejl = 0


def tjek(navn, c, info=""):
    global ok, fejl
    if c:
        ok += 1; print("ok  ", navn)
    else:
        fejl += 1; print("FEJL", navn, info)


try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(accept_downloads=True)
        pg = ctx.new_page()
        for slug in TYPER:
            pg.goto(URL + f"produkter/{slug}/", wait_until="domcontentloaded")
            knap = pg.locator("#ifc-knap")
            tjek(f"{slug}: Hent IFC-knap", knap.count() == 1)
            if not knap.count():
                continue
            links = [knap.get_attribute("href")] + [html.unescape(x) for x in pg.eval_on_selector_all(".vtile[data-ifc]", "ts => ts.map(t => t.dataset.ifc)")[1:2]]
            for link in links:
                d = b.new_context(accept_downloads=True).new_page()
                try:
                    with d.expect_download(timeout=30000) as dl:
                        d.goto(link, wait_until="domcontentloaded")
                    f = dl.value
                    data = Path(f.path()).read_bytes()[:400].decode("latin-1")
                    tjek(f"{slug}: {f.suggested_filename}", f.suggested_filename.lower().endswith(".ifc") and "ISO-10303-21" in data and "IFC4" in data, data[:80])
                except Exception as e:
                    tjek(f"{slug}: download", False, str(e)[:160])
                d.context.close()
        b.close()
finally:
    if srv:
        srv.terminate()
print(f"\n{ok} ok · {fejl} fejl")
sys.exit(1 if fejl else 0)
