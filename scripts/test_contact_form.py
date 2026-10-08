"""Test af contact-form v9 uden at skrive eller sende noget (dry_run=true).

  python scripts/test_contact_form.py [URL]

URL er valgfri: standard er funktionen direkte på supabase.co. Proxyen testes med fx
  python scripts/test_contact_form.py https://neminventar-api.pages.dev/contact-form

Kalder den deployede funktion med origin https://neminventar.dk og tjekker:
  - GET svarer version 9
  - de seks svar på "Hvor fandt I os?" + tomt svar med referrer → lead_kanal efter CHECK-reglen
  - for hurtig udfyldning → mistanke, intet lead
  - honeypot (website og hp) → success uden noget
  - tre links til udbudsmateriale → ingen mistanke (v9: grænsen er 6)
  - et v5-kald uden de nye felter → kanal Ukendt, ingen mistanke (bagudkompatibelt)
"""
import json, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
URL = sys.argv[1] if len(sys.argv) > 1 else "https://guhbrpektblabndqttgp.supabase.co/functions/v1/contact-form"
print("Tester", URL)
# Browser-agtig User-Agent: Cloudflare (pages.dev, api.neminventar.dk) afviser "Python-urllib" med fejl 1010.
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) test_contact_form.py"}
HDR = {"Content-Type": "application/json", "Origin": "https://neminventar.dk", **UA}
BASE = {"name": "Test Testesen", "company": "Testfirma", "email": "test@example.com", "message": "Test af kilde (dry_run)", "side": "/kontakt/", "dry_run": True}


def post(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers=HDR, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


ok = fejl = 0
def tjek(navn, cond, info=""):
    global ok, fejl
    if cond: ok += 1; print("ok  ", navn)
    else: fejl += 1; print("FEJL", navn, info)

with urllib.request.urlopen(urllib.request.Request(URL, headers={"Origin": "https://neminventar.dk", **UA}), timeout=30) as r:
    g = json.loads(r.read().decode())
tjek("GET version 9", g.get("version") == 9, g)

CASES = [
    ({"kilde_svar": "Google", "referrer_host": "chatgpt.com"}, "Google"),
    ({"kilde_svar": "ChatGPT eller anden AI"}, "ChatGPT/AI"),
    ({"kilde_svar": "Anbefaling"}, "Anbefaling"),
    ({"kilde_svar": "LinkedIn"}, "LinkedIn"),
    ({"kilde_svar": "Vi har arbejdet sammen før"}, "Relation"),
    ({"kilde_svar": "Andet"}, "Andet"),
    ({"kilde_svar": "", "referrer_host": "chatgpt.com"}, "ChatGPT/AI"),
    ({"kilde_svar": "", "referrer_host": "www.google.dk"}, "Google"),
    ({"kilde_svar": "", "referrer_host": ""}, "Ukendt"),
]
for extra, want in CASES:
    d = post({**BASE, "ms": 9000, "spor": "skitse", "landingsside": "/lockers/", **extra})
    tjek(f"kanal {extra} → {want}", d.get("kanal") == want and d.get("lead", {}).get("lead_kanal") == want, d.get("kanal"))

d = post({**BASE, "ms": 9000, "spor": "udbud"})
lead = d.get("lead") or {}
tjek("lead-række: stage/created_by/assigned_to/source", (lead.get("pipeline_stage"), lead.get("created_by"), lead.get("assigned_to"), lead.get("source_channel")) == ("lead", "claude_auto", "milot", "Hjemmeside: formular"), lead)
tjek("spor udbud følger med", d.get("spor") == "udbud" and "udbud" in lead.get("tags", []), d.get("spor"))

d = post({**BASE, "ms": 800})
tjek("hurtig udfyldning → mistanke, intet lead", d.get("mistanke") is True and d.get("lead") is None, d)

for felt in ("website", "hp"):
    d = post({**BASE, felt: "http://spam"})
    tjek(f"honeypot {felt} → success uden dry_run-svar", d.get("success") is True and "dry_run" not in d, d)

d = post({**BASE, "ms": 9000, "message": "Tegninger: https://dalux.com/x https://ibinder.com/y https://byggefakta.dk/z"})
tjek("tre links → ingen mistanke, lead", d.get("mistanke") is False and d.get("lead") is not None, d)

d = post({k: v for k, v in BASE.items()})
tjek("v5-kald uden nye felter → Ukendt, ingen mistanke", d.get("kanal") == "Ukendt" and d.get("mistanke") is False and d.get("spor") == "besked", d)

print(f"\n{ok}/{ok + fejl} ok")
sys.exit(1 if fejl else 0)
