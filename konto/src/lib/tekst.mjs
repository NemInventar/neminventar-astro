// Kundeteksten på konto.neminventar.dk: kataloget (konto/tekster/*.json, ordret fra Fable runde 3 d1–d4) og de små
// hjælpere, der sætter den ind i HTML. Rene funktioner — kører i browseren (Vite bundler JSON'en med) og i node:test.
//
// t(sprog, nøgle, vars)        → tekst med {navn} udfyldt. En nøgle, kataloget ikke har, giver TODO-TEKST:<nøgle>
//                                 (kontrakter.md §0: en manglende tekst opfindes ikke, den vises og meldes).
// tHtml(sprog, nøgle, vars, h) → samme, escapet til HTML; vars escapes, h indsættes som HTML (fx en fed e-mail).
//                                 Vores telefonnummer og tilbud@ bliver links i den faste tekst.
import da from '../../tekster/da.json' with { type: 'json' };
import en from '../../tekster/en.json' with { type: 'json' };
import ordreDa from '../../tekster/ordre.da.json' with { type: 'json' };
import { kr } from '../../vendor/webordre/beloeb.mjs';

// Ordresiden er kun dansk (Fable d4); dens tekster står for sig i ordre.da.json.
const KATALOG = Object.freeze({ da: Object.freeze({ ...da, ...ordreDa }), en: Object.freeze({ ...en }) });

export const TELEFON = '+45 42 42 26 84';
export const TELEFON_HREF = 'tel:+4542422684';
export const MAIL = 'tilbud@neminventar.dk';
export const SITE = 'https://neminventar.dk';

export const sprogAf = (s) => (s === 'en' ? 'en' : 'da');

export function raa(sprog, noegle) {
  const k = KATALOG[sprogAf(sprog)];
  return Object.hasOwn(k, noegle) ? k[noegle] : `TODO-TEKST:${noegle}`;
}

export function t(sprog, noegle, vars = {}) {
  return raa(sprog, noegle).replace(/\{(\w+)\}/g, (m, n) => (Object.hasOwn(vars, n) ? String(vars[n]) : m));
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// Telefon og tilbud@ i en allerede escapet tekst → links. emne = mailens emne (fx ordrenummeret).
export function linkify(escaped, { emne } = {}) {
  const mail = emne ? `mailto:${MAIL}?subject=${encodeURIComponent(emne)}` : `mailto:${MAIL}`;
  return escaped
    .split(TELEFON).join(`<a class="lnk nob" href="${TELEFON_HREF}">${TELEFON}</a>`)
    .split(MAIL).join(`<a class="lnk" href="${esc(mail)}">${MAIL}</a>`);
}

export function tHtml(sprog, noegle, vars = {}, html = {}, opts = {}) {
  const dele = raa(sprog, noegle).split(/\{(\w+)\}/);
  let ud = '';
  for (let i = 0; i < dele.length; i++) {
    if (i % 2 === 0) { ud += linkify(esc(dele[i]), opts); continue; }
    const n = dele[i];
    if (Object.hasOwn(html, n)) ud += html[n];
    else if (Object.hasOwn(vars, n)) ud += esc(vars[n]);
    else ud += esc(`{${n}}`);
  }
  return ud;
}

// "**Bestillinger** · Leveringsuge …" (Fable login.raekke1) → { fed, rest }
export function fedOgRest(s) {
  const m = /^\*\*(.+?)\*\*\s*·\s*(.*)$/.exec(s);
  return m ? { fed: m[1], rest: m[2] } : { fed: '', rest: s };
}

// "Ordre · Bestilt · Indhold" (Fable best.kol, design.kol, varer.kol) → kolonnenavne
export const kolonner = (sprog, noegle) => raa(sprog, noegle).split(' · ');

// Beløb. Dansk: kernens kr() — '16.012,50 kr.'. Engelsk (kun Min side): 'DKK 16,012.50' som i Fable d5 d.aabn.pris.
export function beloeb(oere, sprog = 'da') {
  if (sprogAf(sprog) === 'da') return kr(oere);
  const n = Number(oere);
  if (!Number.isSafeInteger(n)) throw new TypeError(`beløbet skal være hele øre: ${oere}`);
  const a = Math.abs(n);
  const hele = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}DKK ${hele}.${String(a % 100).padStart(2, '0')}`;
}

// Privatlivspolitikken i login.note/noteLead (Fable d1): ordet bliver et link. Politikken findes kun på dansk.
export function medPolitikLink(escaped, sprog) {
  const ord = sprogAf(sprog) === 'en' ? 'privacy policy' : 'privatlivspolitik';
  return escaped.replace(ord, `<a class="lnk" href="${SITE}/privatlivspolitik/">${ord}</a>`);
}

// Vores telefonnummer i en tekst fra kernen (H1, undersætning) → link. Teksten escapes her.
export const tekstMedLinks = (s, opts) => linkify(esc(s), opts);

// En tekst, der vises som hel side (Fable runde 4, "Fælles for 1–3": nede, lukket, 404): første sætning er overskriften
// (H1), resten er brødtekst under den. → [overskrift, resten] (resten '' når teksten er én sætning).
// Overskriften står uden det afsluttende punktum, som alle andre overskrifter på siderne (Fable port 3, nr. 9).
export function delOverskrift(s) {
  const t = String(s);
  const i = t.indexOf('. ');
  const [h, rest] = i > 0 ? [t.slice(0, i + 1), t.slice(i + 2)] : [t, ''];
  return [h.replace(/\.$/, ''), rest];
}

// En uge eller en dato i en allerede escapet tekst bindes med hårde mellemrum, så "uge" og tallet, og dag, måned og år,
// ikke skilles ad — men parentesen kan brydes efter stregen mellem mandag og fredag (Fable port 3, nr. 1: hele parentesen
// var nowrap og løb ud over kanten på en telefon). "uge 51 (14.–18. december 2026)" → "uge&nbsp;51 (14.–18.&nbsp;december&nbsp;2026)"
// og "(28. december 2026–1. januar 2027)" → "(28.&nbsp;december&nbsp;2026–1.&nbsp;januar&nbsp;2027)". Også engelsk "week 51 (14–18 December 2026)".
// Mål og datoer i en escapet tekst holdes samlet: "60 × 210 × 60 cm" og "2. november 2027" brydes ikke midt i (et løst
// "cm" eller "2." for enden af en linje i Gemte designs). Resten af teksten brydes som normalt.
export function bindMaal(escaped) {
  return String(escaped)
    .replace(/(\d) × (?=\d)/g, '$1&nbsp;×&nbsp;')
    .replace(/(\d) (cm|mm)\b/g, '$1&nbsp;$2')
    .replace(/(\d{1,2}\.?) ([a-zæøå]+) (\d{4})/gi, '$1&nbsp;$2&nbsp;$3');
}

export function bindUger(escaped) {
  return String(escaped)
    .replace(/\b(uge|week) (\d{1,2})\b/gi, '$1&nbsp;$2')
    .replace(/\(([^()]*\d{4})\)/g, (m, ind) => `(${ind.replace(/ /g, '&nbsp;')})`);
}
