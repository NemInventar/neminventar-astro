"""Priserne bag lockerberegneren (Joachim 08-11-2026: skoler og kommuner skal kunne skrive antal brugere og se rum,
opstilling og et prisoverslag): hver kombination af rumtype × materiale × lås åbnes i den offentlige designer som en væg
på 6 søjler (4 for personale) med hængsel "institution", og prisen pr. rum regnes af designerens EGEN prismodel (samme
PRIS_JS som scripts/produkt_priser.py og scripts/designer_eksempler.py): privat, inkl. og ekskl. moms, ekskl. levering.
Tjekker, at designeren tog imod konfigurationen (et ugyldigt valg falder ellers stille tilbage til standarden).
Statistikken blokeres, så kørslen ikke tæller som besøg.

Væglængden: designeren har selv en funktion, bredde(tilstand) i produkter/locker/produkt.js. Den er tjekket mod formlen
  søjler × rumbredde + elementer × pladetykkelse + (elementer − 1) × fuge, hvor elementer = ⌈søjler ÷ kmax⌉ og
  kmax = ⌊(længste plade − pladetykkelse) ÷ rumbredde⌋. Konstanterne (tykkelse, længste plade, fuge) gemmes i JSON'en,
  og scriptet kontrollerer formlen mod designerens bredde() for flere antal søjler pr. rumtype og materiale.
Designeren har ingen øvre grænse for søjler; den deler selv væggen i lige store elementer.

Kør igen, når lockergitteret i designeren regnes om (og sammen med scripts/produkt_priser.py): python scripts/locker_beregner_priser.py
(kræver playwright)
"""
import json, sys
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROD = Path(__file__).resolve().parent.parent
UD = ROD / "src" / "data" / "locker-beregner.json"
DESIGNER = "https://designer.neminventar.dk/designer.html"

RUM = {
    "elev": {"b": 30, "h": 40, "d": 40, "raekker": 3, "soejler": 6},
    "standard": {"b": 30, "h": 50, "d": 45, "raekker": 2, "soejler": 6},
    "hoej": {"b": 30, "h": 90, "d": 50, "raekker": 2, "soejler": 6},
    "personale": {"b": 40, "h": 90, "d": 50, "raekker": 2, "soejler": 4},
}
MAT = ["kryds", "birk", "kompakt"]
LAAS = ["haengelaas", "noegle", "kode", "elektronisk"]
KONTROL = {"standard/kryds/noegle": 2875, "standard/birk/noegle": 3175, "standard/kompakt/noegle": 3300,
           "standard/kryds/kode": 3300, "standard/kryds/elektronisk": 4000, "elev/kryds/noegle": 2500,
           "hoej/kryds/noegle": 4050, "personale/kryds/noegle": 4725}

PRIS_JS = """async (p) => {
  const P = (await import(new URL(`produkter/${p}/produkt.js`, location.href).href)).default;
  if (!P.prisModul) return null;
  const base = new URL(`produkter/${p}/pris.js`, location.href), m = await import(base.href);
  const k = await import(new URL('core/pris.js', location.href).href);
  const D = await (await fetch(new URL(m.GITTER, base), { cache: 'no-cache' })).json();
  const salg = k.salg ?? k.web;
  const v = m.lavPris({ D, MOMS: k.MOMS, salg, web: salg }).vare(window.designer.tilstand, { kunde: 'privat' });
  return v.ok ? { inkl: v.inkl, ex: v.ex, gitter: D.regnet } : null;
}"""

# væglængden: designerens egen bredde() og de konstanter, formlen bruger
BREDDE_JS = """async (ns) => {
  const M = await import(new URL('produkter/locker/produkt.js', location.href).href);
  const K = await import(new URL('core/katalog.js', location.href).href);
  const st = window.designer.tilstand;
  const ud = ns.map((n) => { const s = { ...st, soejler: n }; return { n, cm: M.bredde(s) * 100, el: M.elementer(s).length }; });
  return { ud, tyk: K.tyk(st.mat), plade: M.PLADE_MAX[st.mat], fuge: M.FUGE, kmax: M.kmaxPlade(st) };
}"""


def kod(st):   # samme som designerens permalink (core/permalink.js kod) og src/lib/forside.ts
    import base64
    return base64.urlsafe_b64encode(json.dumps(st, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode().rstrip("=")


def ens(a, b):
    if isinstance(a, dict):
        return isinstance(b, dict) and all(ens(v, b.get(k)) for k, v in a.items())
    return a == b


def formel(n, b, tyk, plade, fuge):
    import math
    kmax = max(1, math.floor((plade - tyk) / (b / 100) + 1e-9))
    el = math.ceil(n / kmax)
    return (n * b / 100 + el * tyk + (el - 1) * fuge) * 100


priser, vaeg, fejl = {}, {}, 0
with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = br.new_context(viewport={"width": 1400, "height": 800})
    ctx.route("**/api/event", lambda r: r.abort())
    ctx.add_init_script("try { sessionStorage.setItem('rb-klar', '1') } catch (e) {}")
    gitter = None
    for rum, m in RUM.items():
        for mat in MAT:
            for laas in LAAS:
                st = {"soejler": m["soejler"], "raekker": m["raekker"], "b": m["b"], "h": m["h"], "d": m["d"],
                      "mat": mat, "laas": laas, "haengsel": "institution"}
                pg = ctx.new_page()
                pg.goto(f"{DESIGNER}?p=locker&t={kod(st)}", wait_until="networkidle")
                pg.wait_for_selector("body.ready", timeout=90000); pg.wait_for_timeout(2000)
                ok = ens(st, pg.evaluate("window.designer.tilstand"))
                pris = pg.evaluate(PRIS_JS, "locker")
                n = m["soejler"] * m["raekker"]
                if not ok or not pris:
                    fejl += 1
                    print(f"FEJL {rum}/{mat}/{laas}: ok={ok} pris={pris}", pg.evaluate("window.designer.tilstand"))
                else:
                    gitter = pris["gitter"]
                    priser[f"{rum}/{mat}/{laas}"] = {"inkl": round(pris["inkl"] / n), "ex": round(pris["ex"] / n),
                                                     "rum": n}
                if laas == "haengelaas" and ok:   # væglængde: formlen mod designerens bredde(), pr. rumtype og materiale
                    b = pg.evaluate(BREDDE_JS, [1, 2, 6, 8, 12, 20, 40, 60])
                    for x in b["ud"]:
                        f = formel(x["n"], m["b"], b["tyk"], b["plade"], b["fuge"])
                        if abs(f - x["cm"]) > 0.01:
                            fejl += 1
                            print(f"FEJL bredde {rum}/{mat} n={x['n']}: designer {x['cm']:.2f} formel {f:.2f}")
                    vaeg[f"{rum}/{mat}"] = {"tyk": b["tyk"], "plade": b["plade"], "fuge": b["fuge"]}
                print(f"{rum}/{mat}/{laas}: {priser.get(f'{rum}/{mat}/{laas}')}")
                pg.close()
    br.close()

# kontrol mod designerens tal 08-11-2026 (12 rum; elevskab 18 rum osv.): ±1 kr. (afrunding)
for k, v in KONTROL.items():
    if k in priser and abs(priser[k]["inkl"] - v) > 1:
        print(f"AFVIGER {k}: {priser[k]['inkl']} mod {v} (08-11-2026)")

UD.write_text(json.dumps({
    "regnet": datetime.now(timezone.utc).isoformat(timespec="seconds"), "gitter": gitter, "kilde": DESIGNER,
    "note": "pris pr. rum i en væg på 6 søjler (personale 4), hængsel institution · privat, inkl./ekskl. moms, ekskl. levering "
            "(scripts/locker_beregner_priser.py)",
    "rum": {k: {kk: vv for kk, vv in v.items() if kk != "soejler"} | {"soejler": v["soejler"]} for k, v in RUM.items()},
    "vaeg": vaeg, "priser": priser}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{len(priser)} priser → {UD.relative_to(ROD)}")
sys.exit(1 if fejl else 0)
