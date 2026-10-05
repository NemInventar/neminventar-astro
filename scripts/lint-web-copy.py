"""Tekst-lint for neminventar.dk — fanger det, der ikke hører til på en kundevendt side.

Læser de samme views som sitet (v_web_landing_pages, v_web_cases, v_web_products) og melder:
  FEJL  = må aldrig stå udadtil (Kosovo, interne tabel-/tilbudsord, forbudte navne)
  ADVAR = for specifikt / leverandørsprog (mål i mm, mærkenavne på dele, radier, produktkoder)
Kør: python scripts/lint-web-copy.py        (exit 1 ved FEJL)
Nøglen: SUPABASE_ANON_KEY (eller SUPABASE_SERVICE_ROLE_KEY) i miljøet, ellers --anon-key <nøgle>
(den offentlige anon-nøgle — Claude henter den med Supabase MCP get_publishable_keys).
Efter build: python scripts/lint-web-copy.py --dist dist   (kun ADVAR, fejler aldrig): et sagsnavn mere end 3 gange
i den synlige tekst på en side (Joachim 05-10-2026, opmærksomhedspunkt: "Mørkhøj skal nævnes, men ikke 28 gange").
3 = projektkortet + én referencelinje + én sætning. Billedtekster og kortmærker skal ikke bære sagsnavnet.

Reglerne: canon_register "Landingssider pr. søgeord" (Joachim 24-09-2026: ingen underligt
specifikke tekster, ingen kontekst der ikke hører til på en kundevendt side).
"""
import json, os, re, sys, urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
URL = os.environ.get("SUPABASE_URL", "https://guhbrpektblabndqttgp.supabase.co").rstrip("/")
_arg = sys.argv[sys.argv.index("--anon-key") + 1] if "--anon-key" in sys.argv else None
KEY = _arg or os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
DIST = sys.argv[sys.argv.index("--dist") + 1] if "--dist" in sys.argv else None
if not KEY:
    sys.exit("Mangler nøgle: sæt SUPABASE_ANON_KEY eller kør med --anon-key <offentlig anon-nøgle>")

# Sagsnavnets kendeord: første ord, der ikke er en bygningstype ("Daginstitution Vinge" → Vinge).
GENERISK = {"skole", "daginstitution", "skohylder", "til", "idrætshal", "idrætspark"}
MAX_SAGSNAVN = 3

def sagsnavne_i_dist(dist, cases):
    """ADVAR, når et sagsnavn står mere end MAX_SAGSNAVN gange i den synlige tekst på en side.
    Sagens egen side og /projekter/ er undtaget — dér er navnet emnet. Et projektkort (ProjectCard,
    <article class="pcard">) tæller som ÉN omtale, selv om navnet står i både titel og resumé. Elementer med
    aria-hidden="true" tæller ikke (fx tal-stribens kopi, der kun findes for at kunne løbe rundt)."""
    noegler = {}
    for c in cases:
        ord_ = [w for w in re.findall(r"\w+", c["name"]) if w.lower() not in GENERISK]
        if ord_: noegler[c["slug"]] = ord_[0]
    n = 0
    for f in sorted(Path(dist).rglob("index.html")):
        rel = "/" + f.parent.relative_to(dist).as_posix().strip(".") + "/"
        rel = rel.replace("//", "/")
        html = f.read_text(encoding="utf-8", errors="ignore")
        html = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S | re.I)
        html = re.sub(r'<(\w+)[^>]*aria-hidden="true"[^>]*>.*?</\1>', " ", html, flags=re.S)
        kort = re.findall(r'<article class="pcard.*?</article>', html, flags=re.S)
        tekst = re.sub(r"<[^>]+>", " ", re.sub(r'<article class="pcard.*?</article>', " ", html, flags=re.S))
        for slug, ord_ in noegler.items():
            if rel in ("/projekter/", f"/projekter/{slug}/"): continue
            k = len(re.findall(rf"\b{re.escape(ord_)}\b", tekst)) + sum(f"projekter/{slug}" in a for a in kort)
            if k > MAX_SAGSNAVN:
                print(f"ADVAR html{rel} · «{ord_}» står {k} gange (højst {MAX_SAGSNAVN} uden for sagens egen side) — "
                      "vis produktet, ikke sagen")
                n += 1
    return n

if DIST:
    n = sagsnavne_i_dist(DIST, json.loads(urllib.request.urlopen(urllib.request.Request(
        f"{URL}/rest/v1/v_web_cases?select=slug,name", headers={"apikey": KEY, "Authorization": "Bearer " + KEY}), timeout=60).read()))
    print(f"\n0 fejl · {n} advarsler (sagsnavne i {DIST})")
    sys.exit(0)

FEJL = [
    (r"\bKosovo\b|\bFerizaj\b|Korpus\s+SH", "produktionssted nævnes ikke udadtil — skriv 'egen produktion'"),
    # Entreprenør- og arkitektnavne samt sagsnavnet "Sundby Idrætspark" må nævnes (Milot 04-10-2026: alle firmanavne
    # må bruges overalt på sitet). Hvilke navne der vises, styres af show_customer_name/show_architect_name i case_web.
    (r"\bT\d{2}\b|\btilbudslinje|\bquote\b|\bBOM\b|\brumkode", "internt tilbudssprog"),
    (r"\bprojekt(?:nummer|nr)\b|\b2[56]\d{3}\b", "internt sagsnummer"),
    (r"\b(?:paa|foer|moede|faerdig|stoerre|aabn)\w*", "translittereret dansk (aa/oe/ae)"),
]
ADVAR = [
    (r"\d+(?:[,.]\d+)?\s*(?:×|x)\s*\d+|\b\d+(?:[,.]\d+)?\s*mm\b|Ø\s*\d+", "mål i mm — for specifikt til en kundevendt tekst"),
    (r"\bR\d{2}\b", "radius-betegnelse"),
    (r"FunderMax|Forbo|Ecophon|cam-lås|safe-greb|soft-close", "mærke-/beslagsnavn — skriv hvad det gør, ikke hvad det hedder"),
    (r"Oil Plus|PreColou?r|\b2C\b", "Rubio-produktnavn — kun tilladt i overflade-guiden (RUBIO_OK)"),
    (r"\b\d{4}\s+(?:hvid|Olive)\b|\bNCS[- ]?S?\s*\d", "farve-/produktkode"),
    (r"produktionszone", "skolens interne rumbetegnelse"),
    (r"design for disassembly", "engelsk fagjargon"),
    # DGNB må nævnes som noget vi leverer TIL (samme materialevalg og dokumentation som Svanemærket, Joachim 02-10-2026),
    # men inventaret er aldrig selv DGNB-certificeret: DGNB certificerer byggerier.
    (r"(?i)\bDGNB[- ](certificeret|godkendt|mærket)\s+(inventar|produkt|møbel|møbler|skab|skabe)", "DGNB certificerer byggerier, ikke inventar"),
    (r"(?i)\b(unik|førende|banebrydende|i verdensklasse|skræddersyet løsning|passion|innovativ)\w*", "marketing-floskel (brand-tone: ingen superlativer)"),
]

def get(view, cols):
    r = urllib.request.Request(f"{URL}/rest/v1/{view}?select={cols}", headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
    return json.loads(urllib.request.urlopen(r, timeout=60).read())

MM_RULE = ADVAR[0][0]
RUBIO_RULE = ADVAR[3][0]
# Overflade-guiden må nævne og linke Rubio Monocoats produkter (Joachim 02-10-2026: "det er ok vi linker til dem").
RUBIO_OK = {"bejdset-olieret-eller-lakeret"}

def mm_allowed(row, field, item):
    # Guides må forklare pladetykkelser, og et FAQ-svar på et spørgsmål OM tykkelse må give tallet.
    return row.get("kind") == "guide" or (field == "faq" and isinstance(item, dict) and "tyk" in item.get("q", "").lower())

def texts(row, fields):
    """Giver (feltnavn, tekst, mm_tilladt) for alle tekstfelter, også inde i jsonb-lister."""
    for f in fields:
        v = row.get(f)
        if isinstance(v, str): yield f, v, row.get("kind") == "guide"
        elif isinstance(v, list):
            for i, x in enumerate(v):
                if isinstance(x, dict):
                    for k, s in x.items():
                        if isinstance(s, str) and k not in ("src", "kind"): yield f"{f}[{i}].{k}", s, mm_allowed(row, f, x)
                elif isinstance(x, str) and f != "keywords": yield f"{f}[{i}]", x, False

SOURCES = [
    ("side", "v_web_landing_pages", "slug,kind,h1,lead,body,highlights,faq,seo_title,seo_description,images",
     ["h1", "lead", "body", "highlights", "faq", "seo_title", "seo_description", "images"]),
    ("case", "v_web_cases", "slug,name,hero_tagline,web_summary,web_story,delivery_label,seo_title,seo_description,gallery",
     ["name", "hero_tagline", "web_summary", "web_story", "delivery_label", "seo_title", "seo_description", "gallery"]),
    ("produkt", "v_web_products", "slug,name,hero_tagline,intro,story,seo_title,seo_description",
     ["name", "hero_tagline", "intro", "story", "seo_title", "seo_description"]),
]

n_err = n_warn = 0
for label, view, cols, fields in SOURCES:
    for row in get(view, cols):
        for field, s, mm_ok in texts(row, fields):
            for rules, level in ((FEJL, "FEJL "), (ADVAR, "ADVAR")):
                for pat, why in rules:
                    if pat == MM_RULE and mm_ok: continue
                    if pat == RUBIO_RULE and label == "side" and row["slug"] in RUBIO_OK: continue
                    for m in re.finditer(pat, s):
                        ctx = s[max(0, m.start() - 35):m.end() + 35].replace("\n", " ")
                        print(f"{level} {label}/{row['slug']} · {field}: «{m.group(0)}» — {why}\n        …{ctx}…")
                        if level == "FEJL ": n_err += 1
                        else: n_warn += 1
print(f"\n{n_err} fejl · {n_warn} advarsler")
sys.exit(1 if n_err else 0)
