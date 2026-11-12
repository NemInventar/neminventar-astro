// Kernen for Min side og ordrestatus: ordvagten (Fable g, "Regler for fri tekst"; R15). Tjekker de fire fritekstfelter,
// kunden læser — "Aftalt med dig", årsagen ved flyttet uge, årsagen ved flyttet dag og "Egen linje" — før mailen kan
// sendes, og giver det ord, der stopper den: "Teksten indeholder "{ord}". Det må kunden ikke se. Ret teksten."
// Listen genbruger FEJL og mærke-/mm-reglerne fra neminventar-astro/scripts/lint-web-copy.py og lægger de hårde grænser
// for kundetekst ovenpå (kontrakter §0): produktionsstedet (land, by, firma), mærkenavne, mål i mm, interne ord, og
// ord om transport, told og grænser (Fable g regel 2, h #8).
// Rene funktioner uden I/O; kanonisk i ni-apps lib/webordre/ — se datoer.mjs. Ingen lookbehind (Safari < 16.4).

const BOGSTAV = '[\\p{L}\\p{N}_]';
const v = `${BOGSTAV}*`;   // valgfri endelse: "tolden", "Kosovos", "fragten"

// [grund, mønstre]. Et mønster matcher kun som helt ord (eller ordets begyndelse med v) — æ, ø og å tæller som bogstaver.
export const REGLER = Object.freeze([
  ['produktionssted', [
    `kosov${v}`, 'kosova', `ferizaj${v}`, 'uro[sš]evac', `pri[sš]h?tin${v}`, `korpus${v}`, 'sh\\.?\\s?p\\.?\\s?k\\.?',
    `albani${v}`, `albansk${v}`, `balkan${v}`,
  ]],
  ['transport, told eller grænser', [
    `told${v}`, `grænse${v}`, `fragt${v}`, `afsendt${v}`, 'undervejs', 'på\\s+vej', `transport${v}`, `lastbil${v}`,
    `fabrik${v}`, `udland${v}`, `import${v}`, `eksport${v}`,
  ]],
  ['mærkenavn', [
    'fundermax', 'forbo', 'ecophon', `rubio${v}`, 'monocoat', 'oil\\s*plus', 'precolou?r', 'egger', 'kvadrat', 'blum',
    'blumotion', 'hettich', 'h[äa]fele', 'salice', 'kronospan', 'valchromat', 'fenix', 'formica', 'troldtekt', 'osmo',
    'junckers', 'tarkett', 'gerflor', 'pfleiderer', 'kaindl', 'polyrey', 'unilin', 'ikea', 'legrabox', 'tandembox',
    'movento', 'tip[\\s-]?on', 'soft[\\s-]?close', 'push[\\s-]?to[\\s-]?open', 'cam-l[åa]s', 'safe-greb',
  ]],
  ['mål i mm', [
    '\\d+(?:[.,]\\d+)?\\s*(?:mm|millimeter)', 'ø\\s*\\d+',
    '\\d{3,4}\\s*[x×]\\s*\\d{3,4}(?!\\s*c?m(?![\\p{L}]))',   // "600 x 400" uden enhed er mm; "240 × 236 cm" er tilladt
  ]],
  ['internt ord', [
    'erp', 'crm', `leads?`, 'refinement', `konfiguration${v}`, `tilbudslinje${v}`, 'quote', 'bom', `rumkode${v}`,
    `projektnummer${v}`, 'projektnr', `sagsnummer${v}`, 'sagsnr', 't\\d{2}', '2[56]\\d{3}(?!\\s*kr)', 'p20\\d{2}-\\d{3}',
    'stripe', 'supabase', `huskeliste${v}`, 'backlog', `pakkeliste${v}`, `webordre${v}`,
  ]],
  ['navn, der aldrig må stå udadtil', ['jsp\\s*byg', 'halbyg', `locker-?bank${v}`]],
  ['translittereret dansk', [`(?:paa|foer|moede|faerdig|stoerre|aabn)${v}`]],
]);

const SKJULT = new RegExp(`[${[0xad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff].map((c) => String.fromCharCode(c)).join('')}]`, 'g');   // blød bindestreg og usynlige tegn kan ikke snyde vagten
let _regex = null;
const regex = () => (_regex ??= REGLER.map(([grund, liste]) => [grund,
  new RegExp(`(^|[^\\p{L}\\p{N}_])(${liste.join('|')})(?!${BOGSTAV})`, 'giu')]));

/**
 * Fri tekst → null (ok) eller {ord, grund}: det første forbudte ord i teksten, som det står der.
 * Bruges på de fire fritekstfelter i /webordrer, før "Send mail og gem" kan trykkes.
 */
export function ordvagt(tekst) {
  if (tekst == null) return null;
  const t = String(tekst).normalize('NFKC').replace(SKJULT, '');
  let bedst = null;
  for (const [grund, re] of regex()) {
    re.lastIndex = 0;
    const m = re.exec(t);
    if (!m) continue;
    const pos = m.index + m[1].length;
    if (!bedst || pos < bedst.pos) bedst = { pos, ord: m[2], grund };
  }
  return bedst ? { ord: bedst.ord, grund: bedst.grund } : null;
}
