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
