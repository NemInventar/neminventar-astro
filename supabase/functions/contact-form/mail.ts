// Den interne mail til tilbud@ og kontakt@, når nogen skriver via neminventar.dk eller designeren (v10, 23-11-2026).
// Joachim 23-11-2026 om Lones henvendelse: "nærmest værdiløst". Målet: Milot forstår henvendelsen på 10 sekunder uden
// at klikke. Øverst én sætning (hvem, hvad, hvorfra), så historikken, så det, kunden så eller byggede, beskeden,
// filerne (billeder inline, tekst fra docx/odt/txt/csv) og til sidst detaljerne.
// Rene funktioner uden netværk og uden Deno-API: testes med node --test (mail.test.ts). index.ts henter data
// (varianter.json, filernes tekst, historikken) og kalder bygMail; fejler noget, sender den v9-mailen.
//
// Kilderne:
//   spor 'variant': konfiguration { type: 'variant', produkt, kuloer } fra kontaktsidens ?v= (src/lib/varianter.ts).
//     Navn, kulør, sider og pris slås op i sitets egen https://neminventar.dk/varianter.json (src/pages/varianter.json.ts).
//   spor 'designer': designerens besked (ni-apps public/prisbog/designer/core/forespoergsel.js, beskedAf) bærer hele
//     specifikationen som tekst: "Bygget i designeren (Bænk):", "1. <titel> — Label: værdi · Label: værdi", og efter en
//     tom linje ordrens valg ("Levering: …", "Pris i designeren: …"). Den er designerens egen og den rigtige; konfigurationen
//     er designerens rå tilstand med rester fra andre produkter (en bænk har h: 210), så den bruges kun, hvis teksten mangler.

export type Fil = { name: string; size: number; path: string; url?: string };
export type Udtraek = { tekst: string; afkortet: boolean };
export type Pris = { inkl: number; ex: number; link?: string | null };
export type VariantInfo = {
  navn: string; url: string; label: string; img?: string | null; designer?: string | null;
  laager: boolean; korpus?: string | null;
  pris?: Pris | null;               // undefined = varianter.json har ingen pris-felt; null = typen har ingen pris (til mål)
};
export type Tidligere = { tid: string; dato: string; emne: string; lead: string | null; stadie?: string | null };
export type Vare = { titel: string; linjer: [string, string][] };
export type DesignerSpec = {
  engelsk: boolean; egneOrd: string; produkt: string; varer: Vare[]; ordre: [string, string][];
  pris: string | null; prisFoelger: boolean;
};

export type MailInput = {
  name: string; company: string; email: string; phone: string; message: string; side: string;
  spor: string; kanal: string; kildeSvar: string; referrerHost: string; landingsside: string;
  konfiguration: Record<string, unknown> | null; permalink: string;
  files: Fil[]; valgteFiler: number; folder: string; bucket: string; linkDays: number;
  leadId: string | null; leadNote: string; rowId: string | null;
  variant?: VariantInfo | null;
  udtraek?: Record<string, Udtraek>;     // pr. fil-sti
  historik?: Tidligere[] | null;         // null = kunne ikke slås op · undefined = ikke slået op
};

// ---------- små hjælpere ----------
export const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Outlook (Word-motoren) ignorerer white-space: pre-wrap, så v9-mailen viste beskeden på én linje. Linjeskift → <br>.
export const tekstHtml = (s: unknown) => esc(String(s ?? '').replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>');
// Første bogstav småt midt i en sætning ("Højskab i krydsfiner" → "højskab i krydsfiner"), men ikke forkortelser (HPL)
export const smaat = (s: string) => (/^[A-ZÆØÅ][a-zæøå]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
export const kr = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const extAf = (n: string) => (String(n).match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? '').toLowerCase();
export const fmtSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

// Danske numre sammenlignes uden landekode: "+45 40 14 05 08", "004540140508" og "40140508" er samme nummer.
export function normPhone(p: unknown): string {
  const d = String(p ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('0045')) return d.slice(4);
  if (d.length === 10 && d.startsWith('45')) return d.slice(2);
  return d;
}
const visTelefon = (p: string) => { const d = normPhone(p); return d.length === 8 ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : p; };

export function datoDK(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date(t));
  const [y, m, dd] = d.split('-');
  return `${dd}-${m}-${y}`;
}

// Første ikke-tomme linje, skåret ved et ordskifte
export function foersteLinje(s: string, maks: number): string {
  const l = String(s ?? '').replace(/\r\n?/g, '\n').split('\n').map((x) => x.trim()).find(Boolean) ?? '';
  if (l.length <= maks) return l;
  const cut = l.slice(0, maks), sp = cut.lastIndexOf(' ');
  return `${(sp > maks * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

// "Vedr. Højskab i krydsfiner, cotton white" er formularens egen linje (prisHref/variantTilbud). Resten er kundens ord.
export function vedrAf(message: string): { emne: string | null; rest: string } {
  const linjer = String(message ?? '').replace(/\r\n?/g, '\n').split('\n');
  const i = linjer.findIndex((l) => l.trim());
  const m = i >= 0 ? linjer[i].trim().match(/^(?:Vedr\.|Re:)\s*(.+)$/) : null;
  if (!m) return { emne: null, rest: String(message ?? '').trim() };
  return { emne: m[1].trim(), rest: linjer.slice(i + 1).join('\n').trim() };
}

// ---------- designeren ----------
export const SPROG_LINJE = 'Sprog: engelsk';

// "Label: værdi · Label: værdi · fortsættelse" → [[label, værdi]]. En del uden "Label: " hører til værdien før
// ("Sædehøjde: 42 cm · sokkel 15 cm"); et label starter med stort bogstav eller tal og er højst 40 tegn.
export function specLinjer(s: string): [string, string][] {
  const ud: [string, string][] = [];
  for (const del of String(s ?? '').split(' · ')) {
    const m = del.match(/^([A-ZÆØÅ0-9][^:]{0,40}):\s+(.*)$/s);
    if (m) ud.push([m[1].trim(), m[2].trim()]);
    else if (ud.length) ud[ud.length - 1][1] += ` · ${del.trim()}`;
    else if (del.trim()) ud.push(['', del.trim()]);
  }
  return ud;
}

export function designerSpec(message: string): DesignerSpec | null {
  const linjer = String(message ?? '').replace(/\r\n?/g, '\n').split('\n');
  const i = linjer.findIndex((l) => /^Bygget i designeren \(.*\):$/.test(l.trim()));
  if (i < 0) return null;
  const produkt = linjer[i].trim().match(/^Bygget i designeren \((.*)\):$/)![1];
  let foer = linjer.slice(0, i);
  const engelsk = (foer[0] ?? '').trim().startsWith(SPROG_LINJE);
  if (engelsk) foer = foer.slice(1);
  let egneOrd = foer.join('\n').trim();
  if (egneOrd === '(ingen besked)') egneOrd = '';
  const varer: Vare[] = [];
  let j = i + 1;
  for (; j < linjer.length; j++) {
    const l = linjer[j].trim();
    if (!l) break;
    const m = l.match(/^\d+\.\s+(.*)$/);
    if (!m) { if (varer.length) varer[varer.length - 1].linjer.push(...specLinjer(l)); continue; }
    const k = m[1].indexOf(' — ');
    varer.push({ titel: (k >= 0 ? m[1].slice(0, k) : m[1]).trim(), linjer: k >= 0 ? specLinjer(m[1].slice(k + 3)) : [] });
  }
  const ordre: [string, string][] = [];
  for (; j < linjer.length; j++) {
    const l = linjer[j].trim();
    if (!l) continue;
    const m = l.match(/^([^:]{1,60}):\s*(.*)$/);
    ordre.push(m ? [m[1].trim(), m[2].trim()] : ['', l]);
  }
  const p = ordre.find(([k]) => /^Pris i designeren/.test(k));
  const prisFoelger = !!p && /pris følger/i.test(p[1]);
  return { engelsk, egneOrd, produkt, varer, ordre, pris: p && !prisFoelger ? p[1] : null, prisFoelger };
}

// Reserve, hvis designerens tekst mangler: en lille ordbog over designerens tilstand (ni-apps core/katalog.js PLADENAVN,
// core/rubio.js, produkternes greb). Kun felter, der betyder det samme i alle produkter.
const PRODUKT: Record<string, string> = { locker: 'Lockers', hoejskab: 'Højskab', baenk: 'Bænk', badmoebel: 'Bademøbel', akustik: 'Akustikpaneler', niche: 'Niche', koekken: 'Køkken' };
const MAT: Record<string, string> = {
  birk: 'Birkekrydsfiner', eg: 'Egetræsfinér', ask: 'Askefinér', boeg: 'Bøgefinér', shinnoki: 'Shinnoki, færdigbehandlet finér',
  kryds: 'Krydsfiner (fyr)', kompakt: 'Kompaktlaminat', melamin: 'Hvid melamin', dekor: 'Trædekor', egmassiv: 'Massiv eg', valnoed: 'Massiv valnød',
};
const OLIE: Record<string, string> = {
  natur: 'klar olie', roedbrun: 'Rødbrun', blaa: 'Blå', charcoal: 'Charcoal', 'cotton-white': 'Cotton White',
  cocoa: 'Cocoa', 'dark-roast': 'Dark Roast', fern: 'Fern',
};
const GREB: Record<string, string> = { push: 'Uden greb, tryk for at åbne', finger: 'Fingergreb', slids: 'Fræset greb', luksus: 'Designgreb', knop: 'Knop', bojle: 'Bøjlegreb' };
const LAAS: Record<string, string> = { elektronisk: 'Elektronisk lås', noegle: 'Nøglelås', haengelaas: 'Hængelås', ingen: 'Ingen lås' };
export const farveNavn = (slug: unknown) => {
  const s = String(slug ?? '');
  return OLIE[s] ?? s.split('-').filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1)).join(' ');
};

export function specFraKonfiguration(konf: Record<string, any> | null, permalink: string): { produkt: string; linjer: [string, string][] } | null {
  if (!konf || typeof konf !== 'object') return null;
  let p = '';
  try { p = permalink ? new URL(permalink).searchParams.get('p') ?? '' : ''; } catch { /* intet link */ }
  p = p || String(konf.t ?? '');
  const produkt = PRODUKT[p] ?? (p || 'Ukendt produkt');
  if (Array.isArray(konf.varer)) {
    return { produkt, linjer: [['Varer', `${konf.varer.length}${konf.flere_end_vist ? ` (og ${konf.flere_end_vist} mere, der ikke var plads til)` : ''}`]] };
  }
  const l: [string, string][] = [];
  const n = (k: string) => (typeof konf[k] === 'number' ? konf[k] as number : null);
  if (p === 'hoejskab' && n('b') && n('h') && n('d')) l.push(['Mål pr. skab', `${n('b')} × ${n('h')} × ${n('d')} cm${(n('n') ?? 1) > 1 ? `, ${n('n')} skabe` : ''}`]);
  if (p === 'locker' && n('soejler') && n('raekker')) l.push(['Rum', `${n('soejler')} × ${n('raekker')}${n('b') && n('h') && n('d') ? `, ${n('b')} × ${n('h')} × ${n('d')} cm pr. rum` : ''}`]);
  const mat = String(konf.mat ?? '');
  if (MAT[mat]) {
    const f = (konf.farve as Record<string, string> | undefined)?.[mat];
    l.push(['Materiale', `${MAT[mat]}${f ? `, ${farveNavn(f)}` : ''}`]);
  }
  if (konf.front === 'farve') l.push(['Låger', `farvet olie, ${farveNavn((konf.farve as any)?.laage)}`]);
  else if (konf.front === 'laminat') l.push(['Låger', 'HPL-laminat']);
  if (GREB[String(konf.greb)]) l.push(['Greb', GREB[String(konf.greb)]]);
  if (LAAS[String(konf.laas)]) l.push(['Lås', LAAS[String(konf.laas)]]);
  return { produkt, linjer: l };
}

// ---------- varianten fra sitet ----------
// Designerens tilstand fra et link (?t=<base64url(JSON)>)
export function tilstandAf(url: unknown): Record<string, any> | null {
  try {
    const t = new URL(String(url)).searchParams.get('t');
    if (!t) return null;
    const b = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))));
  } catch { return null; }
}

// varianter.json (sitets egen) + konfigurationen → det, kunden så på siden. null, hvis typen ikke findes.
export function variantInfo(vj: any, konf: Record<string, unknown> | null): VariantInfo | null {
  if (!konf || konf.type !== 'variant') return null;
  const t = (Array.isArray(vj?.typer) ? vj.typer : []).find((x: any) => x?.slug === konf.produkt);
  if (!t?.navn) return null;
  const v = (Array.isArray(t.varianter) ? t.varianter : []).find((x: any) => x?.kuloer === konf.kuloer);
  const paletter = Object.values(vj?.paletter ?? {}).flat() as { kuloer: string; label: string }[];
  const paletLabel = (k: unknown) => paletter.find((x) => x?.kuloer === k)?.label;
  const label = v?.label ?? paletLabel(konf.kuloer) ?? farveNavn(konf.kuloer);
  const designer = typeof v?.ifc === 'string' ? v.ifc.replace(/[?&]hent=[a-z]+$/, '') : (t.designer ?? null);
  const st = tilstandAf(designer);
  // Farvede låger på klar korpus (src/lib/forside.ts TILSTAND: front 'farve' + farve.laage)
  const laager = !!st && st.front === 'farve' && st.farve?.laage === konf.kuloer;
  const korpusSlug = laager ? st!.farve?.[st!.mat] ?? 'natur' : null;
  const korpus = korpusSlug ? smaat(paletLabel(korpusSlug) ?? farveNavn(korpusSlug)) : null;
  const pris = !('pris' in t) ? undefined
    : t.pris && typeof t.pris.inkl === 'number' ? { inkl: t.pris.inkl, ex: t.pris.ex, link: t.pris.link ?? null } : null;
  return { navn: t.navn, url: v?.url ?? t.url, label, img: v?.img ?? null, designer, laager, korpus, pris };
}

// ---------- historik ----------
export type HistLead = { id: string; created_at: string; title?: string | null; pipeline_stage?: string | null; contact_info?: string | null; primary_contact_phone?: string | null };
export type HistWeb = { id: string; created_at: string; kind?: string | null; message?: string | null; spor?: string | null; email?: string | null; phone?: string | null; crm_deal_id?: string | null };

// Emnet på en tidligere henvendelse, kort
export function emneAf(message: string): string {
  const d = designerSpec(message);
  if (d) return `Designer: ${d.varer.length === 1 ? d.varer[0].titel : d.produkt}`;
  const v = vedrAf(message);
  return v.emne ? foersteLinje(v.emne, 70) : foersteLinje(message, 70);
}

// Samme mail eller telefon før: tidligere henvendelser (med deres lead) og leads, der ikke kom fra en henvendelse
// (fx opkald og leads lagt ind i hånden). Nyeste først. Denne henvendelse og et lead, den lige har oprettet, er ikke med.
export function historikAf(x: { leads: HistLead[]; henvendelser: HistWeb[]; email: string; phone: string; rowId: string | null; leadId: string | null; nytLead: boolean }): Tidligere[] {
  const em = String(x.email ?? '').trim().toLowerCase();
  const ph = normPhone(x.phone);
  const sammeTlf = (p: unknown) => ph.length >= 8 && normPhone(p) === ph;
  const set = new Set<string>();
  const web = (x.henvendelser ?? []).filter((r) => {
    if (!r?.id || set.has(r.id) || r.id === x.rowId || (r.kind ?? 'besked') !== 'besked') return false;
    set.add(r.id);
    return (!!em && String(r.email ?? '').trim().toLowerCase() === em) || sammeTlf(r.phone);
  });
  const brugt = new Set(web.map((r) => r.crm_deal_id).filter(Boolean) as string[]);
  const leads = (x.leads ?? []).filter((l) => {
    if (!l?.id || set.has(l.id) || brugt.has(l.id) || (x.nytLead && l.id === x.leadId)) return false;
    set.add(l.id);
    const mails = String(l.contact_info ?? '').split('·').map((s) => s.trim().toLowerCase());
    return (!!em && mails.includes(em)) || sammeTlf(l.primary_contact_phone);
  });
  const ud: Tidligere[] = [
    ...web.map((r) => ({ tid: r.created_at, dato: datoDK(r.created_at), emne: emneAf(r.message ?? ''), lead: r.crm_deal_id ? String(r.crm_deal_id).slice(0, 8) : null })),
    ...leads.map((l) => ({ tid: l.created_at, dato: datoDK(l.created_at), emne: foersteLinje(l.title ?? 'Lead', 70), lead: String(l.id).slice(0, 8), stadie: l.pipeline_stage ?? null })),
  ];
  return ud.sort((a, b) => (Date.parse(b.tid) || 0) - (Date.parse(a.tid) || 0));
}

// ---------- filer ----------
const BILLED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
export const erBillede = (f: Fil) => BILLED_EXT.has(extAf(f.name));
// designerens egne 3D-billeder (forespoergsel.js upload: designer-1.png …)
export const erRender = (f: Fil, spor: string) => spor === 'designer' && /^designer-\d+\.png$/i.test(f.name);

function filListe(kunde: Fil[], udtraek: Record<string, Udtraek>): string {
  if (!kunde.length) return '';
  const billeder = kunde.filter(erBillede);
  const tekst = kunde.filter((f) => !erBillede(f) && udtraek[f.path]);
  const andre = kunde.filter((f) => !erBillede(f) && !udtraek[f.path]);
  const dele: string[] = [];
  if (billeder.length) dele.push(`${billeder.length === 1 ? '1 billede' : `${billeder.length} billeder`} (vist nedenfor)`);
  for (const f of tekst) dele.push(f.name);
  if (andre.length <= 3) dele.push(...andre.map((f) => f.name));
  else dele.push(`${andre.length} andre filer`);
  return dele.length > 1 ? `${dele.slice(0, -1).join(', ')} og ${dele[dele.length - 1]}` : dele[0];
}

// ---------- resuméet og emnelinjen ----------
const KILDE: Record<string, string> = {
  Google: 'Kom fra Google.', Bing: 'Kom fra Bing.', 'ChatGPT/AI': 'Kom fra ChatGPT eller en anden AI.', LinkedIn: 'Kom fra LinkedIn.',
  Anbefaling: 'Kom via en anbefaling.', Relation: 'Har arbejdet med os før.', Andet: 'Svarede "Andet" til, hvor de fandt os.',
  Byggefakta: 'Kom via Byggefakta.', Ukendt: 'Kilden er ukendt.',
};
const citat = (s: string) => `"${foersteLinje(s, 140).replace(/[.]$/, '')}"`;

export function resumeAf(i: MailInput): string {
  const firma = i.company && i.company !== 'Privatkunde' ? i.company : '';
  const hvem = firma ? `${i.name} fra ${firma}` : i.company === 'Privatkunde' ? `${i.name} (privat)` : i.name;
  const spec = i.spor === 'designer' ? designerSpec(i.message) : null;
  const vedr = vedrAf(i.message);
  const s: string[] = [];
  if (spec && spec.varer.length) {
    const v = spec.varer;
    const ting = v.length === 1 ? smaat(v[0].titel) : `${v.length} ting (${v.map((x) => smaat(x.titel)).join(', ')})`;
    const mat = v.length === 1 ? v[0].linjer.find(([k]) => k === 'Materiale' || k === 'Material')?.[1] : null;
    s.push(`${hvem} har bygget ${ting} i designeren${mat ? ` (${mat})` : ''}.`);
    if (spec.egneOrd) s.push(`Skriver: ${citat(spec.egneOrd)}.`);
    if (spec.pris) s.push(`Designerens pris: ${spec.pris}.`);
    else if (spec.prisFoelger) s.push('Designeren kunne ikke regne en pris.');
  } else if (i.variant) {
    s.push(`${hvem} spørger om ${smaat(i.variant.navn)} ${i.variant.laager ? `med låger i ${i.variant.label}` : `i ${i.variant.label}`}.`);
    if (vedr.rest) s.push(`Skriver også: ${citat(vedr.rest)}.`);
  } else if (vedr.emne) {
    s.push(`${hvem} spørger om ${vedr.emne.replace(/[.]$/, '')}.`);
    if (vedr.rest) s.push(`Skriver også: ${citat(vedr.rest)}.`);
  } else if (i.spor === 'designer') {
    s.push(`${hvem} har bygget noget i designeren.`);
  } else {
    s.push(`${hvem} skriver: ${citat(i.message)}.`);
  }
  const kunde = i.files.filter((f) => !erRender(f, i.spor));
  const filer = filListe(kunde, i.udtraek ?? {});
  if (filer) s.push(`Vedhæftet: ${filer}.`);
  // Ønsket står ofte i filen (Lones docx: "Jeg skal bruge 3 garderobeskabe …"), så den første tekstfils første linje med
  const tf = kunde.find((f) => !erBillede(f) && i.udtraek?.[f.path]);
  if (tf) s.push(`${tf.name} begynder: ${citat(i.udtraek![tf.path].tekst)}.`);
  if (spec?.engelsk) s.push('Skrev fra den engelske designer, så svar på engelsk.');
  s.push(KILDE[i.kanal] ?? `Kom fra ${i.kanal}.`);
  return s.join(' ');
}

export function emnelinje(i: MailInput): string {
  const firma = i.company && i.company !== 'Privatkunde' ? ` · ${i.company}` : '';
  const spec = i.spor === 'designer' ? designerSpec(i.message) : null;
  const vedr = vedrAf(i.message);
  let hvad = '';
  if (spec && spec.varer.length) hvad = `Designer: ${spec.varer.length === 1 ? spec.varer[0].titel : `${spec.produkt}, ${spec.varer.length} ting`}`;
  else if (i.variant) hvad = `${i.variant.navn}, ${i.variant.label}`;
  else if (vedr.emne) hvad = foersteLinje(vedr.emne, 60);
  else if (i.spor === 'designer') hvad = 'Designer';
  else hvad = foersteLinje(i.message, 50);
  const n = i.files.filter((f) => !erRender(f, i.spor)).length;
  const s = `Web-henvendelse: ${i.name}${firma}${hvad ? ` · ${hvad}` : ''}${n ? ` · ${n} ${n === 1 ? 'fil' : 'filer'}` : ''}${i.leadId ? ` [CRM ${String(i.leadId).slice(0, 8)}]` : ''}`;
  return s.replace(/[\r\n]+/g, ' ').slice(0, 250);
}

// ---------- HTML ----------
const C = { tekst: '#17140E', graa: '#6b6253', lys: '#9a917f', guld: '#C8A86B', bund: '#faf8f4', rod: '#9B2C2C', kant: '#e5dfd3' };
const H = (t: string) => `<h3 style="margin:24px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.graa}">${esc(t)}</h3>`;
const tabel = (rk: [string, string][]) => rk.length
  ? `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
    rk.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:${C.graa};vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;vertical-align:top">${v}</td></tr>`).join('') +
    `</table>`
  : '';
const citatBoks = (html: string) => `<div style="border-left:3px solid ${C.guld};padding:8px 14px;background:${C.bund}">${html}</div>`;
const lille = (html: string, top = 6) => `<p style="margin:${top}px 0 0;color:${C.lys};font-size:13px">${html}</p>`;
const link = (url: string | null | undefined, tekst: string) => (url ? `<a href="${esc(url)}">${esc(tekst)}</a>` : esc(tekst));
const billede = (url: string, alt: string, bredde = 520) =>
  `<a href="${esc(url)}"><img src="${esc(url)}" alt="${esc(alt)}" width="${bredde}" style="display:block;width:100%;max-width:${bredde}px;height:auto;border:1px solid ${C.kant};margin:4px 0 0"></a>`;

function historikHtml(h: Tidligere[] | null | undefined): string {
  if (h === undefined) return '';
  if (h === null) return `<p style="margin:0 0 4px;color:${C.graa}">Historik: kunne ikke slås op.</p>`;
  if (!h.length) return `<p style="margin:0 0 4px"><strong>Første henvendelse</strong> <span style="color:${C.graa}">fra denne mail og dette telefonnummer.</span></p>`;
  const vist = h.slice(0, 5);
  return `<p style="margin:0 0 4px"><strong>Har skrevet før (${h.length}):</strong></p><ul style="margin:0;padding-left:18px">` +
    vist.map((t) => `<li style="margin:2px 0">${esc(t.dato)} · ${esc(t.emne)}${t.lead ? ` · lead ${esc(t.lead)}` : ''}${t.stadie ? ` (${esc(t.stadie)})` : ''}</li>`).join('') +
    (h.length > vist.length ? `<li style="margin:2px 0;color:${C.graa}">og ${h.length - vist.length} mere</li>` : '') + `</ul>`;
}

function variantHtml(i: MailInput): string {
  const k = i.konfiguration;
  if (i.spor !== 'variant' && !i.variant) return '';
  const v = i.variant;
  if (!v) {
    if (!k || k.type !== 'variant') return '';
    const url = `https://neminventar.dk/produkter/${encodeURIComponent(String(k.produkt))}#v-${encodeURIComponent(String(k.kuloer))}`;
    return H('Det, kunden så på siden') + tabel([['Produkt', link(url, String(k.produkt))], ['Kulør', esc(String(k.kuloer))]]) +
      lille('Produktdata fra sitet kunne ikke hentes, så navnene står som i linket.');
  }
  const rk: [string, string][] = [['Produkt', link(v.url, v.navn)]];
  rk.push(['Kulør', v.laager ? `${esc(v.label)} på lågerne${v.korpus ? `, korpus i ${esc(v.korpus)}` : ''}` : esc(v.label)]);
  if (v.pris) rk.push(['Pris på siden', `<strong>${kr(v.pris.inkl)} kr.</strong> inkl. moms (${kr(v.pris.ex)} kr. ekskl. moms), standardudgaven i designeren, ekskl. levering${v.pris.link ? ` · ${link(v.pris.link, 'se den')}` : ''}`]);
  else if (v.pris === null) rk.push(['Pris på siden', 'Ingen, typen er til mål']);
  if (v.designer) rk.push(['Designeren', link(v.designer, 'Åbn varianten i designeren')]);
  return H('Det, kunden så på siden') +
    `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>` +
    (v.img ? `<td style="padding:0 16px 0 0;vertical-align:top" width="160"><a href="${esc(v.url)}"><img src="${esc(v.img)}" alt="${esc(`${v.navn}, ${v.label}`)}" width="160" style="display:block;width:160px;height:auto;border:1px solid ${C.kant}"></a></td>` : '') +
    `<td style="vertical-align:top">${tabel(rk)}</td></tr></table>`;
}

function designerHtml(i: MailInput, renders: Fil[]): string {
  if (i.spor !== 'designer') return '';
  const spec = designerSpec(i.message);
  let krop = '';
  if (spec && spec.varer.length) {
    krop = spec.varer.map((v, n) =>
      `<p style="margin:${n ? 14 : 0}px 0 4px"><strong>${spec.varer.length > 1 ? `${n + 1}. ` : ''}${esc(v.titel)}</strong></p>` +
      tabel(v.linjer.map(([k, x]) => [k, esc(x)]))).join('');
    if (spec.ordre.length) {
      krop += `<div style="margin-top:10px">` + tabel(spec.ordre.map(([k, x]) => [k, /^Pris i designeren/.test(k) ? `<strong>${esc(x)}</strong>` : esc(x)])) + `</div>`;
    } else {
      krop += lille('Designeren sendte ingen pris (produktet har ingen prismodel i designeren).', 8);
    }
  } else {
    const f = specFraKonfiguration(i.konfiguration as Record<string, any> | null, i.permalink);
    if (f) krop = `<p style="margin:0 0 4px"><strong>${esc(f.produkt)}</strong></p>` + tabel(f.linjer.map(([k, x]) => [k, esc(x)])) +
      lille('Udledt af konfigurationen, fordi designerens egen beskrivelse manglede. Tjek i designeren.');
  }
  if (i.permalink) krop += `<p style="margin:10px 0 0">${link(i.permalink, 'Åbn i designeren')}</p>`;
  for (const r of renders.slice(0, 5)) if (r.url) krop += billede(r.url, `3D fra designeren: ${r.name}`);
  return H(spec?.produkt ? `Bygget i designeren: ${spec.produkt}` : 'Bygget i designeren') + krop;
}

function filerHtml(i: MailInput, kunde: Fil[]): string {
  const ud = i.udtraek ?? {};
  let h = '';
  let vist = 0;
  for (const f of kunde) {
    h += `<p style="margin:12px 0 2px">${link(f.url, f.name)} <span style="color:${C.lys}">· ${fmtSize(f.size)}</span></p>`;
    if (f.url && erBillede(f) && vist < 8) { h += billede(f.url, f.name); vist++; }
    const t = ud[f.path];
    if (t) {
      h += citatBoks(tekstHtml(t.tekst) + (t.afkortet ? ' …' : ''));
      if (t.afkortet) h += lille(`De første ${kr(t.tekst.length)} tegn. Resten står i filen.`, 4);
    }
  }
  return h;
}

export function bygMail(i: MailInput): { subject: string; html: string } {
  const renders = i.files.filter((f) => erRender(f, i.spor));
  const kunde = i.files.filter((f) => !erRender(f, i.spor));
  const spec = i.spor === 'designer' ? designerSpec(i.message) : null;
  const tlf = String(i.phone ?? '').trim();
  const cifre = tlf.replace(/\D/g, '');

  const kontakt = [
    tlf ? `<a href="tel:${esc(cifre)}">${esc(visTelefon(tlf))}</a>` : 'intet telefonnummer',
    `<a href="mailto:${esc(i.email)}">${esc(i.email)}</a>`,
  ].join(' · ');

  // Beskeden: designerens egen specifikation står ovenfor, så her kun kundens egne ord
  let besked = '';
  if (spec) besked = spec.egneOrd ? citatBoks(tekstHtml(spec.egneOrd)) : `<p style="margin:0;color:${C.graa}">Ingen besked, kun det byggede.</p>`;
  else besked = citatBoks(tekstHtml(i.message));

  const kilde = `<strong>${esc(i.kanal)}</strong>${i.kildeSvar ? ` · svar: ${esc(i.kildeSvar)}` : ''}${i.referrerHost ? ` · kom fra ${esc(i.referrerHost)}` : ''}`;
  const detaljer: [string, string][] = [
    ['Navn', `<strong>${esc(i.name)}</strong>`],
    ['Virksomhed', esc(i.company) || '—'],
    ['E-mail', `<a href="mailto:${esc(i.email)}">${esc(i.email)}</a>`],
    ['Telefon', tlf ? `<a href="tel:${esc(cifre)}">${esc(tlf)}</a>` : '—'],
    ['Kilde', kilde],
    ...(i.side ? [['Sendt fra', `neminventar.dk${esc(i.side)}`] as [string, string]] : []),
    ...(i.landingsside && i.landingsside !== i.side ? [['Landingsside', `neminventar.dk${esc(i.landingsside)}`] as [string, string]] : []),
    ['Spor', esc(i.spor)],
    ['Lead i CRM', i.leadId ? `${esc(String(i.leadId).slice(0, 8))}${i.leadNote ? ` (${esc(i.leadNote)})` : ''} · på Milots huskeliste` : esc(i.leadNote || '—')],
    ...(i.rowId ? [['Henvendelse', esc(String(i.rowId).slice(0, 8))] as [string, string]] : []),
  ];

  const tabtFiler = i.valgteFiler > i.files.length
    ? `<p style="margin:12px 0 0;color:${C.rod};font-size:13px">Afsenderen valgte ${i.valgteFiler} fil(er), men ${i.valgteFiler - i.files.length} nåede ikke frem til Storage. Spørg efter dem på mail.</p>`
    : '';

  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.45;color:${C.tekst};max-width:680px">` +
    `<p style="margin:0 0 10px;font-size:18px;line-height:1.4"><strong>${esc(resumeAf(i))}</strong></p>` +
    `<p style="margin:0 0 12px">${kontakt}</p>` +
    historikHtml(i.historik) +
    variantHtml(i) +
    designerHtml(i, renders) +
    H(spec ? 'Kundens egne ord' : 'Besked') + besked +
    (kunde.length ? H(`Vedhæftet (${kunde.length})`) + filerHtml(i, kunde) : '') +
    tabtFiler +
    (i.files.length ? lille(`Links virker i ${i.linkDays} dage. Filerne ligger i Supabase Storage: ${esc(i.bucket)}/${esc(i.folder)}`, 10) : '') +
    H('Detaljer') + tabel(detaljer) +
    `<p style="margin-top:20px;color:${C.lys};font-size:13px">Svar (Reply) går direkte til ${esc(i.email)}.</p>` +
    `</div>`;
  return { subject: emnelinje(i), html };
}
