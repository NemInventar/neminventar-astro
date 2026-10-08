"""Bevis for D4 (/inventar + varianter). Kører mod lokal dist (python -m http.server) eller en preview-URL:
  python scripts/test_inventar_varianter.py
  python scripts/test_inventar_varianter.py https://inventar-varianter.neminventar-preview.pages.dev/
Intet sendes: POST til contact-form opfanges og besvares med success, så vi kan se, hvad formularen ville sende."""
import json, re, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
DIST = Path(__file__).resolve().parent.parent / "dist"
REMOTE = sys.argv[1].rstrip("/") + "/" if len(sys.argv) > 1 else None
srv = None if REMOTE else subprocess.Popen([sys.executable, "-m", "http.server", "8773", "--bind", "127.0.0.1", "-d", str(DIST)],
                                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0 if REMOTE else 1.2)
URL = REMOTE or "http://127.0.0.1:8773/"
TYPE = "hoejskab-krydsfiner"
ok = fejl = 0


def tjek(navn, c, info=""):
    global ok, fejl
    if c:
        ok += 1; print("ok  ", navn)
    else:
        fejl += 1; print("FEJL", navn, info)


def fang_post(page, sendt):
    def h(route):
        if route.request.method == "POST":
            try:
                sendt.append(json.loads(route.request.post_data or "{}"))
            except Exception:
                sendt.append({})
            route.fulfill(status=200, content_type="application/json", body='{"success":true,"files":0}')
        else:
            route.continue_()
    page.route("**/functions/v1/contact-form", h)


def udfyld_og_send(page, scope):
    page.fill(f"{scope} #cf-name", "Test Testesen")
    page.fill(f"{scope} #cf-company", "Test ApS")
    page.fill(f"{scope} #cf-email", "test@example.com")
    page.wait_for_timeout(3100)  # tidsfælden: under 3 s giver intet lead
    page.locator(f"{scope} form.form button[type=submit]").click()
    page.wait_for_selector(f"{scope} .form-done")


try:
    with sync_playwright() as p:
        b = p.chromium.launch()

        # 0 · uden JS: alle kort, ingen filtre
        ctx = b.new_context(java_script_enabled=False, viewport={"width": 1440, "height": 900})
        pg = ctx.new_page()
        pg.goto(URL + "inventar", wait_until="domcontentloaded")
        n = pg.locator("#types .tcard:visible").count()
        tjek("uden JS: alle kort vises", n >= 15, n)
        tjek("uden JS: filtrene er skjulte", not pg.locator("#filters").is_visible())

        # 0b · et kort viser det billede, typesiden åbner på (Fable 06-10: et kort fører til det, det viser)
        def kilde(src):  # samme billede uanset bredde: stien uden render/-led og uden ?width=
            s = (src or "").split("?")[0].replace("/render/image/", "/object/")
            # lokale kopier (lokale-billeder): /_b/<navn>-<kilde-id>-w800.webp → /_b/<navn>-<kilde-id>
            return re.sub(r"-(?:w\d+|x|orig)(?:-[0-9a-f]{6})?\.[a-z0-9]+$", "", s) if "/_b/" in s else s
        kort = pg.eval_on_selector_all("#types .tcard", "ks => ks.map(k => [k.querySelector('a.ph').getAttribute('href'), (k.querySelector('img')||{}).getAttribute?.('src')])")
        skaev = []
        for href, src in kort:
            pg.goto(URL.rstrip("/") + href if href.startswith("/") else URL + href, wait_until="domcontentloaded")
            hoved = pg.locator("#main-img").get_attribute("src") if pg.locator("#main-img").count() else None
            if kilde(src) != kilde(hoved):
                skaev.append(href.rsplit("/", 1)[-1])
        tjek(f"kortbillede = typesidens hovedbillede ({len(kort)} kort)", len(kort) >= 15 and not skaev, skaev)

        # 0c · "Det laver vi": én slags link pr. række
        pg.goto(URL, wait_until="domcontentloaded")
        raekker = pg.eval_on_selector_all("#ydelser .yd-row", "rs => rs.map(r => r.querySelector('.lbl').textContent.trim())")
        tjek("Det laver vi: Typer, Inventar, Materialer, Til, Sådan arbejder vi, Guides",
             raekker == ["Typer:", "Inventar:", "Materialer:", "Til:", "Sådan arbejder vi:", "Guides:"], raekker)
        typer_ud = pg.eval_on_selector_all("#ydelser .yd-row:first-of-type a.pill", "as => as.every(a => a.getAttribute('href').includes('/produkter/'))")
        tjek("Det laver vi: Typer-rækken fører kun til typesider", typer_ud)
        ctx.close()

        for vw, vh, tag in [(1440, 900, "pc"), (390, 844, "mob")]:
            ctx = b.new_context(viewport={"width": vw, "height": vh})
            page = ctx.new_page()
            jsfejl = []
            page.on("pageerror", lambda e: jsfejl.append(str(e)))
            page.on("console", lambda m: jsfejl.append(m.text) if m.type == "error" and "plausible" not in m.text and "ERR_FAILED" not in m.text else None)
            sendt = []
            fang_post(page, sendt)
            # Forsidens 3D (designerens indlejring) har sin egen test (test_forside_designer.py). Her blokeres den, så
            # software-rendering i headless ikke tager CPU'en fra resten; siden falder tilbage til stillbilledet.
            ctx.route("**/designer.neminventar.dk/**", lambda r: r.abort())

            # 1 · /inventar og filtrene
            page.goto(URL + "inventar", wait_until="networkidle")
            n_alle = page.locator("#types .tcard:visible").count()
            tjek(f"[{tag}] /inventar viser alle typer", n_alle >= 15, n_alle)
            tjek(f"[{tag}] filtrene er synlige", page.locator("#filters").is_visible())
            page.locator('#filters .fchip[data-f="skabe"]').click()
            n_skabe = page.locator("#types .tcard:visible").count()
            fremmede = page.locator('#types .tcard:visible:not([data-fam="skabe"])').count()
            tjek(f"[{tag}] filtret Højskabe viser kun familien", 0 < n_skabe < n_alle and fremmede == 0, (n_skabe, n_alle, fremmede))
            tjek(f"[{tag}] /inventar: ingen vandret scroll", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))

            # 2 · typesiden: én vælger, knappen følger valget
            page.goto(URL + f"produkter/{TYPE}", wait_until="networkidle")
            n_v = page.locator(".vtile").count()
            tjek(f"[{tag}] {TYPE} har en vælger med varianter", n_v >= 2, n_v)
            tjek(f"[{tag}] ingen gamle farveknapper/miniaturer", page.locator(".swatch, .thumb").count() == 0)
            tile = page.locator(".vtile").nth(1)
            label = tile.get_attribute("data-label")
            tile.click()
            knap = page.locator("#pris-knap")
            tjek(f"[{tag}] knappen siger den valgte kulør", (label or "") in knap.inner_text(), (label, knap.inner_text()))
            tjek(f"[{tag}] knappen bærer varianten", f"v={TYPE}~" in (knap.get_attribute("href") or ""), knap.get_attribute("href"))
            tjek(f"[{tag}] foto fra leverancen står for sig", page.locator(".pd-foto").count() == 1)
            tjek(f"[{tag}] brødkrummen peger på /inventar", page.locator('.crumbrow a[href$="inventar"]').count() == 1)
            tjek(f"[{tag}] typesiden: ingen vandret scroll", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))

            # 3 · dybt link vælger varianten
            page.goto(URL + f"produkter/{TYPE}#v-blaa", wait_until="networkidle")
            tjek(f"[{tag}] #v-blaa vælger Blå", "Blå" in page.locator("#pris-knap").inner_text(), page.locator("#pris-knap").inner_text())

            # 4 · kontaktsiden med ?v= sender spor variant + konfiguration
            page.locator("#pris-knap").click()
            page.wait_for_url(re.compile(r"/kontakt/?\?"))  # serveren må gerne tilføje en skråstreg
            page.wait_for_function("document.querySelector('#cf-message') && document.querySelector('#cf-message').value.startsWith('Vedr. ')")
            udfyld_og_send(page, "body")
            body = sendt[-1] if sendt else {}
            k = body.get("konfiguration") or {}
            tjek(f"[{tag}] kontaktsiden: spor variant", body.get("spor") == "variant", body.get("spor"))
            tjek(f"[{tag}] kontaktsiden: konfigurationen", k.get("type") == "variant" and k.get("produkt") == TYPE and k.get("kuloer") == "blaa", k)

            # 5 · forsiden: inspirationens knap åbner Send os materialet med varianten
            sendt.clear()
            page.goto(URL, wait_until="networkidle")
            cta = page.locator("#inventar a.mt-cta[data-variant]:visible").first  # små fliser skjuler knappen på telefon
            cta.scroll_into_view_if_needed()
            cta.hover()
            cta.click()
            page.wait_for_selector("#send.on #cf-message")
            page.wait_for_function("document.querySelector('#send #cf-message').value.startsWith('Vedr. ')")
            tjek(f"[{tag}] forsiden: bliver på forsiden", "/kontakt" not in page.url, page.url)
            udfyld_og_send(page, "#send")
            body = sendt[-1] if sendt else {}
            k = body.get("konfiguration") or {}
            tjek(f"[{tag}] forsiden: spor variant", body.get("spor") == "variant", body.get("spor"))
            tjek(f"[{tag}] forsiden: konfigurationen", k.get("type") == "variant" and bool(k.get("produkt")), k)

            tjek(f"[{tag}] ingen JS-fejl", not jsfejl, jsfejl[:3])
            ctx.close()
        b.close()
finally:
    if srv:
        srv.terminate()

print(f"\n{ok} ok · {fejl} fejl")
sys.exit(1 if fejl else 0)
