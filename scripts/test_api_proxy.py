"""Røgtest af proxyen bag api.neminventar.dk (api/public/_worker.js). Sender intet rigtigt.
  python scripts/test_api_proxy.py                                     (https://api.neminventar.dk)
  python scripts/test_api_proxy.py https://neminventar-api.pages.dev
  python scripts/test_api_proxy.py https://<branch>.neminventar-api.pages.dev
--event sender ÉT pageview-event til /api/event (tæller én visning i Plausible på /proxy-test).
Formularen testes fuldt med: python scripts/test_contact_form.py <base>/contact-form (kun dry_run/honeypot).
"""
import json, sys, urllib.request, urllib.error

sys.stdout.reconfigure(encoding="utf-8")
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = (ARGS[0] if ARGS else "https://api.neminventar.dk").rstrip("/")
print("Tester", BASE)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
ok = fejl = 0


def tjek(navn, cond, info=""):
    global ok, fejl
    if cond:
        ok += 1; print("ok  ", navn)
    else:
        fejl += 1; print("FEJL", navn, info)


def kald(sti, method="GET", headers=None, data=None):
    req = urllib.request.Request(BASE + sti, data=data, headers={"User-Agent": UA, **(headers or {})}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, dict((k.lower(), v) for k, v in r.headers.items()), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict((k.lower(), v) for k, v in e.headers.items()), e.read()


# 1. GET /contact-form med Origin → version 9 og CORS for neminventar.dk
s, h, b = kald("/contact-form", headers={"Origin": "https://neminventar.dk"})
d = json.loads(b or b"{}")
tjek("GET /contact-form → version 9", s == 200 and d.get("version") == 9, (s, b[:200]))
tjek("CORS: allow-origin = neminventar.dk", h.get("access-control-allow-origin") == "https://neminventar.dk", h)

s, h, b = kald("/contact-form", headers={"Origin": "https://www.neminventar.dk"})
tjek("CORS: www-origin spejles af funktionen", h.get("access-control-allow-origin") == "https://www.neminventar.dk", h.get("access-control-allow-origin"))

# 2. OPTIONS /contact-form (preflight)
s, h, b = kald("/contact-form", "OPTIONS", {"Origin": "https://neminventar.dk", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
tjek("OPTIONS /contact-form → 2xx med CORS", 200 <= s < 300 and h.get("access-control-allow-origin") == "https://neminventar.dk" and "POST" in h.get("access-control-allow-methods", ""), (s, h))

# 3. Upload-ruten: preflight og et PUT med ugyldigt token (Storage afviser; intet gemmes)
sti = "/storage/v1/object/upload/sign/web-henvendelser/proxy-test/x.txt?token=ugyldigt"
s, h, b = kald(sti, "OPTIONS", {"Origin": "https://neminventar.dk", "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type"})
tjek("OPTIONS upload → 2xx med CORS fra Storage", 200 <= s < 300 and h.get("access-control-allow-origin") in ("*", "https://neminventar.dk"), (s, h))
s, h, b = kald(sti, "PUT", {"Origin": "https://neminventar.dk", "Content-Type": "text/plain"}, b"proxy-test")
tjek("PUT upload med ugyldigt token → Storage afviser (4xx), svaret kommer igennem", 400 <= s < 500 and b"" != b, (s, b[:200]))
print("     Storage svarede:", s, b[:160])

# 4. Plausible-scriptet
s, h, b = kald("/js/script.js")
tjek("GET /js/script.js → JS", s == 200 and "javascript" in h.get("content-type", "") and b"plausible" in b, (s, h.get("content-type"), b[:80]))
tjek("script: cache 1 dag", "max-age=86400" in h.get("cache-control", ""), h.get("cache-control"))
tjek("script: domain neminventar.dk", b'domain:"neminventar.dk"' in b)

# 5. Alt andet er 404
for sti, m in [("/", "GET"), ("/functions/v1/contact-form", "GET"), ("/rest/v1/v_web_products", "GET"),
               ("/storage/v1/object/public/quote-renders/x.png", "GET"), ("/api/event", "GET"), ("/contact-form", "PUT"),
               ("/js/pa-HNaluSTt8ee5v0U7h3J8z.js", "GET")]:
    s, h, b = kald(sti, m, data=b"x" if m in ("PUT", "POST") else None)
    tjek(f"{m} {sti} → 404", s == 404, s)

# 6. ÉT testevent (kun med --event)
if "--event" in sys.argv:
    ev = json.dumps({"name": "pageview", "url": "https://neminventar.dk/proxy-test", "domain": "neminventar.dk"}).encode()
    s, h, b = kald("/api/event", "POST", {"Content-Type": "text/plain"}, ev)
    tjek("POST /api/event → 202", s == 202, (s, b[:200]))
    print("     Plausible svarede:", s, b[:80])

print(f"\n{ok}/{ok + fejl} ok")
sys.exit(1 if fejl else 0)
