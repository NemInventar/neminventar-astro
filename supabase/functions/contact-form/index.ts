import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Offentlig kontaktformular-handler for neminventar.dk. To slags henvendelser:
//   kind="besked" (default): mail via Microsoft Graph til tilbud@ + kontakt@ (uændret fra v1).
//   kind="opkald": "Bestil et opkald". Milot (kontakt@) ringer tilbage. Opretter:
//     1) lead i crm_deals_2026_04_12 (source_channel 'Hjemmeside: bestil opkald', assigned_to 'milot')
//     2) huskeliste-række til kontakt@ med frist i dag — kun en pointer til leadet
//     3) mail til kontakt@ via Graph  4) Slack-DM til Milot (slack-id fra standup_participants)
//   Leadet er artefaktet. Mail/Slack er best-effort: fejler de, er leadet stadig gemt.
// Beskyttelse: fast modtager + honeypot + input-validering + origin-låst CORS + dedup/rate-limit
// på opkald. verify_jwt=false (offentligt endpoint, ingen nøgle i klienten).

const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID") || "";
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET") || "";

const FROM = "tilbud@neminventar.dk";
const TO = ["tilbud@neminventar.dk", "kontakt@neminventar.dk"];
const CALLBACK_OWNER = "kontakt@neminventar.dk"; // Milot — Joachim 30-09-2026

const ALLOWED_ORIGINS = new Set([
  "https://neminventar.dk",
  "https://www.neminventar.dk",
  "http://localhost:4321",
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

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
    return new Response(JSON.stringify({ error: "Prøv igen senere, eller ring på +45 40 14 05 08." }), { status: 429, headers: json });
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
  if (req.method === "GET") return new Response(JSON.stringify({ name: "contact-form", status: "ok", kinds: ["besked", "opkald"] }), { headers: json });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: json });

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Ugyldig forespørgsel." }), { status: 400, headers: json });
  }

  // Honeypot: bots udfylder skjulte felter. Lad som om det lykkedes, send intet.
  if (body?.website || body?.hp) return new Response(JSON.stringify({ success: true }), { headers: json });

  if (body?.kind === "opkald") return await handleCallback(body, json);

  const name = String(body?.name ?? "").trim().slice(0, 200);
  const company = String(body?.company ?? "").trim().slice(0, 200);
  const email = String(body?.email ?? "").trim().slice(0, 200);
  const phone = String(body?.phone ?? "").trim().slice(0, 80);
  const message = String(body?.message ?? "").trim().slice(0, 5000);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !emailRe.test(email) || !message) {
    return new Response(JSON.stringify({ error: "Udfyld navn, en gyldig e-mail og en besked." }), { status: 400, headers: json });
  }

  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#17140E">` +
    `<h2 style="margin:0 0 16px">Ny henvendelse fra neminventar.dk</h2>` +
    `<table style="border-collapse:collapse">` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Navn</td><td><strong>${esc(name)}</strong></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Virksomhed</td><td>${esc(company) || "—"}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">E-mail</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6253">Telefon</td><td>${esc(phone) || "—"}</td></tr>` +
    `</table>` +
    `<p style="margin:16px 0 6px;color:#6b6253">Besked</p>` +
    `<div style="white-space:pre-wrap;border-left:3px solid #C8A86B;padding:8px 14px;background:#faf8f4">${esc(message)}</div>` +
    `<p style="margin-top:20px;color:#9a917f;font-size:13px">Svar (Reply) går direkte til ${esc(email)}.</p>` +
    `</div>`;

  try {
    await sendMail(TO, `Web-henvendelse: ${name}${company ? " · " + company : ""}`, html, email);
    return new Response(JSON.stringify({ success: true }), { headers: json });
  } catch (e) {
    console.error("contact-form error:", e);
    return new Response(JSON.stringify({ error: "Kunne ikke sende beskeden." }), { status: 500, headers: json });
  }
});
