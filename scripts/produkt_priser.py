"""Fra-prisen på produktsiderne (Joachim 08-11-2026, lockers-SEO): hver type, designeren kan åbne, åbnes i sin
standardudgave (samme link som "Åbn designeren" på produktsiden, uden kulør), og prisen regnes af designerens EGEN
prismodel — samme PRIS_JS som scripts/designer_eksempler.py: privat, inkl. moms, ekskl. levering.
Resultatet skrives i src/data/produkt-priser.json og bruges af src/pages/produkter/[slug].astro til den synlige
"fra"-pris og til Product/Offer i den strukturerede data (Google kræver, at prisen i data også står på siden).

Kør igen, når prisgitteret i designeren regnes om: python scripts/produkt_priser.py   (kræver playwright og node ≥ 23)
"""
import json, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROD = Path(__file__).resolve().parent.parent
UD = ROD / "src" / "data" / "produkt-priser.json"
PRIS_JS = """async (p) => {
  const P = (await import(new URL(`produkter/${p}/produkt.js`, location.href).href)).default;
  if (!P.prisModul) return null;
  const base = new URL(`produkter/${p}/pris.js`, location.href), m = await import(base.href);
  const k = await import(new URL('core/pris.js', location.href).href);
  const D = await (await fetch(new URL(m.GITTER, base), { cache: 'no-cache' })).json();
  const salg = k.salg ?? k.web;
  const v = m.lavPris({ D, MOMS: k.MOMS, salg, web: salg }).vare(window.designer.tilstand, { kunde: 'privat' });
  return v.ok ? { inkl: Math.round(v.inkl), ex: Math.round(v.ex), gitter: D.regnet } : null;
}"""

links = json.loads(subprocess.run(["node", str(ROD / "scripts" / "produkt_links.mjs")], capture_output=True, text=True,
                                  encoding="utf-8", check=True).stdout)
priser = {}
with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = br.new_context(viewport={"width": 1400, "height": 800})
    ctx.route("**/api/event", lambda r: r.abort())   # tæller ikke som besøg
    ctx.add_init_script("try { sessionStorage.setItem('rb-klar', '1') } catch (e) {}")
    for slug, d in links.items():
        pg = ctx.new_page()
        pg.goto(d["link"], wait_until="networkidle")
        pg.wait_for_selector("body.ready", timeout=90000); pg.wait_for_timeout(2500)
        pris = pg.evaluate(PRIS_JS, d["produkt"])
        if pris:
            priser[slug] = {"inkl": pris["inkl"], "ex": pris["ex"], "gitter": pris["gitter"], "link": d["link"]}
        print(f"{slug}: {pris['inkl'] if pris else 'ingen pris'}")
        pg.close()
    br.close()
UD.write_text(json.dumps({"regnet": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                          "note": "standardudgaven i designeren · privat, inkl. moms, ekskl. levering (scripts/produkt_priser.py)",
                          "priser": dict(sorted(priser.items()))}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{len(priser)} af {len(links)} typer → {UD.relative_to(ROD)}")
