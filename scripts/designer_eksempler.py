"""Billederne til /design-det-selv/ (Joachim 16-10-2026: "eksempler med hvad man kan lave med designeren og så arbejde videre
derfra"): hvert eksempel i src/data/designer-eksempler.json åbnes i den offentlige designer med sin konfiguration (samme
permalink som siden linker til), og scenen fotograferes uden knapper og mærkater → public/billeder/designer-eksempler/<id>.jpg
(1200 × 800, 3:2). Tjekker samtidig, at designeren har taget imod konfigurationen (et ugyldigt valg falder ellers stille
tilbage til standarden). Statistikken blokeres, så kørslen ikke tæller som besøg.

Kør: python scripts/designer_eksempler.py   (kræver playwright + Pillow)
"""
import base64, io, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
ROD = Path(__file__).resolve().parent.parent
EKS = json.loads((ROD / "src" / "data" / "designer-eksempler.json").read_text(encoding="utf-8"))
VALGT = set(sys.argv[1:])   # kun disse eksempler (id), ellers alle
EKS = [e for e in EKS if not VALGT or e["id"] in VALGT]
UD = ROD / "public" / "billeder" / "designer-eksempler"
UD.mkdir(parents=True, exist_ok=True)
DESIGNER = "https://designer.neminventar.dk/designer.html"


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
        print(f"{'OK  ' if ok else 'FEJL'} {e['id']}.jpg")
        pg.close()
    br.close()
sys.exit(1 if fejl else 0)
