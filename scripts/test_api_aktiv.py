"""Browsertest af API_AKTIV = true (src/lib/api.ts): Plausible og formularen via proxyen, og fallback.
Intet sendes: alle POST/PUT til formular og upload og alle Plausible-events opfanges og besvares lokalt.
Kun Plausible-scriptet hentes rigtigt (fra proxyen, og fra plausible.io i fallback-testen).

  python scripts/test_api_aktiv.py <site> [api]
    site: en build med API_AKTIV = true — fx en forhåndsvisning (https://<branch>.neminventar-preview.pages.dev)
          eller lokal dist (python -m http.server 8790 -d dist → http://127.0.0.1:8790)
    api:  den API_BASE buildet er lavet med (standard https://api.neminventar.dk)
Lokal dist åbnes som http://proxytest.neminventar.dk:<port>/ (mappes til 127.0.0.1), så Plausible ikke ignorerer localhost.
"""
import json, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
if len(sys.argv) < 2:
    sys.exit(__doc__)
_u = urlparse(sys.argv[1])
API = (sys.argv[2] if len(sys.argv) > 2 else "https://api.neminventar.dk").rstrip("/")
LOKAL = _u.hostname in ("127.0.0.1", "localhost")
HOST = "proxytest.neminventar.dk" if LOKAL else _u.hostname
SITE = f"{_u.scheme}://{HOST}" + (f":{_u.port}" if _u.port else "")
print("Site", SITE, "· API", API)
SUPA = "https://guhbrpektblabndqttgp.supabase.co"
PA = "https://plausible.io/js/pa-HNaluSTt8ee5v0U7h3J8z.js"
CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, PUT, OPTIONS"}
ok = fejl = 0


def tjek(navn, cond, info=""):
    global ok, fejl
    if cond:
        ok += 1; print("ok  ", navn)
    else:
        fejl += 1; print("FEJL", navn, info)


# Første lag: fetch til */api/event besvares i siden selv, før noget forlader browseren (også keepalive-kald).
# window.__plausible = true: trackeren ignorerer ellers automatiserede browsere (navigator.webdriver).
STOP_EVENTS = """(() => { const f = window.fetch; window.__events = []; window.__plausible = true;
  window.fetch = function (u, o) { const s = String((u && u.url) || u);
    if (/\\/api\\/event$/.test(s)) { window.__events.push(s); return Promise.resolve(new Response('ok', { status: 202 })); }
    return f.apply(this, arguments); }; })();"""


def ny(b):
    ctx = b.new_context()
    ctx.add_init_script(STOP_EVENTS)
    page = ctx.new_page()
    return ctx, page


def fang_events(page, log):
    # Andet lag: skulle et event alligevel nå nettet, besvares det lokalt — intet tælles.
    def h(route):
        log.append(route.request.url)
        route.fulfill(status=202, body="ok", headers=CORS)
    page.route("**/api/event", h)


def events_i_siden(page):
    return page.evaluate("window.__events || []")


with sync_playwright() as p:
    b = p.chromium.launch(args=[f"--host-resolver-rules=MAP {HOST} 127.0.0.1"] if LOKAL else [])

    # 1 · Plausible via proxyen: scriptet fra API/js/script.js, events til API/api/event
    ctx, page = ny(b)
    events, scripts = [], []
    fang_events(page, events)
    page.on("response", lambda r: scripts.append((r.url, r.status)) if r.url.endswith(".js") and ("plausible" in r.url or "/js/script.js" in r.url) else None)
    page.goto(SITE + "/", wait_until="load")
    page.wait_for_timeout(2500)
    tjek("Plausible: script hentet fra proxyen", (API + "/js/script.js", 200) in scripts, scripts)
    tjek("Plausible: plausible.io ikke brugt", not any("plausible.io" in u for u, _ in scripts), scripts)
    ev = events_i_siden(page)
    tjek("Plausible: pageview sendt til proxyen (opfanget i siden)", API + "/api/event" in ev, ev)
    tjek("Plausible: intet event nåede nettet", events == [], events)
    tjek("Plausible: scriptet er indlæst (plausible.l)", page.evaluate("!!(window.plausible && window.plausible.l)"))
    ctx.close()

    # 2 · Proxy-scriptet blokeret → plausible.io for både script og events
    ctx, page = ny(b)
    events, scripts = [], []
    fang_events(page, events)
    page.route(API + "/js/script.js", lambda r: r.abort())
    page.on("response", lambda r: scripts.append((r.url, r.status)) if "plausible.io/js/" in r.url else None)
    page.goto(SITE + "/", wait_until="load")
    page.wait_for_timeout(2500)
    tjek("Fallback: script fra plausible.io", (PA, 200) in scripts, scripts)
    ev = events_i_siden(page)
    tjek("Fallback: pageview til plausible.io (opfanget i siden)", "https://plausible.io/api/event" in ev, ev)
    tjek("Fallback: intet event til proxyen", not any(u.startswith(API) for u in ev), ev)
    tjek("Fallback: intet event nåede nettet", events == [], events)
    ctx.close()

    # 3 · Formularen
    def formular(api_svar, supa_svar=None, fil=None, put_api="ok"):
        ctx, page = ny(b)
        fang_events(page, [])
        kald = []

        def cf(route):
            r = route.request
            if r.method != "POST":
                return route.continue_()
            body = json.loads(r.post_data or "{}")
            via = "api" if r.url.startswith(API) else "supa" if r.url.startswith(SUPA) else r.url
            kald.append((via, body.get("action") or "besked"))
            svar = api_svar if via == "api" else supa_svar
            if svar == "abort":
                return route.abort("failed")
            if body.get("action") == "upload-urls":
                return route.fulfill(status=200, headers=CORS, content_type="application/json", body=json.dumps({
                    "success": True, "upload_id": "u1",
                    "files": [{"name": "test.txt", "size": 4, "path": "2026-10/u1/test.txt",
                               "url": f"{SUPA}/storage/v1/object/upload/sign/web-henvendelser/2026-10/u1/test.txt?token=T", "token": "T"}]}))
            if svar == 500:
                return route.fulfill(status=500, headers=CORS, content_type="application/json", body='{"error":"Serverfejl (test)"}')
            return route.fulfill(status=200, headers=CORS, content_type="application/json", body='{"success":true,"files":1}')
        page.route("**/contact-form", cf)

        puts = []
        def up(route):
            r = route.request
            if r.method != "PUT":
                return route.continue_()
            via = "api" if r.url.startswith(API) else "supa"
            puts.append((via, r.url))
            if via == "api" and put_api == "abort":
                return route.abort("failed")
            return route.fulfill(status=200, headers=CORS, content_type="application/json", body='{"Key":"x"}')
        page.route("**/storage/v1/object/upload/sign/**", up)

        page.goto(SITE + "/kontakt/", wait_until="load")
        page.wait_for_selector("#cf-name")
        page.fill("#cf-name", "Test Testesen")
        page.fill("#cf-company", "Test ApS")
        page.fill("#cf-email", "test@example.com")
        page.fill("#cf-message", "E2E-test af API_AKTIV (opfanget, intet sendes)")
        if fil:
            page.set_input_files("#cf-files", files=[{"name": "test.txt", "mimeType": "text/plain", "buffer": b"test"}])
        page.locator("form.form button[type=submit]").click()
        page.wait_for_selector(".form-done, .form-msg.err", timeout=15000)
        done = page.locator(".form-done").count() > 0
        err = page.locator(".form-msg.err").inner_text() if not done else ""
        ctx.close()
        return kald, puts, done, err

    kald, puts, done, err = formular("ok")
    tjek("Formular: via proxyen, ét kald, sendt", kald == [("api", "besked")] and done, (kald, err))

    kald, puts, done, err = formular("abort", "ok")
    tjek("Formular: netværksfejl på proxyen → supabase.co én gang", kald == [("api", "besked"), ("supa", "besked")] and done, (kald, err))

    kald, puts, done, err = formular(500, "ok")
    tjek("Formular: HTTP 500 fra proxyen → intet nyt forsøg, fejl vises", kald == [("api", "besked")] and not done and "Serverfejl" in err, (kald, err))

    kald, puts, done, err = formular("abort", "abort")
    tjek("Formular: netværksfejl begge steder → to kald, fejl vises", kald == [("api", "besked"), ("supa", "besked")] and not done, (kald, err))

    kald, puts, done, err = formular("ok", fil=True)
    tjek("Upload: upload-urls + besked via proxyen", kald == [("api", "upload-urls"), ("api", "besked")] and done, (kald, err))
    tjek("Upload: PUT til proxyen med token", len(puts) == 1 and puts[0][0] == "api" and puts[0][1] == f"{API}/storage/v1/object/upload/sign/web-henvendelser/2026-10/u1/test.txt?token=T", puts)

    kald, puts, done, err = formular("ok", fil=True, put_api="abort")
    tjek("Upload: netværksfejl på PUT via proxyen → én gang direkte", [v for v, _ in puts] == ["api", "supa"] and done, (puts, err))

    kald, puts, done, err = formular("abort", "ok", fil=True)
    tjek("Upload: upload-urls faldt tilbage → filen direkte til supabase.co", [v for v, _ in puts] == ["supa"] and done and kald[0] == ("api", "upload-urls") and kald[1] == ("supa", "upload-urls"), (kald, puts, err))

    # 4 · "Bestil et opkald"
    ctx, page = ny(b)
    fang_events(page, [])
    kald = []
    def cb(route):
        if route.request.method != "POST":
            return route.continue_()
        kald.append("api" if route.request.url.startswith(API) else "supa")
        if kald[-1] == "api":
            return route.abort("failed")
        route.fulfill(status=200, headers=CORS, content_type="application/json", body='{"success":true}')
    page.route("**/contact-form", cb)
    page.goto(SITE + "/kontakt/", wait_until="load")
    knap = page.get_by_role("button", name="Bestil et opkald")
    if knap.count():
        knap.first.click()
    if page.locator("#cb-name").count():
        page.fill("#cb-name", "Test Testesen")
        page.fill("#cb-phone", "12345678")
        page.locator("form.callback-form button[type=submit]").click()
        page.wait_for_selector(".callback-form .form-done, .callback-form .form-msg.err", timeout=15000)
        tjek("Opkald: netværksfejl på proxyen → supabase.co én gang", kald == ["api", "supa"] and page.locator(".callback-form .form-done").count() == 1, kald)
    else:
        print("     (ingen opkaldsformular på /kontakt/ — springer over)")
    ctx.close()
    b.close()

print(f"\n{ok}/{ok + fejl} ok")
sys.exit(1 if fejl else 0)
