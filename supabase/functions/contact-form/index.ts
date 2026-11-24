import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Offentlig kontaktformular-handler for neminventar.dk. Tre slags kald:
//   kind="besked" (default): mail via Microsoft Graph til tilbud@ + kontakt@. Fra 04-10-2026 kan beskeden have
//     vedhæftede filer (tegninger, udbudsmateriale, fotos): filerne ligger i Storage-bucketen web-henvendelser
//     (privat), mailen får links (gyldige 30 dage), og henvendelsen gemmes i web_henvendelser_2026_10_04,
//     så filerne kan findes igen, når linkene er udløbet.
//   action="upload-urls": trin 1 for en besked med filer. Browseren beder om signerede upload-adresser og
//     lægger filerne direkte i Storage uden nøgle (createSignedUploadUrl, gyldig 2 timer). Derefter sendes
//     beskeden med upload_id + fil-stierne. Filtype og størrelse tjekkes her; mappen hedder <åååå-mm>/<upload_id>/.
//   kind="opkald": "Bestil et opkald". Milot (kontakt@) ringer tilbage. Opretter:
//     1) lead i crm_deals_2026_04_12 (source_channel 'Hjemmeside: bestil opkald', assigned_to 'milot')
//     2) huskeliste-række til kontakt@ med frist i dag — kun en pointer til leadet
//     3) mail til kontakt@ via Graph  4) Teams-besked i gruppechatten med Joachim og Milot via botten Claude (v13)
//   Leadet er artefaktet. Mail/Teams er best-effort: fejler de, er leadet stadig gemt.
//   v6 (05-10-2026, D1 konverteringslag): en besked bærer også kilden — spor, kilde_svar ("Hvor fandt I os?"),
//     referrer_host + landingsside + utm for den side, formularen står på (intet gemmes på besøgerens enhed),
//     og opretter best effort et lead i
//     crm_deals_2026_04_12 (source_channel 'Hjemmeside: formular', assigned_to 'milot') med en huskeliste-pointer
//     til kontakt@. Samme e-mail inden for 30 dage føjes til det eksisterende lead. Mailens emne får [CRM <id8>].
//     dry_run=true returnerer det, der ville være skrevet, uden at skrive eller sende noget (til test).
//     Mapningen til lead_kanal (CHECK-reglen) og lead-rækken ligger i lead.ts (testet med node --test).
//   v7 (05-10-2026, D3b): designeren må sende — den offentlige på ni-designer.pages.dev (rigtige leads, spor
//     'designer') og den interne på ni-apps.pages.dev (sender altid dry_run). Kilden til designerens formular:
//     ni-apps public/prisbog/designer/core/forespoergsel.js. Ellers uændret.
//   v8 (07-10-2026): designeren på eget domæne designer.neminventar.dk (firmafiltre blokerer *.pages.dev).
//     ni-designer.pages.dev må stadig sende (reserve). Ellers uændret.
//   v9 (07-10-2026): honeypot-træf gemmes i web_henvendelser som kind 'honeypot' (intet lead, ingen mail), så et
//     menneske kan se dem, og mistanke-grænsen for links er 6 i stedet for 3. Formularerne sender feltet som hp.
//   v10 (23-11-2026, Joachim: "nærmest værdiløst"): mailen til os selv forklarer henvendelsen (mail.ts): én sætning
//     øverst (hvem, hvad, hvorfra), historik på samme mail/telefon, varianten med navn, kulør, pris og links fra sitets
//     varianter.json, designerens specifikation som tabel med prisen, billeder inline og teksten fra docx/odt/txt/csv
//     (vedhaeft.ts). Best effort: fejler noget af det nye, sendes v9-mailen. Lead, rate-limit, honeypot, dry_run og filer
//     er uændrede.
//   v11 (10-11-2026, Joachim: "Vi skal lige have designeren til at sende en kopi af deres mail, til dem selv"): en besked,
//     der bliver et lead, giver afsenderen en kopi med "vi svarer inden for én arbejdsdag" og linket til designet.
//   v12 (24-11-2026, Joachim: "Når vi får en henvendelse skal vi have en besked i teams, mig og milot … et link til at
//     udfylde alt den data der ikke er med i deres henvendelse. Hvis der er nogen der har taget sagen skal man kunne se
//     det."): hver henvendelse, der bliver et lead eller føjes til et, giver Joachim og Milot en Teams-besked 1:1 fra
//     botten (post-teams) med linket til ni-apps /henvendelser/?id=<lead>. Beskederne gemmes i
//     henvendelse_teams_2026_11_24, så fn_henvendelse_tag kan rette dem til "✋ Milot har taget sagen", når nogen tager
//     den på siden. Erstatter Slack-DM'en til Milot. v11-kopien og Teams-vejen (v10 07-11, version 23) er lagt tilbage:
//     de forsvandt, da v10-mailen blev deployet 23-11 fra en gren uden dem (version 31).
//   v13 (24-11-2026, Joachim: "det skal sendes i en dm til mig og milot hvor vi begge er med. Det er for at vi nemmere
//     kan kommunikere om opgaven"): Teams-beskeden går som ÉN besked i gruppechatten "Henvendelser" (Joachim, Milot og
//     botten Claude; post-teams {chat:"henvendelser"}). Botten kan ikke skrive i en 1:1 mellem to personer. Fejler
//     chatten, sendes v12's 1:1 til hver som reserve. Ellers uændret.
// Beskyttelse: fast modtager + honeypot + input-validering + origin-låst CORS + dedup/rate-limit
// på opkald og leads + tidsfælde/linktæller før lead + filtype/størrelse/antal på upload.
// verify_jwt=false (offentligt endpoint, ingen nøgle i klienten).
// Deployes via Supabase MCP (deploy_edge_function, verify_jwt=false, filer: index.ts + lead.ts + mail.ts + vedhaeft.ts).
// Denne fil er kilden.
import { byggLead, erMistaenkelig, kanalFraHost, mapKanal } from "./lead.ts";
import { bygMail, historikAf, normPhone, variantInfo, type HistLead, type HistWeb, type Tidligere, type Udtraek } from "./mail.ts";
import { MAX_FIL_BYTES, TEKST_EXT, tekstAf } from "./vedhaeft.ts";

const VERSION = 13;
const SPOR = new Set(["besked", "skitse", "udbud", "designer", "variant"]);

// v12: Teams til os begge (UPN = team_memory.audience) og siden, hvor det manglende udfyldes og sagen tages.
// v13: i gruppechatten med begge (kanal_noegle i teams_conversations); NOTIFY er kun reserven, hvis chatten fejler.
const TEAMS_CHAT = "henvendelser";
const NOTIFY = ["js@neminventar.dk", "kontakt@neminventar.dk"];
const HENVENDELSE_URL = "https://ni-apps.pages.dev/henvendelser/";
const TEAMS_TABLE = "henvendelse_teams_2026_11_24";
const SPOR_NAVN: Record<string, string> = { besked: "Formularen", skitse: "Skitse", udbud: "Udbud", designer: "Designeren", variant: "Variant" };
const NAVN: Record<string, string> = { "js@neminventar.dk": "Joachim", "kontakt@neminventar.dk": "Milot" };

const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID") || "";
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET") || "";

const FROM = "tilbud@neminventar.dk";
const TO = ["tilbud@neminventar.dk", "kontakt@neminventar.dk"];
const CALLBACK_OWNER = "kontakt@neminventar.dk"; // Milot — Joachim 30-09-2026

const BUCKET = "web-henvendelser";
const TABLE = "web_henvendelser_2026_10_04";
const MAX_FILES = 10;
const MAX_FILE_MB = 50;
const LINK_DAYS = 30;
// Det, en entreprenør eller arkitekt sender: tegninger (pdf/dwg/dxf/ifc/rvt/skp/step), pakker, fotos, regneark, tekst.
const ALLOWED_EXT = new Set([
  "pdf", "dwg", "dxf", "ifc", "rvt", "skp", "step", "stp", "zip", "7z", "rar",
  "jpg", "jpeg", "png", "heic", "heif", "webp", "gif",
  "doc", "docx", "xls", "xlsx", "csv", "txt", "pptx", "odt", "ods",
]);

const ALLOWED_ORIGINS = new Set([
  "https://neminventar.dk",
  "https://www.neminventar.dk",
  "http://localhost:4321",
  "http://127.0.0.1:4321",
  // designeren (v7/v8): offentlig og intern (intern sender kun dry_run) + lokal server under udvikling
  "https://designer.neminventar.dk",
  "https://ni-designer.pages.dev",
  "https://ni-apps.pages.dev",
  "http://localhost:4417",
  "http://127.0.0.1:4417",
]);

// Forhåndsvisninger pr. branch (preview.yml): https://<branch>.neminventar-preview.pages.dev
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.neminventar-preview\.pages\.dev$/;

function corsHeaders(origin: string | null) {
  const allow = origin && (ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin)) ? origin : "https://neminventar.dk";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

let cachedToken: { token: string; expiresAt: number } | null = null;
async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) throw new Error("Graph credentials not configured.");
  const resp = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!resp.ok) throw new Error(`Graph token failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function sendMail(to: string[], subject: string, html: string, replyTo?: string) {
  const token = await getGraphToken();
  const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: to.map((a) => ({ emailAddress: { address: a } })),
        ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}),
      },
      saveToSentItems: false,
    }),
  });
  if (!resp.ok) throw new Error(`Graph sendMail: ${resp.status} ${await resp.text()}`);
}

// normPhone (danske numre uden landekode) bor i mail.ts, så historikken og opkaldenes dedup sammenligner ens.

function todayCopenhagen(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(new Date());
}

// ---------- filer ----------
const extOf = (n: string) => (String(n).match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "").toLowerCase();

// Storage-nøgler tåler kun ASCII: æøå m.fl. omskrives, resten der ikke er bogstav/tal/._()- bliver _.
// Det oprindelige navn gemmes ved siden af og vises i mailen.
function safeName(n: string, i: number): string {
  const base = String(n ?? "").split(/[\\/]/).pop()!.trim();
  const m = base.match(/^(.*?)(\.[A-Za-z0-9]{1,8})?$/);
  const tr = (s: string) => s
    .replace(/[æÆ]/g, "ae").replace(/[øØ]/g, "oe").replace(/[åÅ]/g, "aa")
    .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const stem = tr(m?.[1] ?? "fil").replace(/[^A-Za-z0-9._()-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 100) || "fil";
  const ext = (m?.[2] ?? "").toLowerCase();
  return `${String(i + 1).padStart(2, "0")}_${stem}${ext}`;
}

const fmtSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

// Trin 1: signerede upload-adresser. Validerer antal, filtype og størrelse — selve indholdet lægger browseren
// direkte i bucketen (PUT til signedUrl). Mappen er <åååå-mm>/<upload_id>/, så trin 2 kan tjekke, at stierne hører sammen.
async function handleUploadUrls(body: any, json: Record<string, string>): Promise<Response> {
  const bad = (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400, headers: json });
  const list = Array.isArray(body?.files) ? body.files : [];
  if (!list.length) return bad("Vælg mindst én fil.");
  if (list.length > MAX_FILES) return bad(`Højst ${MAX_FILES} filer ad gangen.`);

  const id = crypto.randomUUID();
  const folder = `${todayCopenhagen().slice(0, 7)}/${id}`;
  const sb = admin();
  const out: { name: string; size: number; path: string; url: string; token: string }[] = [];
  for (let i = 0; i < list.length; i++) {
    const name = String(list[i]?.name ?? "").slice(0, 200);
    const size = Number(list[i]?.size ?? 0);
    const ext = extOf(name);
    if (!ALLOWED_EXT.has(ext)) return bad(`Filtypen .${ext || "?"} kan vi ikke modtage her (${name}). Send den i en mail til tilbud@neminventar.dk.`);
    if (!(size > 0)) return bad(`${name} er tom.`);
    if (size > MAX_FILE_MB * 1024 * 1024) return bad(`${name} er for stor — højst ${MAX_FILE_MB} MB pr. fil.`);
    const path = `${folder}/${safeName(name, i)}`;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("contact-form upload-urls: createSignedUploadUrl fejlede", error);
      return new Response(JSON.stringify({ error: "Kunne ikke gøre klar til upload. Prøv igen, eller send filerne i en mail til tilbud@neminventar.dk." }), { status: 500, headers: json });
    }
    out.push({ name, size, path: data.path, url: data.signedUrl, token: data.token });
  }
  return new Response(JSON.stringify({ success: true, upload_id: id, files: out }), { headers: json });
}

// Honeypot-træf gemmes som kind 'honeypot' (best effort, højst 30 i timen, tomme kald springes over). Intet lead, ingen mail.
async function gemHoneypot(body: any): Promise<void> {
  const t = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const name = t(body?.name, 200), email = t(body?.email, 200), phone = t(body?.phone, 80), message = t(body?.message, 2000);
  if (body?.dry_run === true || (!name && !email && !phone && !message)) return;
  try {
    const sb = admin();
    const { count } = await sb.from(TABLE).select("id", { count: "exact", head: true })
      .eq("kind", "honeypot").gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= 30) return;
    await sb.from(TABLE).insert({
      kind: "honeypot", name, company: t(body?.company, 200) || null, email, phone: phone || null, message,
      side: t(body?.side, 200) || null, spor: t(body?.kind || body?.spor, 20) || null, mail_sent: false,
      notes: `honeypot: skjult felt = "${t(body?.website || body?.hp, 100)}" · intet lead, ingen mail`,
    });
  } catch (e) {
    console.error("contact-form: honeypot-log fejlede", e);
  }
}

// ---------- v12: Teams til Joachim og Milot ----------
// Kundens tekst må ikke blive til links eller fed skrift i Teams (post-teams oversætter <url|tekst> og *fed*).
const teamsTekst = (s: string, n: number) => {
  const t = String(s ?? "").replace(/[<>*_`]/g, "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

// v13: ÉN besked i gruppechatten Henvendelser (Joachim, Milot, Claude), så de kan tale om sagen samme sted. Kan chatten
// ikke nås, går beskeden 1:1 til hver i NOTIFY i stedet, så ingen henvendelse forsvinder. Hver besked gemmes, så
// fn_henvendelse_tag kan rette den, når nogen tager sagen. Best effort: returnerer dem, det ikke lykkedes for.
async function teamsTilOs(dealId: string, title: string, lines: string[]): Promise<string[]> {
  const sb = admin();
  const { data: s } = await sb.from("api_secrets").select("api_key").eq("service_name", "teams_post_key").eq("environment", "PROD").limit(1).single();
  if (!s?.api_key) {
    console.error("contact-form: teams_post_key mangler");
    return [...NOTIFY];
  }
  const alle = [...lines, `<${HENVENDELSE_URL}?id=${dealId}|Udfyld det, der mangler, og tag sagen>`];
  const titel = title.slice(0, 200);
  const send = async (modtager: { chat: string } | { to_email: string }) => {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/post-teams`, {
      method: "POST",
      headers: { "x-ni-key": s.api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ ...modtager, title: titel, lines: alle }),
    });
    const j = await r.json();
    if (!j?.ok || !j.conversation_id || !j.message_id) throw new Error(j?.error ?? `post-teams ${r.status}`);
    const chat = "chat" in modtager ? modtager.chat : null;
    const { error } = await sb.from(TEAMS_TABLE).insert({
      deal_id: dealId, to_email: chat ? `chat:${chat}` : (modtager as { to_email: string }).to_email, chat,
      conversation_id: j.conversation_id, message_id: j.message_id, title: titel, lines: alle,
    });
    if (error) console.error("contact-form: teams-besked sendt, men ikke gemt", modtager, error);
  };

  try {
    await send({ chat: TEAMS_CHAT });
    return [];
  } catch (e) {
    console.error("contact-form: gruppechatten fejlede, sender 1:1 i stedet", e);
  }
  const fejl: string[] = [];
  await Promise.all(NOTIFY.map(async (to) => {
    try { await send({ to_email: to }); } catch (e) {
      console.error("contact-form: teams til", to, "fejlede", e);
      fejl.push(to);
    }
  }));
  return fejl;
}

// ---------- v10: data til mailen (mail.ts bygger den). Alt er best effort med frist. ----------
// Et løfte med en frist: når fristen er gået, giver det en fejl, og mailen sendes uden det.
async function medFrist<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: number | undefined;
  try {
    return await Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Error(`frist ${ms} ms`)), ms); })]);
  } finally {
    clearTimeout(t);
  }
}

// Sitets egen liste over typer og varianter (src/pages/varianter.json.ts, genereres ved build). Gemmes en time.
const VARIANTER_URL = "https://neminventar.dk/varianter.json";
let varianterCache: { t: number; data: unknown } | null = null;
async function hentVarianter(): Promise<unknown> {
  if (varianterCache && Date.now() - varianterCache.t < 3600_000) return varianterCache.data;
  const r = await fetch(VARIANTER_URL, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`varianter.json: ${r.status}`);
  const data = await r.json();
  varianterCache = { t: Date.now(), data };
  return data;
}

// Teksten fra højst 3 docx/odt/txt/csv-filer (de første 1.500 tegn hver), nøgle = fil-stien
async function hentUdtraek(files: { name: string; size: number; path: string }[]): Promise<Record<string, Udtraek>> {
  const ud: Record<string, Udtraek> = {};
  const valgte = files.filter((f) => TEKST_EXT.has(extOf(f.name)) && f.size > 0 && f.size <= MAX_FIL_BYTES).slice(0, 3);
  if (!valgte.length) return ud;
  const sb = admin();
  await Promise.all(valgte.map(async (f) => {
    try {
      const { data, error } = await sb.storage.from(BUCKET).download(f.path);
      if (error || !data) throw error ?? new Error("ingen data");
      const t = await tekstAf(f.name, new Uint8Array(await data.arrayBuffer()));
      if (t) ud[f.path] = t;
    } catch (e) {
      console.error("contact-form: tekst fra fil fejlede", f.path, e);
    }
  }));
  return ud;
}

// Tidligere henvendelser og leads med samme mail eller telefon. Telefonen søges som cifrene i rækkefølge med hvad som
// helst imellem (%6%0%1%4%…), så "+45 60 14 36 84" og "60143684" begge findes; historikAf sammenligner præcist bagefter.
async function hentHistorik(email: string, phone: string): Promise<{ leads: HistLead[]; henvendelser: HistWeb[] }> {
  const sb = admin();
  const e = email.trim().toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`);
  const cifre = normPhone(phone);
  const tlf = cifre.length >= 8 ? `%${cifre.slice(-8).split("").join("%")}%` : "";
  const W = "id, created_at, kind, message, spor, email, phone, crm_deal_id";
  const L = "id, created_at, title, pipeline_stage, contact_info, primary_contact_phone";
  const CRM = "crm_deals_2026_04_12";
  const res = await Promise.all([
    sb.from(TABLE).select(W).eq("kind", "besked").ilike("email", e).order("created_at", { ascending: false }).limit(20),
    sb.from(CRM).select(L).ilike("contact_info", `%${e}%`).order("created_at", { ascending: false }).limit(20),
    ...(tlf ? [
      sb.from(TABLE).select(W).eq("kind", "besked").ilike("phone", tlf).order("created_at", { ascending: false }).limit(20),
      sb.from(CRM).select(L).ilike("primary_contact_phone", tlf).order("created_at", { ascending: false }).limit(20),
    ] : []),
  ]);
  for (const r of res) if (r.error) throw r.error;
  return {
    henvendelser: [...(res[0].data ?? []), ...(res[2]?.data ?? [])] as HistWeb[],
    leads: [...(res[1].data ?? []), ...(res[3]?.data ?? [])] as HistLead[],
  };
}

async function handleCallback(body: any, json: Record<string, string>): Promise<Response> {
  const name = String(body?.name ?? "").trim().slice(0, 200);
  const company = String(body?.company ?? "").trim().slice(0, 200);
  const phone = String(body?.phone ?? "").trim().slice(0, 40);
  const topic = String(body?.message ?? "").trim().slice(0, 1000);
  const side = String(body?.side ?? "").trim().slice(0, 200);
  const ref = String(body?.ref ?? "").trim().slice(0, 200);

  const digits = phone.replace(/\D/g, "");
  if (!name || digits.length < 8) {
    return new Response(JSON.stringify({ error: "Udfyld navn og et telefonnummer." }), { status: 400, headers: json });
  }

  const sb = admin();

  // Rate-limit: højst 20 opkald i timen i alt, og samme nummer tæller kun én gang pr. 30 min.
  const since1h = new Date(Date.now() - 3600_000).toISOString();
  const { data: recent } = await sb.from("crm_deals_2026_04_12")
    .select("id, primary_contact_phone, created_at")
    .eq("source_channel", "Hjemmeside: bestil opkald").gte("created_at", since1h);
  const since30 = Date.now() - 1800_000;
  const norm = normPhone(phone);
  const dup = (recent ?? []).find((r: any) =>
    normPhone(r.primary_contact_phone) === norm && Date.parse(r.created_at) > since30);
  if (dup) return new Response(JSON.stringify({ success: true }), { headers: json });
  if ((recent ?? []).length >= 20) {
    return new Response(JSON.stringify({ error: "Prøv igen senere, eller ring på +45 42 42 26 84." }), { status: 429, headers: json });
  }

  const who = company ? `${name} · ${company}` : name;
  // Kan kilden ikke ses, bliver den 'Ukendt' — Milot spørger i opkaldet og retter leadet.
  const kanal = kanalFraHost(ref);
  const { data: deal, error: derr } = await sb.from("crm_deals_2026_04_12").insert({
    title: `Opkald: ${company || name}`,
    pipeline_stage: "lead",
    assigned_to: "milot",
    created_by: "import",
    source_channel: "Hjemmeside: bestil opkald",
    lead_kanal: kanal,
    primary_contact: name,
    primary_contact_phone: phone,
    contact_info: [name, company, phone].filter(Boolean).join(" · "),
    description: [topic ? `Emne: ${topic}` : "", side ? `Bestilt fra: neminventar.dk${side}` : "", ref ? `Kom fra: ${ref}` : ""].filter(Boolean).join("\n"),
    next_step: "Ring tilbage samme arbejdsdag",
    tags: ["hjemmeside", "opkald"],
  }).select("id").single();
  if (derr || !deal) {
    console.error("contact-form opkald: crm insert fejlede", derr);
    return new Response(JSON.stringify({ error: "Kunne ikke gemme din forespørgsel." }), { status: 500, headers: json });
  }
  const id8 = String(deal.id).slice(0, 8);

  // Huskeliste-pointer til Milot. Artefaktet er leadet — rækken peger kun derhen.
  const { error: terr } = await sb.from("team_memory_2026_05_28").insert({
    author: "hjemmeside",
    audience: CALLBACK_OWNER,
    topic: `Ring tilbage: ${who} · ${phone}`,
    content: `Opkald bestilt på neminventar.dk. Lead i CRM: ${deal.id}. Luk med done_note, når I har talt sammen, og ret leadets lead_kanal, hvis kunden siger, hvor de fandt os.`,
    tags: ["huskeliste", "opgave", "opkald", "hjemmeside"],
    due_date: todayCopenhagen(),
  });
  if (terr) console.error("contact-form opkald: huskeliste fejlede", terr);

  const notes: string[] = [];
  try {
    const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#17140E">` +
      `<h2 style="margin:0 0 16px">Ring tilbage: ${esc(who)}</h2>` +
      `<p style="font-size:20px;margin:0 0 16px"><a href="tel:${esc(digits)}">${esc(phone)}</a></p>` +
      `<table style="border-collapse:collapse">` +
      `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Navn</td><td><strong>${esc(name)}</strong></td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Virksomhed</td><td>${esc(company) || "—"}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Emne</td><td>${esc(topic) || "—"}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Bestilt fra</td><td>neminventar.dk${esc(side)}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Kom fra</td><td>${esc(ref) || "ukendt — spørg i opkaldet"}</td></tr>` +
      `</table>` +
      `<p style="margin-top:20px;color:#9a917f;font-size:13px">Lead i CRM: ${esc(id8)} · Opgave på din huskeliste med frist i dag.</p>` +
      `</div>`;
    await sendMail([CALLBACK_OWNER], `Ring tilbage: ${who} · ${phone}`, html);
  } catch (e) {
    console.error("contact-form opkald: mail fejlede", e);
    notes.push("mail");
  }

  // v13: Teams i gruppechatten med Joachim og Milot med linket til siden (afløste Slack-DM'en til Milot).
  try {
    const fejl = await teamsTilOs(String(deal.id), `Ring tilbage: ${teamsTekst(who, 120)} · ${teamsTekst(phone, 40)}`, [
      `Bestil et opkald på neminventar.dk${teamsTekst(side, 80) || "/"}${topic ? ` · emne: ${teamsTekst(topic, 160)}` : ""}`,
    ]);
    if (fejl.length) notes.push("teams");
  } catch (e) {
    console.error("contact-form opkald: teams fejlede", e);
    notes.push("teams");
  }

  return new Response(JSON.stringify({ success: true, lead: id8, ...(notes.length ? { notify_failed: notes } : {}) }), { headers: json });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = { "Content-Type": "application/json", ...cors };

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") return new Response(JSON.stringify({ name: "contact-form", version: VERSION, status: "ok", kinds: ["besked", "opkald"], actions: ["upload-urls"], upload: { max_files: MAX_FILES, max_file_mb: MAX_FILE_MB, ext: [...ALLOWED_EXT] } }), { headers: json });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: json });

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Ugyldig forespørgsel." }), { status: 400, headers: json });
  }

  // Honeypot: bots udfylder skjulte felter. Lad som om det lykkedes, send intet — men gem forsøget (v9), så et menneske
  // kan se det, hvis en password-manager har udfyldt feltet for en rigtig kunde (Fable 07-10-2026). NI Udefra-ind viser dem.
  if (body?.website || body?.hp) {
    await gemHoneypot(body);
    return new Response(JSON.stringify({ success: true }), { headers: json });
  }

  if (body?.action === "upload-urls") return await handleUploadUrls(body, json);
  if (body?.kind === "opkald") return await handleCallback(body, json);

  const name = String(body?.name ?? "").trim().slice(0, 200);
  const company = String(body?.company ?? "").trim().slice(0, 200);
  const email = String(body?.email ?? "").trim().slice(0, 200);
  const phone = String(body?.phone ?? "").trim().slice(0, 80);
  const message = String(body?.message ?? "").trim().slice(0, 5000);
  const side = String(body?.side ?? "").trim().slice(0, 200);
  // v6: kilden. Alt er valgfrit — et v5-kald uden felterne giver spor 'besked' og kanal 'Ukendt'.
  const spor = SPOR.has(body?.spor) ? String(body.spor) : "besked";
  const kildeSvar = String(body?.kilde_svar ?? "").trim().slice(0, 60);
  const referrerHost = String(body?.referrer_host ?? "").trim().toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 120);
  const landingsside = String(body?.landingsside ?? "").trim().slice(0, 200);
  const isObj = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
  const utm = isObj(body?.utm) && JSON.stringify(body.utm).length <= 1000 ? body.utm : null;
  const konfiguration = isObj(body?.konfiguration) && JSON.stringify(body.konfiguration).length <= 4000 ? body.konfiguration : null;
  const permalink = /^https:\/\/[a-z0-9.-]+\//i.test(String(body?.permalink ?? "")) ? String(body.permalink).slice(0, 2000) : "";
  const ms = typeof body?.ms === "number" && Number.isFinite(body.ms) ? body.ms : undefined;
  const dryRun = body?.dry_run === true;
  const kanal = mapKanal(kildeSvar, referrerHost);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !emailRe.test(email) || !message) {
    return new Response(JSON.stringify({ error: "Udfyld navn, en gyldig e-mail og en besked." }), { status: 400, headers: json });
  }

  // Vedhæftede filer (trin 2): stierne skal høre til dette upload_id, og filerne skal faktisk ligge i bucketen.
  const uploadId = String(body?.upload_id ?? "").trim();
  const rawFiles = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
  let files: { name: string; size: number; path: string; url?: string }[] = [];
  let folder = "";
  if (rawFiles.length) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uploadId)) {
      return new Response(JSON.stringify({ error: "Ugyldig upload — prøv at vælge filerne igen." }), { status: 400, headers: json });
    }
    const folderRe = new RegExp(`^\\d{4}-\\d{2}/${uploadId}/[^/]+$`);
    for (const f of rawFiles) {
      const path = String(f?.path ?? "");
      if (!folderRe.test(path)) return new Response(JSON.stringify({ error: "Ugyldig fil-sti." }), { status: 400, headers: json });
      files.push({ name: String(f?.name ?? path.split("/").pop()).slice(0, 200), size: Number(f?.size ?? 0), path });
    }
    folder = files[0].path.split("/").slice(0, 2).join("/");
    try {
      const sb = admin();
      const { data: objs } = await sb.storage.from(BUCKET).list(folder, { limit: 100 });
      const present = new Set((objs ?? []).map((o: any) => `${folder}/${o.name}`));
      files = files.filter((f) => present.has(f.path));
      if (files.length) {
        const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(files.map((f) => f.path), 60 * 60 * 24 * LINK_DAYS);
        (signed ?? []).forEach((s: any, i: number) => { if (s?.signedUrl) files[i].url = s.signedUrl; });
      }
    } catch (e) {
      console.error("contact-form: fil-opslag fejlede", e);
    }
  }

  // Lead i CRM (v6). Artefaktet er leadet; mailen og huskelisten peger derhen. Best effort: fejler det, sendes
  // mailen stadig med en note. Mistænkelige beskeder (for hurtigt udfyldt, mange links) får ingen lead.
  const leadRow = byggLead({ name, company, email, phone, message, side, spor, kanal, landingsside, referrer_host: referrerHost, filer: files.length, permalink });
  const mistanke = erMistaenkelig({ ms, message });
  if (dryRun) {
    return new Response(JSON.stringify({ success: true, dry_run: true, version: VERSION, kanal, spor, mistanke, lead: mistanke ? null : leadRow }), { headers: json });
  }
  let leadId: string | null = null;
  let leadNote = "";
  let tagetAf: string | null = null; // v12: hvem har allerede den henvendelse, beskeden føjes til
  if (mistanke) {
    leadNote = "mistænkelig: intet lead";
  } else {
    try {
      const sb = admin();
      const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data: prev } = await sb.from("crm_deals_2026_04_12").select("id, description, claimed_by")
        .eq("source_channel", "Hjemmeside: formular").eq("pipeline_stage", "lead")
        .ilike("contact_info", `%${email.replace(/[%_\\]/g, "")}%`).gte("created_at", since30d)
        .order("created_at", { ascending: false }).limit(1);
      if (prev?.length) {
        leadId = prev[0].id;
        const desc = `${prev[0].description ?? ""}\n\n— Ny henvendelse ${todayCopenhagen()} —\n${leadRow.description}`.slice(0, 8000);
        const { error: uerr } = await sb.from("crm_deals_2026_04_12").update({ description: desc }).eq("id", leadId);
        if (uerr) throw uerr;
        leadNote = "føjet til eksisterende lead";
        tagetAf = prev[0].claimed_by ?? null;
      } else {
        const since1h = new Date(Date.now() - 3600_000).toISOString();
        const { count } = await sb.from("crm_deals_2026_04_12").select("id", { count: "exact", head: true })
          .eq("source_channel", "Hjemmeside: formular").gte("created_at", since1h);
        if ((count ?? 0) >= 20) {
          leadNote = "rate-limit: intet lead";
        } else {
          const { data: d, error: lerr } = await sb.from("crm_deals_2026_04_12").insert(leadRow).select("id").single();
          if (lerr || !d) throw lerr ?? new Error("intet id");
          leadId = d.id;
          const { error: terr } = await sb.from("team_memory_2026_05_28").insert({
            author: "hjemmeside",
            audience: CALLBACK_OWNER,
            topic: `Svar web-henvendelse: ${company && company !== "Privatkunde" ? company : name}`,
            content: `Henvendelse fra neminventar.dk (${kanal}, spor ${spor}). Lead i CRM: ${leadId}. Svar inden for én arbejdsdag, og luk med done_note.`,
            tags: ["huskeliste", "opgave", "hjemmeside"],
            due_date: todayCopenhagen(),
          });
          if (terr) console.error("contact-form: huskeliste fejlede", terr);
        }
      }
    } catch (e) {
      console.error("contact-form: lead fejlede", e);
      leadNote = "Lead: fejlede";
    }
  }

  // v12: Teams til Joachim og Milot, når henvendelsen er et lead (ny eller føjet til en kendt). Mistænkelige og dem over
  // loftet giver intet lead og derfor ingen besked — mailen er stadig deres spor.
  if (leadId) {
    try {
      const who = company && company !== "Privatkunde" ? `${name} · ${company}` : name;
      const kendt = leadNote === "føjet til eksisterende lead";
      const hvorfra = [
        `${SPOR_NAVN[spor] ?? "Formularen"} på neminventar.dk${teamsTekst(side, 80) || "/"}`,
        kanal !== "Ukendt" ? `kilde ${kanal}` : "",
        files.length ? `${files.length} ${files.length === 1 ? "fil" : "filer"}` : "",
      ].filter(Boolean).join(" · ");
      await teamsTilOs(String(leadId), `${kendt ? "Ny besked fra" : "Ny henvendelse:"} ${teamsTekst(who, 140)}`, [
        hvorfra,
        `"${teamsTekst(message, 220)}"`,
        ...(tagetAf ? [`✋ ${NAVN[tagetAf] ?? tagetAf.split("@")[0]} har sagen`] : []),
      ]);
    } catch (e) {
      console.error("contact-form: teams fejlede", e);
    }
  }

  // Gem henvendelsen (best effort) — filstierne gør, at filerne kan findes, når mail-linkene er udløbet.
  let rowId: string | null = null;
  try {
    const { data: row, error } = await admin().from(TABLE).insert({
      kind: "besked", name, company: company || null, email, phone: phone || null, message, side: side || null,
      upload_id: rawFiles.length ? uploadId : null,
      files: files.map((f) => ({ name: f.name, size: f.size, path: f.path })),
      spor, kilde_svar: kildeSvar || null, referrer_host: referrerHost || null, landingsside: landingsside || null,
      utm, konfiguration, permalink: permalink || null, lead_kanal: kanal, crm_deal_id: leadId,
      notes: leadNote || null,
    }).select("id").single();
    if (error) throw error;
    rowId = row?.id ?? null;
  } catch (e) {
    console.error("contact-form: insert i web_henvendelser fejlede", e);
  }

  const filesHtml = files.length
    ? `<p style="margin:16px 0 6px;color:#6b6253">Vedhæftede filer (${files.length})</p>` +
      `<ul style="margin:0;padding-left:18px">` +
      files.map((f) => `<li style="margin:3px 0">${f.url ? `<a href="${esc(f.url)}">${esc(f.name)}</a>` : esc(f.name)} <span style="color:#9a917f">· ${fmtSize(f.size)}</span></li>`).join("") +
      `</ul>` +
      `<p style="margin:8px 0 0;color:#9a917f;font-size:13px">Links virker i ${LINK_DAYS} dage. Filerne ligger i Supabase Storage: ${BUCKET}/${esc(folder)}</p>`
    : (rawFiles.length ? `<p style="margin:16px 0 0;color:#9B2C2C;font-size:13px">Afsenderen valgte ${rawFiles.length} fil(er), men de nåede ikke frem til Storage. Spørg efter dem på mail.</p>` : "");

  // v9-mailen: reserven, hvis v10 fejler (uændret)
  const htmlV9 = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#17140E">` +
    `<h2 style="margin:0 0 16px">Ny henvendelse fra neminventar.dk</h2>` +
    `<table style="border-collapse:collapse">` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Navn</td><td><strong>${esc(name)}</strong></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Virksomhed</td><td>${esc(company) || "—"}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">E-mail</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Telefon</td><td>${esc(phone) || "—"}</td></tr>` +
    (side ? `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Sendt fra</td><td>neminventar.dk${esc(side)}</td></tr>` : "") +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Kilde</td><td><strong>${esc(kanal)}</strong>${kildeSvar ? ` · svar: ${esc(kildeSvar)}` : ""}${referrerHost ? ` · kom fra ${esc(referrerHost)}` : ""}</td></tr>` +
    (landingsside && landingsside !== side ? `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Landingsside</td><td>neminventar.dk${esc(landingsside)}</td></tr>` : "") +
    (spor !== "besked" ? `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Spor</td><td>${esc(spor)}</td></tr>` : "") +
    (permalink ? `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Konfiguration</td><td><a href="${esc(permalink)}">Åbn i designeren</a></td></tr>` : "") +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Lead i CRM</td><td>${leadId ? esc(String(leadId).slice(0, 8)) + (leadNote ? ` (${esc(leadNote)})` : "") + " · på Milots huskeliste" : esc(leadNote || "—")}</td></tr>` +
    `</table>` +
    `<p style="margin:16px 0 6px;color:#6b6253">Besked</p>` +
    `<div style="white-space:pre-wrap;border-left:3px solid #C8A86B;padding:8px 14px;background:#faf8f4">${esc(message)}</div>` +
    filesHtml +
    `<p style="margin-top:20px;color:#9a917f;font-size:13px">Svar (Reply) går direkte til ${esc(email)}.${rowId ? ` · Henvendelse ${esc(String(rowId).slice(0, 8))}` : ""}</p>` +
    `</div>`;

  const subjectV9 = `Web-henvendelse: ${name}${company ? " · " + company : ""}${files.length ? ` · ${files.length} ${files.length === 1 ? "fil" : "filer"}` : ""}${leadId ? ` [CRM ${String(leadId).slice(0, 8)}]` : ""}`;

  // v10: mailen, der forklarer henvendelsen (mail.ts). Data hentes samtidig med en frist hver; det, der fejler, udelades.
  // Fejler selve opbygningen, sendes v9-mailen. Leadet og rækken i web_henvendelser er gemt før dette.
  let subject = subjectV9, html = htmlV9;
  try {
    const erVariant = spor === "variant" && konfiguration?.type === "variant";
    const [vj, ud, hist] = await Promise.allSettled([
      erVariant ? medFrist(hentVarianter(), 4000) : Promise.resolve(null),
      files.length ? medFrist(hentUdtraek(files), 6000) : Promise.resolve({} as Record<string, Udtraek>),
      medFrist(hentHistorik(email, phone), 4000),
    ]);
    for (const r of [vj, ud, hist]) if (r.status === "rejected") console.error("contact-form v10: data til mailen fejlede", r.reason);
    let historik: Tidligere[] | null = null;
    if (hist.status === "fulfilled") {
      historik = historikAf({ ...hist.value, email, phone, rowId, leadId, nytLead: !!leadId && leadNote !== "føjet til eksisterende lead" });
    }
    const m = bygMail({
      name, company, email, phone, message, side, spor, kanal, kildeSvar, referrerHost, landingsside,
      konfiguration, permalink, files, valgteFiler: rawFiles.length, folder, bucket: BUCKET, linkDays: LINK_DAYS,
      leadId, leadNote, rowId,
      variant: vj.status === "fulfilled" && vj.value ? variantInfo(vj.value, konfiguration) : null,
      udtraek: ud.status === "fulfilled" ? ud.value : {},
      historik,
    });
    subject = m.subject;
    html = m.html;
  } catch (e) {
    console.error("contact-form v10: mailen kunne ikke bygges, sender v9-mailen", e);
  }

  try {
    try {
      await sendMail(TO, subject, html, email);
    } catch (e) {
      // Afviser Graph v10-mailen, prøves v9-mailen én gang
      if (html === htmlV9) throw e;
      console.error("contact-form v10: mailen blev afvist, sender v9-mailen", e);
      await sendMail(TO, subjectV9, htmlV9, email);
    }
    if (rowId) await admin().from(TABLE).update({ mail_sent: true }).eq("id", rowId);
    // v11: kopi til afsenderen — kun når henvendelsen er blevet et lead (ikke mistænkelig, under loftet på 20 i timen), så
    // formularen ikke kan bruges til at sende mail til fremmede. Best effort: fejler kopien, er vores mail og leadet sendt.
    if (leadId) {
      try {
        const kopi = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#17140E;max-width:620px">` +
          `<p>Hej ${esc(name.split(" ")[0])},</p>` +
          `<p>Tak for din henvendelse. Vi har fået den og svarer inden for én arbejdsdag.</p>` +
          (permalink ? `<p><a href="${esc(permalink)}">Se dit design i designeren</a></p>` : "") +
          `<p style="margin:16px 0 6px;color:#6b6253">Det skrev du</p>` +
          `<div style="white-space:pre-wrap;border-left:3px solid #C8A86B;padding:8px 14px;background:#faf8f4">${esc(message)}</div>` +
          (files.length ? `<p style="color:#6b6253">Vi har modtaget ${files.length} ${files.length === 1 ? "fil" : "filer"}.</p>` : "") +
          `<p>Har du noget at tilføje, så svar bare på denne mail. Kan du ikke vente på et svar, er du altid velkommen til at ringe på <a href="tel:+4542422684">+45 42 42 26 84</a>.</p>` +
          `<p>Mvh<br>Nem Inventar</p>` +
          `<p style="margin-top:20px;color:#9a917f;font-size:13px">Nem Inventar ApS · Mågevej 73, st., 2400 København NV · tilbud@neminventar.dk</p>` +
          `</div>`;
        await sendMail([email], "Vi har fået din henvendelse", kopi, FROM);
      } catch (e) {
        console.error("contact-form: kopi til afsender fejlede", e);
      }
    }
    return new Response(JSON.stringify({ success: true, files: files.length }), { headers: json });
  } catch (e) {
    console.error("contact-form error:", e);
    return new Response(JSON.stringify({ error: "Kunne ikke sende beskeden." }), { status: 500, headers: json });
  }
});
