"""Den engelske udgave af sitet: hvad er forældet, hvad mangler, og nyt fingeraftryk efter en ny oversættelse.

  python scripts/engelsk_status.py                       liste over forældede og manglende oversættelser
  python scripts/engelsk_status.py --kilde landing/<slug>  den danske tekst, der skal oversættes (JSON)
  python scripts/engelsk_status.py --opdater landing/<slug> fingeraftrykket sættes til den danske tekst, som den er nu

<slags> er landing, type eller sag; slug er den danske. Teksterne bor i src/data/engelsk/ (landing.json, produkter.json,
sager.json); guiderne i src/data/guides-i18n.en.json. Fingeraftrykket regnes som i src/lib/engelsk.ts (fingeraftryk): sha1
af felterne sat sammen med \\u0001. Ret det ene sted, så ret det andet. Nøglen: SUPABASE_ANON_KEY eller sitets .env.
Arbejdsgangen: tekst-tjekket (lint-web-copy.py --dist) melder ADVAR → --kilde → oversæt det rettede i JSON-filen →
--opdater → byg."""
import hashlib, json, os, sys, urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROD = Path(__file__).resolve().parent.parent
DATA = ROD / "src" / "data" / "engelsk"


def env(navn):
    if os.environ.get(navn):
        return os.environ[navn]
    f = ROD / ".env"
    for l in (f.read_text(encoding="utf-8").splitlines() if f.exists() else []):
        if l.startswith(navn + "="):
            return l.split("=", 1)[1].strip().strip('"')
    sys.exit(f"Mangler {navn} (miljøvariabel eller .env)")


URL = env("SUPABASE_URL").rstrip("/")
KEY = env("SUPABASE_ANON_KEY")


def hent(view):
    r = urllib.request.Request(f"{URL}/rest/v1/{view}?select=*", headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
    return {x["slug"]: x for x in json.loads(urllib.request.urlopen(r, timeout=60).read())}


def fp(felter):
    return hashlib.sha1("\u0001".join("" if f is None else f for f in felter).encode("utf-8")).hexdigest()[:12]


KILDE = {
    "landing": lambda l: fp([l.get("nav_label"), l.get("kicker"), l.get("h1"), l.get("lead"), l.get("body"),
                             "\u0003".join(f"{f['q']}\u0002{f['a']}" for f in (l.get("faq") or [])),
                             "\u0003".join(f"{h['k']}\u0002{h['v']}" for h in (l.get("highlights") or [])),
                             l.get("seo_title"), l.get("seo_description"),
                             "\u0003".join(f"{i['src']}\u0002{i.get('alt') or ''}\u0002{i.get('caption') or ''}" for i in (l.get("images") or []))]),
    "type": lambda p: fp([p.get("name"), p.get("hero_tagline"), p.get("intro"), p.get("story") or p.get("short_description"), p.get("seo_title"), p.get("seo_description")]),
    "sag": lambda c: fp([c.get("name"), c.get("hero_tagline"), c.get("web_summary"), c.get("web_story"), c.get("delivery_label"), c.get("status_label"), c.get("seo_title"), c.get("seo_description")]),
}
VIEW = {"landing": "v_web_landing_pages", "type": "v_web_products", "sag": "v_web_cases"}
FIL = {"landing": "landing.json", "type": "produkter.json", "sag": "sager.json"}


def laes(slags):
    d = json.loads((DATA / FIL[slags]).read_text(encoding="utf-8"))
    return {x["da_slug"]: x for x in d} if slags == "landing" else d


def gem(slags, d):
    ud = list(d.values()) if slags == "landing" else d
    (DATA / FIL[slags]).write_text(json.dumps(ud, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def mal(arg):
    slags, _, slug = arg.partition("/")
    if slags not in VIEW or not slug:
        sys.exit("Skriv landing/<slug>, type/<slug> eller sag/<slug> (den danske slug)")
    return slags, slug


if "--kilde" in sys.argv or "--opdater" in sys.argv:
    opdater = "--opdater" in sys.argv
    slags, slug = mal(sys.argv[sys.argv.index("--opdater" if opdater else "--kilde") + 1])
    dansk = hent(VIEW[slags]).get(slug) or sys.exit(f"{slags}/{slug} findes ikke på dansk")
    if not opdater:
        print(json.dumps(dansk, ensure_ascii=False, indent=1))
        sys.exit(0)
    d = laes(slags)
    if slug not in d:
        sys.exit(f"{slags}/{slug} er ikke oversat endnu — læg oversættelsen i src/data/engelsk/{FIL[slags]} først")
    d[slug]["kilde"] = KILDE[slags](dansk)
    gem(slags, d)
    print(f"{slags}/{slug}: fingeraftryk {d[slug]['kilde']} gemt i src/data/engelsk/{FIL[slags]}")
    sys.exit(0)

guides = {x["da_slug"] for x in json.loads((ROD / "src/data/guides-i18n.en.json").read_text(encoding="utf-8"))}
n = 0
for slags in VIEW:
    dansk, d = hent(VIEW[slags]), laes(slags)
    for slug, row in dansk.items():
        if slags == "landing" and (row["kind"] == "guide" or slug == "lockers"):
            if row["kind"] == "guide" and slug not in guides:
                print(f"mangler   guide/{slug} (src/data/guides-i18n.en.json)"); n += 1
            continue
        e = d.get(slug)
        fuld = e and (e.get("body") if slags == "landing" else e.get("story") if slags == "type" else e.get("web_story"))
        if not fuld:
            print(f"mangler   {slags}/{slug}"); n += 1
        elif e.get("kilde") and e["kilde"] != KILDE[slags](row):
            print(f"forældet  {slags}/{slug}  (den danske tekst er rettet efter oversættelsen)"); n += 1
print(f"{n} at gøre" if n else "Alt er oversat og ajour.")
