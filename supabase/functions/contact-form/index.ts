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
//     3) mail til kontakt@ via Graph  4) Slack-DM til Milot (slack-id fra standup_participants)
//   Leadet er artefaktet. Mail/Slack er best-effort: fejler de, er leadet stadig gemt.
// Beskyttelse: fast modtager + honeypot + input-validering + origin-låst CORS + dedup/rate-limit
// på opkald + filtype/størrelse/antal på upload. verify_jwt=false (offentligt endpoint, ingen nøgle i klienten).
// Deployes via Supabase MCP (deploy_edge_function, verify_jwt=false). Denne fil er kilden — v5 = 04-10-2026.

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
]);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://neminventar.dk";
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

// Den eksterne side, der sendte besøgeren (document.referrer ved afsendelse) → fast lead_kanal-værdi.
// Kan kilden ikke ses, bliver den 'Ukendt' — Milot spørger i opkaldet og retter leadet.
function leadKanal(ref: string): string {
  const h = ref.toLowerCase();
  if (!h) return "Ukendt";
  if (/(chatgpt\.com|openai\.com|perplexity\.ai|copilot\.microsoft\.com|gemini\.google\.com|claude\.ai)/.test(h)) return "ChatGPT/AI";
  if (/(^|\.)google\./.test(h)) return "Google";
  if (/(^|\.)bing\.com/.test(h)) return "Bing";
  if (/linkedin\./.test(h)) return "LinkedIn";
  return "Ukendt";
}

// Danske numre sammenlignes uden landekode: "+45 40 14 05 08", "004540140508" og "40140508" er samme nummer.
function normPhone(p: string): string {
  const d = String(p ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("0045")) return d.slice(4);
  if (d.length === 10 && d.startsWith("45")) return d.slice(2);
  return d;
}

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
    .normalize("NFKD").replace(/[̀-ͯ]/g, "");
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
  const kanal = leadKanal(ref);
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

  try {
    const { data: p } = await sb.from("standup_participants").select("slack_user_id").eq("email", CALLBACK_OWNER).limit(1).single();
    const { data: s } = await sb.from("api_secrets").select("api_key").eq("service_name", "slack_bot").eq("environment", "PROD").limit(1).single();
    if (p?.slack_user_id && s?.api_key) {
      const text = `Ring tilbage: ${who} på ${phone}, bestilt fra neminventar.dk${side || "/"} (lead ${id8}).`;
      const r = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${s.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: p.slack_user_id, text }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error ?? "slack error");
    } else {
      throw new Error("slack-id eller token mangler");
    }
  } catch (e) {
    console.error("contact-form opkald: slack fejlede", e);
    notes.push("slack");
  }

  return new Response(JSON.stringify({ success: true, lead: id8, ...(notes.length ? { notify_failed: notes } : {}) }), { headers: json });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = { "Content-Type": "application/json", ...cors };

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") return new Response(JSON.stringify({ name: "contact-form", status: "ok", kinds: ["besked", "opkald"], actions: ["upload-urls"], upload: { max_files: MAX_FILES, max_file_mb: MAX_FILE_MB, ext: [...ALLOWED_EXT] } }), { headers: json });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: json });

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Ugyldig forespørgsel." }), { status: 400, headers: json });
  }

  // Honeypot: bots udfylder skjulte felter. Lad som om det lykkedes, send intet.
  if (body?.website || body?.hp) return new Response(JSON.stringify({ success: true }), { headers: json });

  if (body?.action === "upload-urls") return await handleUploadUrls(body, json);
  if (body?.kind === "opkald") return await handleCallback(body, json);

  const name = String(body?.name ?? "").trim().slice(0, 200);
  const company = String(body?.company ?? "").trim().slice(0, 200);
  const email = String(body?.email ?? "").trim().slice(0, 200);
  const phone = String(body?.phone ?? "").trim().slice(0, 80);
  const message = String(body?.message ?? "").trim().slice(0, 5000);
  const side = String(body?.side ?? "").trim().slice(0, 200);

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

  // Gem henvendelsen (best effort) — filstierne gør, at filerne kan findes, når mail-linkene er udløbet.
  let rowId: string | null = null;
  try {
    const { data: row, error } = await admin().from(TABLE).insert({
      kind: "besked", name, company: company || null, email, phone: phone || null, message, side: side || null,
      upload_id: rawFiles.length ? uploadId : null,
      files: files.map((f) => ({ name: f.name, size: f.size, path: f.path })),
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

  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#17140E">` +
    `<h2 style="margin:0 0 16px">Ny henvendelse fra neminventar.dk</h2>` +
    `<table style="border-collapse:collapse">` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Navn</td><td><strong>${esc(name)}</strong></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Virksomhed</td><td>${esc(company) || "—"}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">E-mail</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Telefon</td><td>${esc(phone) || "—"}</td></tr>` +
    (side ? `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Sendt fra</td><td>neminventar.dk${esc(side)}</td></tr>` : "") +
    `</table>` +
    `<p style="margin:16px 0 6px;color:#6b6253">Besked</p>` +
    `<div style="white-space:pre-wrap;border-left:3px solid #C8A86B;padding:8px 14px;background:#faf8f4">${esc(message)}</div>` +
    filesHtml +
    `<p style="margin-top:20px;color:#9a917f;font-size:13px">Svar (Reply) går direkte til ${esc(email)}.${rowId ? ` · Henvendelse ${esc(String(rowId).slice(0, 8))}` : ""}</p>` +
    `</div>`;

  const subject = `Web-henvendelse: ${name}${company ? " · " + company : ""}${files.length ? ` · ${files.length} ${files.length === 1 ? "fil" : "filer"}` : ""}`;
  try {
    await sendMail(TO, subject, html, email);
    if (rowId) await admin().from(TABLE).update({ mail_sent: true }).eq("id", rowId);
    return new Response(JSON.stringify({ success: true, files: files.length }), { headers: json });
  } catch (e) {
    console.error("contact-form error:", e);
    return new Response(JSON.stringify({ error: "Kunne ikke sende beskeden." }), { status: 500, headers: json });
  }
});
