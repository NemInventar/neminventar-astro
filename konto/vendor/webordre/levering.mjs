// Kernen for Min side og ordrestatus: leveringsformen på en webordre (kontrakter.md §5 "levering"). Ét sted for broen
// (supabase/functions/_ordrestatus/felter.js → OrdreUdenLogin/OrdreMedLogin) og /webordrer (public/webordrer/logik.mjs
// ordreAf), så kundens side, mailene og medarbejdersiden siger det samme om samme ordre. Ren funktion uden importer.
// Kanonisk i ni-apps lib/webordre/ — se datoer.mjs.
//
//   leveringAf(ordre) -> { form: 'kantsten' | 'baaret_ind' | 'afhentning', tekst: 'Flatpack, til kantsten' }
//
// ordre = rækken i designer_ordrer_2026_10_24: leveringstrinnet i konfiguration.tilvalg.lev (broen henter hele
// konfiguration) eller tilvalg.lev (/webordrer henter kun konfiguration->tilvalg), og prislinjerne i linjer.pris.
//
// form: et lukket sæt, udledt af designerens leveringstrin (core/levering.js TRIN): afhent → afhentning, kantsten →
// kantsten, baaret → baaret_ind. 'monteret' kan ikke bestilles online (designer-ordre MONTAGE_TRIN), og et ukendt eller
// manglende trin er kantsten — designerens egen standard (levering.valg). Afhentning følger fn_webordre_trin (lev = 'afhent').
//
// tekst: designerens ord, som linkPris sætter dem sammen ("Flatpack, til kantsten", "Samlet, båret ind", "Flatpack,
// afhentning på Mågevej"). Flatpack eller samlet er det, prisen blev regnet med: designeren skriver "fladpakket" i
// leveringslinjen (core/levering.js linjer; engelsk "flat-packed"), og afhentning er altid fladpakket. Kun uden prislinjer
// (aldrig på en rigtig ordre: designer-ordre gemmer altid linjer.pris) læses det ønskede tilvalg.form.
export const LEVERING_FORMER = Object.freeze(['kantsten', 'baaret_ind', 'afhentning']);

const FORM_AF_TRIN = Object.freeze({ afhent: 'afhentning', kantsten: 'kantsten', baaret: 'baaret_ind' });
const PAKNING = Object.freeze({ flatpack: 'Flatpack', samlet: 'Samlet' });
const TRIN_ORD = Object.freeze({ afhentning: 'afhentning på Mågevej', kantsten: 'til kantsten', baaret_ind: 'båret ind' });
const FLADPAKKET = /fladpakket|flat-packed/i;

/** Rækken → { form, tekst } (kontrakter §5). Kaster aldrig: en tom eller ukendt række giver 'Samlet, til kantsten'. */
export function leveringAf(ordre) {
  const tv = ordre?.konfiguration?.tilvalg ?? ordre?.tilvalg ?? {};
  const lev = String(tv?.lev ?? '');
  const form = Object.hasOwn(FORM_AF_TRIN, lev) ? FORM_AF_TRIN[lev] : 'kantsten';
  const pris = Array.isArray(ordre?.linjer?.pris) ? ordre.linjer.pris : [];
  const fladpakket = form === 'afhentning'
    || (pris.length ? pris.some((l) => FLADPAKKET.test(String(l?.t ?? ''))) : tv?.form === 'flatpack');
  return { form, tekst: `${PAKNING[fladpakket ? 'flatpack' : 'samlet']}, ${TRIN_ORD[form]}` };
}

// Ordrens linjer (OrdreUdenLogin.linjer, kontrakter §5) delt i varerne og leveringen (Fable port 3, nr. 5). Leveringslinjen
// i ordren er designerens prislinje ("Levering til kantsten · 1 element", "Levering, båret ind · 3 skabe, fladpakket",
// "Levering med to mand, ca. 2 timer · …", og uden STEP også "Båret ind" — core/levering.js linjer). Den er vores ord, ikke
// kundens: siden skriver selv rækken "Levering: samlet, til kantsten" ud fra levering.tekst, uden antal, med linjernes beløb.
// Afhentning (0 kr.) står ikke på betalingen (designer-ordre stripeLinjer) og har derfor ingen linje: beløbet er 0.
//   varerOgLevering(ordre) -> { varer: [linje …], levering: { ord: 'samlet, til kantsten', beloeb_oere } | null }
//   (varerne med antallet ud af teksten, se vareLinje herunder)
// ord = levering.tekst med lille begyndelsesbogstav (efter kolon i Fables varer.levering "Levering: {…}").
const LEVERINGSLINJE = /^(levering\b|båret ind\b)/i;
export const erLeveringslinje = (tekst) => LEVERINGSLINJE.test(String(tekst ?? '').trim());

// Antallet i en varelinje (Fable port 3 runde 2, R1). Designeren skriver antallet i linjens tekst ("2 × Lockers 4 × 2, 8 rum",
// produkternes pris.js: `${a} × …` med beløbet for dem alle), og broen og /webordrer sender hver linje med antal 1. Begynder
// teksten med "N × " (N ≥ 2), og er antal 1 eller ukendt, er antallet N og teksten resten: { tekst: 'Lockers 4 × 2, 8 rum',
// antal: 2, beloeb_oere } — beløbet er stadig linjens (alle N). Mål inde i teksten ("4 × 2") røres ikke. Bruges af ordresiden
// (varerOgLevering) og ordrebekræftelsen (mails.mjs), så "2 × …" aldrig står ud for Antal 1, og antallet aldrig står to gange.
const ANTAL_FORAN = /^(\d{1,3})\s*×\s*(\S[\s\S]*)$/;
export function vareLinje(l) {
  if (!l || typeof l !== 'object') return l;
  const m = ANTAL_FORAN.exec(String(l.tekst ?? '').trim());
  const n = m ? Number(m[1]) : 0;
  if (!m || n < 2 || (l.antal != null && Number(l.antal) !== 1)) return l;
  return { ...l, tekst: m[2].trim(), antal: n };
}

export function varerOgLevering(ordre) {
  const linjer = (Array.isArray(ordre?.linjer) ? ordre.linjer : []).map(vareLinje);
  const varer = linjer.filter((l) => !erLeveringslinje(l?.tekst));
  const lev = linjer.filter((l) => erLeveringslinje(l?.tekst));
  const tekst = String(ordre?.levering?.tekst ?? '').trim();
  if (!tekst) return { varer: linjer, levering: null };
  const sum = lev.reduce((a, l) => (a === null || !Number.isSafeInteger(l?.beloeb_oere) ? null : a + l.beloeb_oere), 0);
  const beloeb = lev.length ? sum : ordre?.levering?.form === 'afhentning' ? 0 : null;
  return { varer, levering: { ord: `${tekst[0].toLowerCase()}${tekst.slice(1)}`, beloeb_oere: beloeb } };
}
