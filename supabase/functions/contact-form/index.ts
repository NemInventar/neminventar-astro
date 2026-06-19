import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Offentlig kontaktformular-handler for neminventar.dk.
// Sender en notifikation via Microsoft Graph til NI's egne indbakker (FAST modtager — ingen open relay).
// Genbruger ERP-projektets MS_GRAPH_*-secrets (samme som mcp-send-mail).
// Beskyttelse: fast modtager + honeypot + input-validering + origin-låst CORS. verify_jwt=false (offentligt endpoint).
//
// Deployet til Supabase-projekt guhbrpektblabndqttgp (Projektportal Neminventar) som function-slug "contact-form".
// Redeploy: supabase functions deploy contact-form --no-verify-jwt   (eller via Supabase MCP deploy_edge_function).

const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID") || "";
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET") || "";

const FROM = "tilbud@neminventar.dk";
const TO = ["tilbud@neminventar.dk", "kontakt@neminventar.dk"];

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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = { "Content-Type": "application/json", ...cors };

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") return new Response(JSON.stringify({ name: "contact-form", status: "ok" }), { headers: json });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: json });

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Ugyldig forespørgsel." }), { status: 400, headers: json });
  }

  // Honeypot: bots udfylder skjulte felter. Lad som om det lykkedes, send intet.
  if (body?.website || body?.hp) return new Response(JSON.stringify({ success: true }), { headers: json });

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
    const token = await getGraphToken();
    const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: `Web-henvendelse: ${name}${company ? " · " + company : ""}`,
          body: { contentType: "HTML", content: html },
          toRecipients: TO.map((a) => ({ emailAddress: { address: a } })),
          replyTo: [{ emailAddress: { address: email } }],
        },
        saveToSentItems: false,
      }),
    });
    if (!resp.ok) throw new Error(`Graph sendMail: ${resp.status} ${await resp.text()}`);
    return new Response(JSON.stringify({ success: true }), { headers: json });
  } catch (e) {
    console.error("contact-form error:", e);
    return new Response(JSON.stringify({ error: "Kunne ikke sende beskeden." }), { status: 500, headers: json });
  }
});
