# D1 · Konverteringslaget — implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hver henvendelse fra neminventar.dk bliver et lead i CRM med kilden udfyldt: formular, mailto og "Bestil et opkald".

**Architecture:** Formularen fanger kilden ved første sidevisning (sessionStorage) og spørger "Hvor fandt I os?". Edge-funktionen `contact-form` v6 mapper kilden til `lead_kanal` (ren TS-modul `lead.ts`, testet med `node --test`), opretter et lead best effort og deduplikerer 30 dage. Mailto-links får et emne med sidens navn. Bagudkompatibelt: v5-kald virker uændret.

**Tech Stack:** Astro 6 + React 19 (formularen), Supabase Edge Function (Deno), Postgres, Plausible, Node 24 `node --test` (type stripping).

**Spec:** `docs/superpowers/specs/2026-10-05-ny-forside-design.md` §4. **Gren:** `konvertering` fra `origin/main` i `C:\dev\neminventar-astro`.

---

## Filkort

| Fil | Ansvar |
|---|---|
| `src/lib/kilde.ts` (ny) | Første sidevisning → `{referrer_host, landingsside, utm}` i sessionStorage, `KILDE_SVAR`, `mailtoMedEmne()` — ingen Astro-imports, så den kan testes i node |
| `src/lib/kilde.test.ts` (ny) | node-test af `kilde.ts` |
| `src/components/ContactForm.tsx` | v2-udgaven (filer) + `spor`-prop, "Hvor fandt I os?", attribution, tidsfælde, Plausible-mål |
| `src/components/CallbackForm.tsx` | sender første-sidevisningens referrer i stedet for `document.referrer` ved afsendelse |
| `src/layouts/Base.astro` | indlæser `kilde.ts` (fang første sidevisning + skriv emne på mailto-links) |
| `src/styles/site.css` | dropzone/filliste-CSS fra v2 + `.kilde`-feltet |
| `supabase/functions/contact-form/lead.ts` (ny) | `mapKanal`, `byggLead`, `erMistaenkelig` — rene funktioner |
| `supabase/functions/contact-form/lead.test.ts` (ny) | node-test af `lead.ts` |
| `supabase/functions/contact-form/index.ts` | v5 fra `forside-v2` → v6: nye felter, `dry_run`, lead + dedup + rate-limit, `[CRM id8]` |
| `sql/2026-10-05-web-henvendelser-kilde.sql` (ny) | nye kolonner på `web_henvendelser_2026_10_04` (kun ADD COLUMN) |
| `src/pages/privatlivspolitik.astro`, `src/pages/cookiepolitik.astro` | én linje hver |
| `scripts/test_contact_form.py` (ny) | dry_run-kald mod den deployede funktion: 7 kilde-svar + dedup + honeypot |

---

### Task 1: Gren og v2-formularen ind på main-grundlaget

**Files:** `src/components/ContactForm.tsx`, `supabase/functions/contact-form/index.ts`, `src/styles/site.css`, `src/pages/privatlivspolitik.astro`

- [ ] **Step 1: Opret gren fra main**
```bash
git -C C:/dev/neminventar-astro fetch origin
git -C C:/dev/neminventar-astro checkout -b konvertering origin/main
```
- [ ] **Step 2: Hent formular og funktion fra forside-v2** (v5 er allerede deployet fra den kilde)
```bash
git -C C:/dev/neminventar-astro checkout origin/forside-v2 -- src/components/ContactForm.tsx supabase/functions/contact-form/index.ts
```
- [ ] **Step 3: Tilføj dropzone/filliste-CSS** fra commit `69fc116` (17 linjer, blokken "kontaktformular: filer") nederst i `src/styles/site.css` på main, før `/* ---------- 404`.
- [ ] **Step 4: Privatlivspolitik §2** — tilføj sætningen fra `69fc116` om vedhæftede filer (gemmes i privat Storage, links i 30 dage).
- [ ] **Step 5: Build** — `npm --prefix C:/dev/neminventar-astro run build` → forventet: `61 page(s) built` (eller main's antal) uden fejl.
- [ ] **Step 6: Commit** `git commit -m "Konvertering: v2-formularen med filer på main-grundlaget"`

### Task 2: `src/lib/kilde.ts` (første sidevisning, svar, mailto)

**Files:** Create `src/lib/kilde.ts`, `src/lib/kilde.test.ts`

- [ ] **Step 1: Skriv testen**
```ts
// src/lib/kilde.test.ts — node --test src/lib/kilde.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foersteBesoeg, mailtoMedEmne, KILDE_SVAR } from './kilde.ts';

test('ekstern referrer gemmes som hostname, intern ignoreres', () => {
  const store = new Map<string, string>();
  const ss = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const a = foersteBesoeg({ referrer: 'https://chatgpt.com/c/abc?x=1', href: 'https://neminventar.dk/toiletbaase/?utm_source=chatgpt.com', host: 'neminventar.dk' }, ss);
  assert.deepEqual(a, { referrer_host: 'chatgpt.com', landingsside: '/toiletbaase/', utm: { utm_source: 'chatgpt.com' } });
  const b = foersteBesoeg({ referrer: 'https://neminventar.dk/', href: 'https://neminventar.dk/kontakt/', host: 'neminventar.dk' }, ss);
  assert.equal(b.referrer_host, 'chatgpt.com', 'første besøg vinder');
  assert.equal(b.landingsside, '/toiletbaase/');
});

test('virker uden storage (privat vindue)', () => {
  const ss = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const a = foersteBesoeg({ referrer: '', href: 'https://neminventar.dk/', host: 'neminventar.dk' }, ss);
  assert.deepEqual(a, { referrer_host: '', landingsside: '/', utm: {} });
});

test('mailto får emne, eksisterende emne bevares', () => {
  assert.equal(mailtoMedEmne('mailto:tilbud@neminventar.dk', 'Lockers'),
    'mailto:tilbud@neminventar.dk?subject=' + encodeURIComponent('Forespørgsel fra neminventar.dk – Lockers'));
  assert.equal(mailtoMedEmne('mailto:a@b.dk?subject=Hej', 'X'), 'mailto:a@b.dk?subject=Hej');
});

test('svarmuligheder er de seks fra spec §4', () => {
  assert.deepEqual(KILDE_SVAR, ['Google', 'ChatGPT eller anden AI', 'Anbefaling', 'LinkedIn', 'Vi har arbejdet sammen før', 'Andet']);
});
```
- [ ] **Step 2: Kør — forventet FAIL** (`Cannot find module './kilde.ts'`): `node --test C:/dev/neminventar-astro/src/lib/kilde.test.ts`
- [ ] **Step 3: Implementér**
```ts
// src/lib/kilde.ts — hvor kom besøgeren fra? Fanges ved FØRSTE sidevisning i besøget (ved afsendelse er
// referreren intern). Kun hostname, landingsside og utm_* — ingen persondata. Uden storage: kun denne side.
export const KILDE_SVAR = ['Google', 'ChatGPT eller anden AI', 'Anbefaling', 'LinkedIn', 'Vi har arbejdet sammen før', 'Andet'] as const;
export type Attribution = { referrer_host: string; landingsside: string; utm: Record<string, string> };
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const KEY = 'ni_foerste_besoeg';

export function foersteBesoeg(loc: { referrer: string; href: string; host: string }, store?: Store): Attribution {
  try { const s = store?.getItem(KEY); if (s) return JSON.parse(s) as Attribution; } catch { /* blokeret storage */ }
  let referrer_host = '';
  try { const h = loc.referrer ? new URL(loc.referrer).hostname : ''; if (h && h !== loc.host) referrer_host = h; } catch { /* ugyldig */ }
  const u = new URL(loc.href);
  const utm: Record<string, string> = {};
  u.searchParams.forEach((v, k) => { if (k.startsWith('utm_')) utm[k] = v.slice(0, 100); });
  const a: Attribution = { referrer_host, landingsside: u.pathname.slice(0, 200), utm };
  try { store?.setItem(KEY, JSON.stringify(a)); } catch { /* blokeret storage */ }
  return a;
}

export function mailtoMedEmne(href: string, sidenavn: string): string {
  if (!href.startsWith('mailto:') || /[?&]subject=/i.test(href)) return href;
  const emne = `Forespørgsel fra neminventar.dk – ${sidenavn}`.slice(0, 120);
  return href + (href.includes('?') ? '&' : '?') + 'subject=' + encodeURIComponent(emne);
}

// Browser: kaldes én gang pr. side fra Base.astro
export function startKilde(): Attribution {
  const ss = (() => { try { return window.sessionStorage; } catch { return undefined; } })();
  const a = foersteBesoeg({ referrer: document.referrer, href: location.href, host: location.hostname }, ss);
  const navn = (document.querySelector('h1')?.textContent || document.title).replace(/\s+/g, ' ').trim().slice(0, 60);
  document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]').forEach((el) => { el.href = mailtoMedEmne(el.getAttribute('href') || '', navn); });
  return a;
}
```
- [ ] **Step 4: Kør — forventet PASS (4 tests)**
- [ ] **Step 5: Commit** `git commit -m "Konvertering: kilde.ts fanger første sidevisning og giver mailto et emne"`

### Task 3: `lead.ts` (mapning, lead-række, mistanke)

**Files:** Create `supabase/functions/contact-form/lead.ts`, `supabase/functions/contact-form/lead.test.ts`

- [ ] **Step 1: Skriv testen**
```ts
// node --test supabase/functions/contact-form/lead.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapKanal, byggLead, erMistaenkelig } from './lead.ts';

test('kilde_svar vinder over referrer, ukendte værdier afvises', () => {
  assert.equal(mapKanal('Google', 'chatgpt.com'), 'Google');
  assert.equal(mapKanal('ChatGPT eller anden AI', ''), 'ChatGPT/AI');
  assert.equal(mapKanal('Anbefaling', ''), 'Anbefaling');
  assert.equal(mapKanal('LinkedIn', ''), 'LinkedIn');
  assert.equal(mapKanal('Vi har arbejdet sammen før', ''), 'Relation');
  assert.equal(mapKanal('Andet', ''), 'Andet');
  assert.equal(mapKanal('', 'chatgpt.com'), 'ChatGPT/AI');
  assert.equal(mapKanal('', 'www.google.dk'), 'Google');
  assert.equal(mapKanal('', 'www.bing.com'), 'Bing');
  assert.equal(mapKanal('', ''), 'Ukendt');
  assert.equal(mapKanal('<script>', 'krak.dk'), 'Ukendt');
});

test('lead-rækken overholder CHECK-reglerne', () => {
  const r = byggLead({ name: 'Asmus', company: 'JVST', email: 'a@jvst.dk', phone: '', message: 'Toiletbåse', side: '/toiletbaase/', spor: 'besked', kanal: 'ChatGPT/AI', landingsside: '/toiletbaase/', referrer_host: 'chatgpt.com', filer: 2 });
  assert.equal(r.pipeline_stage, 'lead');
  assert.equal(r.created_by, 'claude_auto');
  assert.equal(r.assigned_to, 'milot');
  assert.equal(r.source_channel, 'Hjemmeside: formular');
  assert.equal(r.lead_kanal, 'ChatGPT/AI');
  assert.match(r.title, /^Web: JVST/);
  assert.match(r.contact_info, /a@jvst\.dk/);
  assert.match(r.description, /Landingsside: neminventar\.dk\/toiletbaase\//);
  assert.ok(r.tags.includes('hjemmeside'));
});

test('mistanke: hurtig udfyldning eller links i beskeden', () => {
  assert.equal(erMistaenkelig({ ms: 1200, message: 'hej' }), true);
  assert.equal(erMistaenkelig({ ms: 9000, message: 'se http://a.ru http://b.ru http://c.ru' }), true);
  assert.equal(erMistaenkelig({ ms: 9000, message: 'Vi skal bruge 12 lockers' }), false);
  assert.equal(erMistaenkelig({ ms: undefined, message: 'gammelt v5-kald' }), false);
});
```
- [ ] **Step 2: Kør — forventet FAIL** (`Cannot find module './lead.ts'`)
- [ ] **Step 3: Implementér**
```ts
// lead.ts — rene funktioner til contact-form (ingen Deno-API, så de kan testes i node).
// lead_kanal har CHECK: ChatGPT/AI, Google, Bing, Byggefakta, Opsøgende, Anbefaling, Relation, Opfordret, LinkedIn, Andet, Ukendt.
const SVAR: Record<string, string> = {
  'Google': 'Google', 'ChatGPT eller anden AI': 'ChatGPT/AI', 'Anbefaling': 'Anbefaling',
  'LinkedIn': 'LinkedIn', 'Vi har arbejdet sammen før': 'Relation', 'Andet': 'Andet',
};

export function kanalFraHost(h: string): string {
  const s = String(h ?? '').toLowerCase();
  if (!s) return 'Ukendt';
  if (/(chatgpt\.com|openai\.com|perplexity\.ai|copilot\.microsoft\.com|gemini\.google\.com|claude\.ai)/.test(s)) return 'ChatGPT/AI';
  if (/(^|\.)google\./.test(s)) return 'Google';
  if (/(^|\.)bing\.com/.test(s)) return 'Bing';
  if (/linkedin\./.test(s)) return 'LinkedIn';
  return 'Ukendt';
}

export function mapKanal(kildeSvar: string, referrerHost: string): string {
  return SVAR[String(kildeSvar ?? '').trim()] ?? kanalFraHost(referrerHost);
}

export type LeadInput = { name: string; company: string; email: string; phone: string; message: string; side: string;
  spor: string; kanal: string; landingsside: string; referrer_host: string; filer: number; permalink?: string };

export function byggLead(i: LeadInput) {
  const who = i.company && i.company !== 'Privatkunde' ? i.company : i.name;
  return {
    title: `Web: ${who}`.slice(0, 120),
    pipeline_stage: 'lead', assigned_to: 'milot', created_by: 'claude_auto',
    source_channel: 'Hjemmeside: formular', lead_kanal: i.kanal,
    primary_contact: i.name, primary_contact_phone: i.phone || null,
    contact_info: [i.name, i.company, i.email, i.phone].filter(Boolean).join(' · '),
    description: [
      i.message.slice(0, 1500),
      '',
      `Spor: ${i.spor}${i.filer ? ` · ${i.filer} fil(er)` : ''}`,
      i.side ? `Sendt fra: neminventar.dk${i.side}` : '',
      i.landingsside ? `Landingsside: neminventar.dk${i.landingsside}` : '',
      i.referrer_host ? `Kom fra: ${i.referrer_host}` : '',
      i.permalink ? `Konfiguration: ${i.permalink}` : '',
    ].filter((x) => x !== '').join('\n'),
    next_step: 'Svar inden for én arbejdsdag',
    tags: ['hjemmeside', 'formular', i.spor].filter(Boolean),
  };
}

// Uden Turnstile: udfyldt på under 3 s eller 3+ links → mail ja, lead nej. ms undefined = gammelt v5-kald → ikke mistænkt.
export function erMistaenkelig(x: { ms?: number; message: string }): boolean {
  if (typeof x.ms === 'number' && x.ms < 3000) return true;
  return (String(x.message).match(/https?:\/\//g) ?? []).length >= 3;
}
```
- [ ] **Step 4: Kør — forventet PASS (3 tests)**
- [ ] **Step 5: Commit** `git commit -m "Konvertering: lead.ts — kilde-mapning efter CHECK-reglen, lead-række, mistanke"`

### Task 4: Kolonner på `web_henvendelser` (kun ADD COLUMN)

**Files:** Create `sql/2026-10-05-web-henvendelser-kilde.sql`

- [ ] **Step 1: Skriv SQL-filen**
```sql
-- D1 konverteringslag: kilde og spor på web-henvendelser. Kun nye, nullable kolonner — main læser ikke tabellen.
ALTER TABLE web_henvendelser_2026_10_04
  ADD COLUMN IF NOT EXISTS spor text,
  ADD COLUMN IF NOT EXISTS kilde_svar text,
  ADD COLUMN IF NOT EXISTS referrer_host text,
  ADD COLUMN IF NOT EXISTS landingsside text,
  ADD COLUMN IF NOT EXISTS utm jsonb,
  ADD COLUMN IF NOT EXISTS konfiguration jsonb,
  ADD COLUMN IF NOT EXISTS permalink text,
  ADD COLUMN IF NOT EXISTS lead_kanal text,
  ADD COLUMN IF NOT EXISTS crm_deal_id uuid;
```
- [ ] **Step 2: Kør via Supabase MCP `apply_migration`** (navn `web_henvendelser_kilde_2026_10_05`) → verificér med `SELECT column_name FROM information_schema.columns WHERE table_name='web_henvendelser_2026_10_04'` (22 kolonner).
- [ ] **Step 3: Commit** `git commit -m "Konvertering: kilde- og spor-kolonner på web_henvendelser"`

### Task 5: `contact-form` v6

**Files:** Modify `supabase/functions/contact-form/index.ts`

- [ ] **Step 1: Importér** `import { mapKanal, byggLead, erMistaenkelig, kanalFraHost } from "./lead.ts";` og erstat den lokale `leadKanal()` med `kanalFraHost` (opkald-grenen bruger den uændret).
- [ ] **Step 2: Læs de nye felter** efter `side`:
```ts
const spor = ["besked", "skitse", "udbud", "designer", "variant"].includes(body?.spor) ? body.spor : "besked";
const kildeSvar = String(body?.kilde_svar ?? "").trim().slice(0, 60);
const referrerHost = String(body?.referrer_host ?? "").trim().toLowerCase().slice(0, 120);
const landingsside = String(body?.landingsside ?? "").trim().slice(0, 200);
const utm = body?.utm && typeof body.utm === "object" && !Array.isArray(body.utm) && JSON.stringify(body.utm).length <= 1000 ? body.utm : null;
const konfiguration = body?.konfiguration && typeof body.konfiguration === "object" && JSON.stringify(body.konfiguration).length <= 4000 ? body.konfiguration : null;
const permalink = /^https:\/\/[a-z0-9.-]+\//i.test(String(body?.permalink ?? "")) ? String(body.permalink).slice(0, 2000) : "";
const ms = typeof body?.ms === "number" ? body.ms : undefined;
const dryRun = body?.dry_run === true;
const kanal = mapKanal(kildeSvar, referrerHost);
```
- [ ] **Step 3: Lead best effort + dedup + rate-limit** (før mailen; i `dry_run` beregnes kun):
```ts
const leadRow = byggLead({ name, company, email, phone, message, side, spor, kanal, landingsside, referrer_host: referrerHost, filer: files.length, permalink });
let leadId: string | null = null, leadNote = "";
const mistanke = erMistaenkelig({ ms, message });
if (dryRun) {
  return new Response(JSON.stringify({ success: true, dry_run: true, lead: mistanke ? null : leadRow, kanal, mistanke }), { headers: json });
}
if (!mistanke) {
  try {
    const sb = admin();
    const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: prev } = await sb.from("crm_deals_2026_04_12").select("id, description")
      .eq("source_channel", "Hjemmeside: formular").eq("pipeline_stage", "lead")
      .ilike("contact_info", `%${email.replace(/[%_]/g, "")}%`).gte("created_at", since30d).limit(1);
    if (prev?.length) {
      leadId = prev[0].id;
      await sb.from("crm_deals_2026_04_12").update({ description: `${prev[0].description ?? ""}\n\n— Ny henvendelse ${todayCopenhagen()} —\n${leadRow.description}`.slice(0, 8000) }).eq("id", leadId);
      leadNote = "tilføjet til eksisterende lead";
    } else {
      const since1h = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await sb.from("crm_deals_2026_04_12").select("id", { count: "exact", head: true })
        .eq("source_channel", "Hjemmeside: formular").gte("created_at", since1h);
      if ((count ?? 0) >= 20) { leadNote = "rate-limit: intet lead"; }
      else {
        const { data: d, error } = await sb.from("crm_deals_2026_04_12").insert(leadRow).select("id").single();
        if (error) throw error;
        leadId = d.id;
        await sb.from("team_memory_2026_05_28").insert({
          author: "hjemmeside", audience: CALLBACK_OWNER,
          topic: `Svar web-henvendelse: ${company || name}`,
          content: `Henvendelse fra neminventar.dk (${kanal}). Lead i CRM: ${leadId}. Svar inden for én arbejdsdag; luk med done_note.`,
          tags: ["huskeliste", "opgave", "hjemmeside"], due_date: todayCopenhagen(),
        });
      }
    }
  } catch (e) { console.error("contact-form: lead fejlede", e); leadNote = "Lead: fejlede"; }
} else { leadNote = "mistænkelig: intet lead"; }
```
- [ ] **Step 4: Gem de nye felter** i `web_henvendelser`-insert'et: `spor, kilde_svar: kildeSvar || null, referrer_host: referrerHost || null, landingsside: landingsside || null, utm, konfiguration, permalink: permalink || null, lead_kanal: kanal, crm_deal_id: leadId`.
- [ ] **Step 5: Mailen** — emnet får `${leadId ? ` [CRM ${leadId.slice(0, 8)}]` : ""}` til sidst, og tabellen får rækkerne "Kilde" (`kanal` + `kildeSvar`/`referrerHost`), "Landingsside" og "Lead" (`leadId?.slice(0,8)` eller `leadNote`). GET-svaret får `version: 6`.
- [ ] **Step 6: Opdatér kommentar-hovedet** (v6 = 05-10-2026: kilde, lead, dry_run).
- [ ] **Step 7: Commit** `git commit -m "contact-form v6: kilde → lead_kanal, lead i CRM med 30 dages dedup, dry_run"`

### Task 6: Formularerne sender kilden

**Files:** Modify `src/components/ContactForm.tsx`, `src/components/CallbackForm.tsx`, `src/layouts/Base.astro`, `src/styles/site.css`

- [ ] **Step 1: Base.astro** — efter Plausible-scriptet:
```astro
<script>
  import { startKilde } from '../lib/kilde.ts';
  startKilde();
</script>
```
- [ ] **Step 2: ContactForm** — props `{ spor?: 'besked' | 'skitse' | 'udbud' | 'designer' | 'variant' }` (default `'besked'`), state `kilde` (select med `KILDE_SVAR`, valgfri, label "Hvor fandt I os? (valgfrit)"), `const t0 = useRef(Date.now())`. I trin 3's body tilføjes: `spor, kilde_svar: kilde, ...foersteBesoeg({referrer: document.referrer, href: location.href, host: location.hostname}, sessionStorage-wrapper), ms: Date.now() - t0.current`. Ved success: `window.plausible?.('Henvendelse sendt', { props: { spor, kilde: kilde || 'ukendt' } })`.
- [ ] **Step 3: CallbackForm** — `ref` = `foersteBesoeg(...).referrer_host` (falder tilbage til den nuværende `document.referrer`-logik).
- [ ] **Step 4: CSS** `.kilde select{…}` i samme stil som `.field input`.
- [ ] **Step 5: Build + lint** — `npm --prefix C:/dev/neminventar-astro run build` og `python C:/dev/neminventar-astro/scripts/lint-web-copy.py --anon-key <anon>` → 0 FEJL.
- [ ] **Step 6: Commit** `git commit -m "Formularerne sender første sidevisning, svar og tid; Plausible-mål Henvendelse sendt"`

### Task 7: Privatliv og cookies

- [ ] **Step 1:** `privatlivspolitik.astro` §2: "Vi gemmer også, hvor du fandt os (dit svar og den side, du kom fra, fx google.com), så vi kan se, hvad der virker."
- [ ] **Step 2:** `cookiepolitik.astro`: "Vi bruger ingen cookies. Under besøget husker browseren (sessionStorage) den første side og hvilken side du kom fra; det slettes, når fanen lukkes, og sendes kun med, hvis du skriver til os."
- [ ] **Step 3: Commit**

### Task 8: Deploy og test af funktionen

**Files:** Create `scripts/test_contact_form.py`

- [ ] **Step 1: Deploy** `contact-form` via Supabase MCP `deploy_edge_function` (filer: `index.ts`, `lead.ts`; `verify_jwt=false`). GET → `version: 6`.
- [ ] **Step 2: Testscriptet** poster `dry_run: true` med origin `https://neminventar.dk` for de 6 svar + tomt med `referrer_host` chatgpt.com/google.dk/'' + `ms: 500` (mistanke) + honeypot, og asserter `kanal` og `lead`. Intet skrives, ingen mail.
- [ ] **Step 3: Kør** `python C:/dev/neminventar-astro/scripts/test_contact_form.py` → `11/11 ok`.
- [ ] **Step 4: Bagudkompatibilitet** — et v5-kald (uden nye felter) med `dry_run` giver `kanal: 'Ukendt'`, `mistanke: false`.
- [ ] **Step 5: Commit + push** `git push -u origin konvertering` → preview-kørslen skal være grøn.

### Task 9: Overlevering

- [ ] **Step 1:** Skærmbillede af /kontakt (computer + telefon) fra preview-adressen `https://konvertering.neminventar-preview.pages.dev/kontakt/`.
- [ ] **Step 2:** Huskeliste til js@: "Opret tre goals i Plausible: Henvendelse sendt, IFC hentet, Designer åbnet" (tags `huskeliste`, `seo`).
- [ ] **Step 3:** Vis Joachim før/efter og bed om ok til merge (PR `konvertering` → `main`).
- [ ] **Step 4:** Efter merge: `context_edit`-log ikke nødvendig (kode), men `ni-log.py event` med resultat.
