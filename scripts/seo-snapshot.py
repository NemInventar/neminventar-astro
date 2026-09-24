"""SEO-snapshot af neminventar.dk → seo_snapshots_2026_09_24 (læs udviklingen i v_seo_udvikling).

Måler automatisk det, der kan måles (sider, struktureret data, lint, sitemap, konkurrerende prototype,
evt. Lighthouse), og gemmer det sammen med delscorerne. Delscorerne er en vurdering efter
seo_rubric_2026_09_24.anchors — kør først med --dry, læs målingerne og ankrene, sæt så scorerne.

  python scripts/seo-snapshot.py --dry [--lighthouse]
  python scripts/seo-snapshot.py --label "Uge 40" --scores teknik=9,indhold=8,beviser=5,autoritet=3,lokal=5,historik=4 \
      --manual gsc_indekserede=31,gsc_visninger_28d=420,backlinks=4,gbp=verificeret --notes "..." [--lighthouse]

Kræver SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (skriv) i miljøet.
"""
import argparse, json, os, re, subprocess, sys, tempfile, urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
SITE = "https://neminventar.dk/"
URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HERE = Path(__file__).parent

def db(method, path, body=None):
    r = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method,
        data=json.dumps(body, ensure_ascii=False).encode() if body is not None else None,
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json; charset=utf-8", "Prefer": "return=representation"})
    t = urllib.request.urlopen(r, timeout=60).read().decode(); return json.loads(t) if t else None

def http(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "ni-seo-snapshot"}), timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e: return e.code, ""
    except Exception: return 0, ""

def lighthouse(url):
    out = Path(tempfile.gettempdir()) / "ni-lh.json"
    subprocess.run(f'npx -y lighthouse@12 {url} --quiet --chrome-flags="--headless=new" --only-categories=performance,seo,accessibility,best-practices --output=json --output-path="{out}"',
                   shell=True, capture_output=True, timeout=300)
    if not out.exists(): return None
    cats = json.loads(out.read_text(encoding="utf-8"))["categories"]; out.unlink()
    return {k: round((v["score"] or 0) * 100) for k, v in cats.items()}

def measure(with_lh):
    m = {}
    pages = db("GET", "v_web_landing_pages?select=kind")
    m["sider"] = {k: sum(1 for p in pages if p["kind"] == k) for k in ("emne", "segment", "guide")}
    m["arketyper"] = len(db("GET", "v_web_products?select=slug"))
    cases = db("GET", "v_web_cases?select=slug,gallery")
    m["cases"] = len(cases)
    m["cases_med_foto"] = sum(1 for c in cases if any(g.get("kind") == "foto" for g in (c["gallery"] or [])))
    st, sm = http(SITE + "sitemap-0.xml"); m["sitemap_urls"] = sm.count("<loc>")
    _, home = http(SITE); _, land = http(SITE + "kompaktlaminat/")
    m["jsonld_typer"] = sorted(set(re.findall(r'"@type":"(\w+)"', home + land)))
    m["hreflang"] = 'hreflang="en"' in home
    m["llms_txt"] = http(SITE + "llms.txt")[0] == 200
    m["bing_verifikation"] = http(SITE + "BingSiteAuth.xml")[0] == 200
    m["indexnow_key"] = http(SITE + "9c4e2b7a51d84f6e8a3b0c7d1e5f9a26.txt")[0] == 200
    m["lovable_prototype_live"] = http("https://nem-inventar-craft.lovable.app/")[0] == 200
    lint = subprocess.run([sys.executable, str(HERE / "lint-web-copy.py")], capture_output=True, text=True, encoding="utf-8",
                          env={**os.environ, "SUPABASE_ANON_KEY": os.environ.get("SUPABASE_ANON_KEY", KEY)})
    mm = re.search(r"(\d+) fejl · (\d+) advarsler", lint.stdout)
    m["lint"] = {"fejl": int(mm.group(1)), "advarsler": int(mm.group(2))} if mm else None
    if with_lh:
        m["lighthouse_mobil"] = {"/": lighthouse(SITE), "/kompaktlaminat/": lighthouse(SITE + "kompaktlaminat/")}
    return m

def kv(s):
    out = {}
    for part in filter(None, (s or "").split(",")):
        k, v = part.split("=", 1)
        try: out[k.strip()] = float(v) if "." in v else int(v)
        except ValueError: out[k.strip()] = v.strip()
    return out

ap = argparse.ArgumentParser()
ap.add_argument("--label"); ap.add_argument("--scores"); ap.add_argument("--manual"); ap.add_argument("--notes")
ap.add_argument("--lighthouse", action="store_true"); ap.add_argument("--dry", action="store_true")
ap.add_argument("--by", default=os.environ.get("NI_USER", "js@neminventar.dk"))
a = ap.parse_args()

rubric = db("GET", "seo_rubric_2026_09_24?select=area,label,weight,anchors&order=sort_order")
metrics = measure(a.lighthouse)
print(json.dumps(metrics, ensure_ascii=False, indent=1))
if a.dry:
    print("\nRubrik (sæt 0-10 pr. område):")
    for r in rubric: print(f"- {r['area']} ({r['weight']}): {r['anchors']}")
    sys.exit(0)

scores = kv(a.scores)
missing = [r["area"] for r in rubric if r["area"] not in scores]
if missing or not a.label: sys.exit(f"Mangler --label og/eller scorer for: {missing}")
row = db("POST", "seo_snapshots_2026_09_24", {"label": a.label, "scores": scores, "metrics": metrics,
          "manual": kv(a.manual), "notes": a.notes, "created_by": a.by})[0]
for r in db("GET", "v_seo_udvikling?select=taken_at,label,total"):
    print(f"{r['taken_at'][:16]}  {r['total']:>4}  {r['label']}")
