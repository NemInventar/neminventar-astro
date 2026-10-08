// Rene funktioner til contact-form (ingen Deno-API, så de kan testes med node --test).
// lead_kanal i crm_deals_2026_04_12 har en CHECK-regel: ChatGPT/AI, Google, Bing, Byggefakta, Opsøgende,
// Anbefaling, Relation, Opfordret, LinkedIn, Andet, Ukendt. Alt herfra skal lande i den liste.

const SVAR: Record<string, string> = {
  'Google': 'Google',
  'ChatGPT eller anden AI': 'ChatGPT/AI',
  'Anbefaling': 'Anbefaling',
  'LinkedIn': 'LinkedIn',
  'Vi har arbejdet sammen før': 'Relation',
  'Andet': 'Andet',
};

// Den eksterne side, der sendte besøgeren (hostname fra første sidevisning) → lead_kanal.
export function kanalFraHost(h: string): string {
  const s = String(h ?? '').toLowerCase();
  if (!s) return 'Ukendt';
  if (/(chatgpt\.com|openai\.com|perplexity\.ai|copilot\.microsoft\.com|gemini\.google\.com|claude\.ai)/.test(s)) return 'ChatGPT/AI';
  if (/(^|\.)google\./.test(s)) return 'Google';
  if (/(^|\.)bing\.com/.test(s)) return 'Bing';
  if (/linkedin\./.test(s)) return 'LinkedIn';
  return 'Ukendt';
}

// Besøgerens eget svar på "Hvor fandt I os?" vinder; ellers referreren.
export function mapKanal(kildeSvar: string, referrerHost: string): string {
  return SVAR[String(kildeSvar ?? '').trim()] ?? kanalFraHost(referrerHost);
}

export type LeadInput = {
  name: string; company: string; email: string; phone: string; message: string; side: string;
  spor: string; kanal: string; landingsside: string; referrer_host: string; filer: number; permalink?: string;
};

export function byggLead(i: LeadInput) {
  const who = i.company && i.company !== 'Privatkunde' ? i.company : i.name;
  return {
    title: `Web: ${who}`.slice(0, 120),
    pipeline_stage: 'lead',
    assigned_to: 'milot',
    created_by: 'claude_auto',
    source_channel: 'Hjemmeside: formular',
    lead_kanal: i.kanal,
    primary_contact: i.name,
    primary_contact_phone: i.phone || null,
    contact_info: [i.name, i.company, i.email, i.phone].filter(Boolean).join(' · '),
    description: [
      i.message.slice(0, 1500),
      '',
      `Spor: ${i.spor}${i.filer ? ` · ${i.filer} fil(er)` : ''}`,
      i.side ? `Sendt fra: neminventar.dk${i.side}` : '',
      i.landingsside ? `Landingsside: neminventar.dk${i.landingsside}` : '',
      i.referrer_host ? `Kom fra: ${i.referrer_host}` : '',
      i.permalink ? `Konfiguration: ${i.permalink}` : '',
    ].filter((x, n) => x !== '' || n === 1).join('\n'),
    next_step: 'Svar inden for én arbejdsdag',
    tags: ['hjemmeside', 'formular', i.spor].filter(Boolean),
  };
}

// Uden Turnstile: udfyldt på under 3 sekunder eller 6+ links i beskeden → mailen sendes, men intet lead.
// ms mangler i gamle v5-kald → ikke mistænkt. Grænsen var 3 links indtil v9: en entreprenør, der indsætter links til
// Dalux, iBinder og Byggefakta, er tre links og en rigtig kunde (Fable 07-10-2026).
export const MAX_LINKS = 6;
export function erMistaenkelig(x: { ms?: number; message: string }): boolean {
  if (typeof x.ms === 'number' && x.ms < 3000) return true;
  return (String(x.message).match(/https?:\/\//g) ?? []).length >= MAX_LINKS;
}
