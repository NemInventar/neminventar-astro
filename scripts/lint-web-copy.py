"""Tekst-lint for neminventar.dk — fanger det, der ikke hører til på en kundevendt side.

Læser de samme views som sitet (v_web_landing_pages, v_web_cases, v_web_products) og melder:
  FEJL  = må aldrig stå udadtil (Kosovo, interne tabel-/tilbudsord, forbudte navne)
  ADVAR = for specifikt / leverandørsprog (mål i mm, mærkenavne på dele, radier, produktkoder)
Kør: python scripts/lint-web-copy.py        (exit 1 ved FEJL)
Kræver SUPABASE_URL + SUPABASE_ANON_KEY (eller SUPABASE_SERVICE_ROLE_KEY) i miljøet.

Reglerne: canon_register "Landingssider pr. søgeord" (Joachim 24-09-2026: ingen underligt
specifikke tekster, ingen kontekst der ikke hører til på en kundevendt side).
"""
import json, os, re, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ["SUPABASE_SERVICE_ROLE_KEY"]

FEJL = [
    (r"\bKosovo\b|\bFerizaj\b|Korpus\s+SH", "produktionssted nævnes ikke udadtil — skriv 'egen produktion'"),
    (r"\bJSP\b", "entreprenør må ikke nævnes"),
    (r"\bSundby\b", "sagsnavn kræver tilladelse — brug det anonymiserede navn"),
    (r"\bT\d{2}\b|\btilbudslinje|\bquote\b|\bBOM\b|\brumkode", "internt tilbudssprog"),
    (r"\bprojekt(?:nummer|nr)\b|\b2[56]\d{3}\b", "internt sagsnummer"),
    (r"\b(?:paa|foer|moede|faerdig|stoerre|aabn)\w*", "translittereret dansk (aa/oe/ae)"),
]
ADVAR = [
    (r"\d+(?:[,.]\d+)?\s*(?:×|x)\s*\d+|\b\d+(?:[,.]\d+)?\s*mm\b|Ø\s*\d+", "mål i mm — for specifikt til en kundevendt tekst"),
    (r"\bR\d{2}\b", "radius-betegnelse"),
    (r"FunderMax|Forbo|Ecophon|Oil Plus|PreColour|\b2C\b|cam-lås|safe-greb|soft-close", "mærke-/beslagsnavn — skriv hvad det gør, ikke hvad det hedder"),
    (r"\b\d{4}\s+(?:hvid|Olive)\b|\bNCS[- ]?S?\s*\d", "farve-/produktkode"),
    (r"produktionszone", "skolens interne rumbetegnelse"),
    (r"design for disassembly", "engelsk fagjargon"),
    (r"\bDGNB\b", "påstand uden kilde (ingen DGNB-sag)"),
    (r"(?i)\b(unik|førende|banebrydende|i verdensklasse|skræddersyet løsning|passion|innovativ)\w*", "marketing-floskel (brand-tone: ingen superlativer)"),
]

def get(view, cols):
    r = urllib.request.Request(f"{URL}/rest/v1/{view}?select={cols}", headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
    return json.loads(urllib.request.urlopen(r, timeout=60).read())

MM_RULE = ADVAR[0][0]

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
                    for m in re.finditer(pat, s):
                        ctx = s[max(0, m.start() - 35):m.end() + 35].replace("\n", " ")
                        print(f"{level} {label}/{row['slug']} · {field}: «{m.group(0)}» — {why}\n        …{ctx}…")
                        if level == "FEJL ": n_err += 1
                        else: n_warn += 1
print(f"\n{n_err} fejl · {n_warn} advarsler")
sys.exit(1 if n_err else 0)
