"""Billederne til /design-det-selv/ (Joachim 16-10-2026: "eksempler med hvad man kan lave med designeren og så arbejde videre
derfra"): hvert eksempel i src/data/designer-eksempler.json åbnes i den offentlige designer med sin konfiguration (samme
permalink som siden linker til), og scenen fotograferes uden knapper og mærkater → public/billeder/designer-eksempler/<id>.jpg
(1200 × 800, 3:2). Tjekker samtidig, at designeren har taget imod konfigurationen (et ugyldigt valg falder ellers stille
tilbage til standarden). Statistikken blokeres, så kørslen ikke tæller som besøg.

Prisen (Joachim 20-10-2026: "der må der gerne stå pris på"): for produkter med pris i designeren regnes eksemplets pris af
designerens EGEN prismodel (produkter/<p>/pris.js + prisgitteret, samme som prisen i designerens bjælke) — privat, inkl.
moms, ekskl. levering — og skrives i src/data/designer-eksempler-priser.json (alle eksempler, også dem der ikke blev
valgt). Ændres priserne i designeren (prisgitteret regnet om), køres scriptet igen: --kun-priser springer billederne over.

Kør: python scripts/designer_eksempler.py [id …] [--kun-priser]   (kræver playwright + Pillow)
"""
import base64, io, json, sys
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
ROD = Path(__file__).resolve().parent.parent
EKS = json.loads((ROD / "src" / "data" / "designer-eksempler.json").read_text(encoding="utf-8"))
KUN_PRISER = "--kun-priser" in sys.argv
VALGT = {a for a in sys.argv[1:] if not a.startswith("--")}   # kun disse eksempler (id), ellers alle
EKS = [e for e in EKS if not VALGT or e["id"] in VALGT]
UD = ROD / "public" / "billeder" / "designer-eksempler"
UD.mkdir(parents=True, exist_ok=True)
PRISER = ROD / "src" / "data" / "designer-eksempler-priser.json"
DESIGNER = "https://designer.neminventar.dk/designer.html"
# Eksemplets pris med designerens egen prismodel (kun produkter med prisModul — ellers None, og ingen 404 på pris.js)
PRIS_JS = """async (p) => {
  const P = (await import(new URL(`produkter/${p}/produkt.js`, location.href).href)).default;
  if (!P.prisModul) return null;
  const base = new URL(`produkter/${p}/pris.js`, location.href), m = await import(base.href);
  const k = await import(new URL('core/pris.js', location.href).href);
  const D = await (await fetch(new URL(m.GITTER, base), { cache: 'no-cache' })).json();
  const v = m.lavPris({ D, MOMS: k.MOMS, web: k.web }).vare(window.designer.tilstand, { kunde: 'privat' });
  return v.ok ? { inkl: Math.round(v.inkl), ex: Math.round(v.ex), gitter: D.regnet } : null;
}"""


def kod(st):   # samme som designerens permalink (core/permalink.js kod) og src/lib/forside.ts
    return base64.urlsafe_b64encode(json.dumps(st, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode().rstrip("=")


def ens(a, b):   # konfigurationen kom igennem: hver nøgle i eksemplet findes med samme værdi i designerens tilstand
    if isinstance(a, dict):
        return isinstance(b, dict) and all(ens(v, b.get(k)) for k, v in a.items())
    if isinstance(a, list):
        return isinstance(b, list) and len(a) == len(b) and all(ens(x, y) for x, y in zip(a, b))
    return a == b


SKJUL = """(() => { const c = document.querySelector('#canvasWrap');
  document.querySelectorAll('body *').forEach((e) => { if (!e.contains(c) && !c.contains(e)) e.style.visibility = 'hidden'; }); })()"""

fejl = 0
gl = json.loads(PRISER.read_text(encoding="utf-8")) if PRISER.exists() else {"priser": {}}
alle_id = {e["id"] for e in json.loads((ROD / "src" / "data" / "designer-eksempler.json").read_text(encoding="utf-8"))}
priser = {k: v for k, v in gl.get("priser", {}).items() if k in alle_id}   # fjernede eksempler ryger ud
with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    # scenen i 3:2 (vinduet minus panelet), så kameraet selv indrammer billedet — en beskæring skar toppen af de høje skabe
    ctx = br.new_context(viewport={"width": 1640, "height": 800}, device_scale_factor=2)
    ctx.route("**/api/event", lambda r: r.abort())
    ctx.add_init_script("try { sessionStorage.setItem('rb-klar', '1') } catch (e) {}")
    for e in EKS:
        pg = ctx.new_page()
        pg.goto(f"{DESIGNER}?p={e['produkt']}&t={kod(e['st'])}", wait_until="networkidle")
        pg.wait_for_selector("body.ready", timeout=90000); pg.wait_for_timeout(4500)
        st = pg.evaluate("window.designer.tilstand")
        ok = ens(e["st"], st)
        if not ok:
            fejl += 1
            print(f"FEJL {e['id']}: designeren tog ikke imod hele konfigurationen", {k: st.get(k) for k in e["st"]})
        pris = pg.evaluate(PRIS_JS, e["produkt"])
        if pris: priser[e["id"]] = pris
        else: priser.pop(e["id"], None)
        if KUN_PRISER:
            print(f"{'OK  ' if ok else 'FEJL'} {e['id']}: {pris['inkl'] if pris else 'ingen pris'}")
            pg.close(); continue
        pg.evaluate(SKJUL); pg.wait_for_timeout(400)
        box = pg.locator("#canvasWrap").bounding_box()   # et fast udsnit: scenen tegner hele tiden (pendul), så "stabil" kommer aldrig
        png = pg.screenshot(clip=box, timeout=120000)
        im = Image.open(io.BytesIO(png)).convert("RGB")
        # beskåret til produktet (+ skyggen) med 10 % luft: designeren holder plads til knapperne, så produktet stod for småt.
        # Baggrunden er lys og jævn — alt med en kanal under 214 er produkt, skygge eller rekvisit.
        w, h = im.size
        maske = im.point(lambda v: 255 if v < 214 else 0).convert("L").point(lambda v: 255 if v else 0)
        bb = maske.getbbox() or (0, 0, w, h)
        bw, bh = bb[2] - bb[0], bb[3] - bb[1]
        cw = max(bw * 1.2, bh * 1.2 * 1.5); ch = cw / 1.5   # 3:2 rundt om produktet med luft
        if ch > h: ch = h; cw = ch * 1.5
        if cw > w: cw = w; ch = cw / 1.5
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        x0 = min(max(0, cx - cw / 2), w - cw); y0 = min(max(0, cy - ch / 2), h - ch)
        im = im.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((1200, 800), Image.LANCZOS)
        im.save(UD / f"{e['id']}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
        print(f"{'OK  ' if ok else 'FEJL'} {e['id']}.jpg · {pris['inkl'] if pris else 'ingen pris'}")
        pg.close()
    br.close()
PRISER.write_text(json.dumps({"regnet": datetime.now(timezone.utc).isoformat(timespec="seconds"), "kilde": DESIGNER,
                              "note": "privat, inkl. moms, ekskl. levering — designerens egen prismodel (scripts/designer_eksempler.py)",
                              "priser": dict(sorted(priser.items()))}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"Priser: {len(priser)} af {len(alle_id)} eksempler → {PRISER.relative_to(ROD)}")
sys.exit(1 if fejl else 0)
