// Kernen for Min side og ordrestatus: ordrens tilstand (Fable runde 3, afsnit e). Én funktion afgør, hvilken af de 16
// tilstande en ordre er i, og skriver overskrift (H1), undersætning og forløbets fire rækker — ordret efter
// docs/superpowers/specs/2026-11-12-min-side/fable-runde3.md (e + d4). Ordresiden er kun dansk.
// Rene funktioner uden I/O; kanonisk i ni-apps lib/webordre/ — se datoer.mjs.
//
// Reglerne (Fable e):
//  1. Et trin er sket (flueben + dato) eller ikke sket (ingen dato). Intet "i gang".
//  2. Et trin, der ikke er sket, siger kun, hvad der sker.
//  3. Siden regner kun det ud, der følger af kalenderen ("i dag", passerede frister og uger), i dansk tid.
//  5. Et løfte med en dato bliver ikke stående, når datoen er passeret (fristen, den bekræftede uge, den aftalte dag).
//  9. Fortrydelsesfristen er den, systemet regnede ved "leveret" (data.fortryd_til); passeret → kun reklamationsretten.
import { kbhDato, plusDage, ugeDatoer, ugeTekst, dagTekst, datoTekst, kortDatoTekst, ugeFrist, klTekst } from './datoer.mjs';
import { kr } from './beloeb.mjs';

export const TELEFON = '+45 42 42 26 84';
export const AFHENT_ADRESSE = 'Mågevej 73, st. tv., 2400 København NV';

// Faste tekster, ordret fra Fable d4 (nøglerne er Fables). Tekster med pladsholdere står som funktioner nedenfor.
export const TEKST = Object.freeze({
  'forloeb.betalt': 'Bestilt og betalt',
  'forloeb.uge': 'Leveringsuge bekræftet',
  'forloeb.dag': 'Leveringsdag aftalt',
  'forloeb.leveret': 'Leveret',
  'forloeb.afhentKlar': 'Klar til afhentning',
  'forloeb.hentet': 'Hentet',
  'forloeb.dagVenter': 'Vi aftaler leveringsdagen med dig.',
  'forloeb.afhentVenter': 'Du får en mail, når din bestilling står klar.',
  'forloeb.leveretVenter': 'Du får en mail, når vi har leveret.',
  // Fable port 3 (12-11-2026), nr. 4 og 6: tomme felter i forløbet ligner en fejl, og en annulleret bestilling slutter med
  // en række med flueben
  'forloeb.ugeIkke': 'Ikke bekræftet endnu.',
  'forloeb.hentetVenter': 'På Mågevej 73, st. tv., 2400 København NV, efter aftale.',
  'forloeb.hentetKlar': 'Ring på +45 42 42 26 84 og aftal et tidspunkt.',
  'forloeb.annulleret': 'Annulleret',
  'forloeb.fortrudt': 'Fortrudt',
  'vilkaar.fortrydNej': 'Lavet efter dine mål. Derfor er der ingen fortrydelsesret.',
  'vilkaar.fortrydJa': '14 dages fortrydelsesret fra den dag, du modtager varen.',
  'vilkaar.reklamation': 'To års reklamationsret efter købeloven.',
});
// Betalingsmidlet skrives kun, når det er gemt og kendt (Fable d4 bet.betalt, 19)
const BETALINGSMIDDEL = Object.freeze({ card: 'kort', mobilepay: 'MobilePay' });

// Tekster, Fable ikke har skrevet. Opfindes ikke (kontrakter §0): vises som TODO-TEKST:<nøgle> og er meldt.
// Tom siden Fable runde 4 (fable-runde4.md afsnit 6 og 7); konto/test/udgiv-tjek.mjs i neminventar-astro læser listen.
export const MANGLER = Object.freeze({});

const ringEllerSvar = `Ring på ${TELEFON}, eller svar på ordrebekræftelsen.`;
const punktum = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);
const saetninger = (...s) => s.filter(Boolean).join(' ');
const stort = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tidsrum = (dag) => (dag?.fra && dag?.til ? `Mellem kl. ${klTekst(dag.fra)} og ${klTekst(dag.til)}.` : '');
const ren = (s) => (typeof s === 'string' ? s.trim() : '');

// Forløbet læst i tidsorden → det, der gælder nu. En nyere uge (bekræftet eller flyttet) gør en tidligere aftalt dag ugyldig.
function laesForloeb(forloeb) {
  const r = (Array.isArray(forloeb) ? forloeb : [])
    .map((t, i) => ({ t, i, ms: Date.parse(t?.tid) }))
    .sort((a, b) => ((a.ms || 0) - (b.ms || 0)) || (a.i - b.i))
    .map((x) => x.t);
  const s = { uge: null, ugeFoerst: null, ugeFlyttet: null, dag: null, dagFoerst: null, dagFlyttet: null,
    klar: null, lev: null, fortrudt: null, aftalt: [] };
  for (const t of r) {
    const d = t?.data && typeof t.data === 'object' ? t.data : {};
    switch (t?.trin) {
      case 'uge_bekraeftet':
        s.uge = { aar: d.aar, uge: d.uge }; s.ugeFoerst ??= t.tid; s.ugeFlyttet = null;
        s.dag = null; s.dagFoerst = null; s.dagFlyttet = null;
        if (d.praecis === false && ren(d.aftalt?.tekst)) s.aftalt.push(ren(d.aftalt.tekst));
        break;
      case 'uge_flyttet':
        s.uge = { aar: d.aar, uge: d.uge }; s.ugeFoerst ??= t.tid;
        s.ugeFlyttet = { tid: t.tid, fra: d.fra ?? null, aarsag: ren(d.aarsag) };
        s.dag = null; s.dagFoerst = null; s.dagFlyttet = null;
        break;
      case 'dag_aftalt':
        s.dag = { dato: d.dato, fra: d.fra ?? null, til: d.til ?? null }; s.dagFoerst = t.tid; s.dagFlyttet = null;
        break;
      case 'dag_flyttet':
        s.dag = { dato: d.dato, fra: d.fra ?? null, til: d.til ?? null }; s.dagFoerst ??= t.tid;
        s.dagFlyttet = { tid: t.tid, tidligere: d.tidligere ?? null };
        break;
      case 'klar_afhentning': s.klar = { tid: t.tid }; break;
      case 'leveret': case 'hentet': s.lev = { dato: d.dato, fortryd_til: d.fortryd_til ?? null, tid: t.tid }; break;
      case 'fortrudt': s.fortrudt = { dato: d.dato, beloeb_oere: d.beloeb_oere }; break;
      case 'aftalt_med_dig': if (ren(d.tekst)) s.aftalt.push(ren(d.tekst)); break;
      default: break;   // email_rettet, noegle_fornyet, ikke_min, ordreside_aabnet vises ikke for kunden
    }
  }
  return s;
}

/**
 * Ordrens tilstand nu (Fable e). ordre = OrdreUdenLogin/OrdreMedLogin (kontrakter §5). nuIso = nu (ISO, Date eller ms).
 * sprog ignoreres: ordresiden er kun dansk (Fable d4).
 * → null, hvis ordren ikke er betalt/annulleret (siden viser da ordre.ikkeBetalt), ellers
 *   { nr: 1..15, h1, under, forloeb: [{trin, navn, sket, iso?, dato?, tekst}], delvisRefusion, betaling: {betalt, refunderet},
 *     vilkaar: [..], aftalt: [..], form, uge, dag, iDag }
 * Tilstand 16 (delvis refusion) ændrer ikke overskriften (Fable e: "Uændret"): nr er den underliggende tilstand,
 * delvisRefusion = true og betaling.refunderet = 'Tilbageført 10. november 2026: 1.750,00 kr.'
 */
export function tilstand(ordre, nuIso, sprog = 'da') {
  if (!ordre || (ordre.status !== 'betalt' && ordre.status !== 'annulleret')) return null;
  const iDag = kbhDato(nuIso ?? Date.now());
  const afhent = ordre.levering?.form === 'afhentning';
  const s = laesForloeb(ordre.forloeb);
  const bet = ordre.betaling ?? {};
  const refunderet = Number(bet.refunderet_oere ?? 0);
  const betaltAt = bet.betalt_at ?? null;
  const fristIso = ordre.uge_frist_at ?? (betaltAt ? ugeFrist(betaltAt) : null);   // ældre ordrer uden gemt frist: samme regel
  const fristDato = fristIso ? kbhDato(fristIso) : null;
  const uTekst = s.uge ? ugeTekst(s.uge.aar, s.uge.uge) : null;
  const ugeGaaet = s.uge ? iDag >= plusDage(ugeDatoer(s.uge.aar, s.uge.uge).mandag, 7) : false;   // mandag efter ugen (alarm 5)
  const levTekst = ren(ordre.levering?.tekst);

  const fortrydUnder = () => (ordre.fortrydelsesret && s.lev?.fortryd_til && iDag <= s.lev.fortryd_til
    ? `Du kan fortryde til og med ${datoTekst(s.lev.fortryd_til)}.` : TEKST['vilkaar.reklamation']);
  const flyttetUge = () => {
    const f = s.ugeFlyttet;
    const fra = f.fra?.uge != null ? ` fra uge ${f.fra.uge}` : '';
    return f.aarsag ? `Ændret ${kortDatoTekst(f.tid, iDag)}${fra}: ${punktum(f.aarsag)}` : `Ændret ${kortDatoTekst(f.tid, iDag)}${fra}.`;
  };

  let nr, h1, under;
  if (s.fortrudt) {
    nr = 15; h1 = 'Du har fortrudt købet';
    under = `Vi har tilbageført ${kr(s.fortrudt.beloeb_oere)} den ${kortDatoTekst(s.fortrudt.dato, iDag)}. Hvornår beløbet står på din konto, afhænger af din bank.`;
  } else if (ordre.status === 'annulleret') {
    nr = 14; h1 = 'Bestillingen er annulleret';
    under = refunderet > 0 && bet.refunderet_at
      ? `Vi har tilbageført ${kr(refunderet)} den ${kortDatoTekst(bet.refunderet_at, iDag)}. Hvornår beløbet står på din konto, afhænger af din bank.`
      : `Beløbet og datoen står her, når vi har tilbageført pengene. Er der noget, så ring på ${TELEFON}.`;   // runde 4, 7
  } else if (s.lev) {
    nr = afhent ? 13 : 10;
    h1 = `${afhent ? 'Hentet' : 'Leveret'} ${dagTekst(s.lev.dato, iDag)}`;
    under = fortrydUnder();
  } else if (afhent && s.klar) {
    nr = 12; h1 = 'Klar til afhentning';
    under = `${AFHENT_ADRESSE}. Ring på ${TELEFON} og aftal et tidspunkt.`;
  } else if (afhent && s.uge && ugeGaaet) {
    // Fable runde 4, afsnit 6: ugen er den senest bekræftede eller flyttede
    nr = 5; h1 = 'Din bestilling er ikke klar til afhentning endnu';
    under = `Den skulle have stået klar i uge ${s.uge.uge}. ${ringEllerSvar}`;
  } else if (afhent && s.uge) {
    nr = 11; h1 = `Klar til afhentning i ${uTekst}`;
    // Flyttet afhentningsuge: Fable har kun tilstand 4 (levering). Sammensat af 4's første sætning og 11's undersætning.
    under = saetninger(s.ugeFlyttet ? flyttetUge() : '', TEKST['forloeb.afhentVenter']);
  } else if (!afhent && s.dag) {
    const dagSom6 = saetninger(tidsrum(s.dag), levTekst ? punktum(levTekst) : '');
    if (iDag === s.dag.dato) { nr = 8; h1 = 'Vi leverer i dag'; under = dagSom6; }
    else if (iDag > s.dag.dato) { nr = 9; h1 = `Aftalt levering ${dagTekst(s.dag.dato, iDag)}`; under = `Er der noget, så ring på ${TELEFON}.`; }
    else if (s.dagFlyttet) {
      nr = 7; h1 = `Vi leverer ${dagTekst(s.dag.dato, iDag)}`;
      under = saetninger(`Ændret ${kortDatoTekst(s.dagFlyttet.tid, iDag)} fra ${dagTekst(s.dagFlyttet.tidligere, iDag)}.`, tidsrum(s.dag));
    } else { nr = 6; h1 = `Vi leverer ${dagTekst(s.dag.dato, iDag)}`; under = dagSom6; }
  } else if (!afhent && s.uge && ugeGaaet) {
    nr = 5; h1 = `Leveringen i uge ${s.uge.uge} er ikke aftalt endnu`;
    under = `Vi fik ikke aftalt en dag med dig i den uge. ${ringEllerSvar}`;
  } else if (!afhent && s.uge) {
    if (s.ugeFlyttet) { nr = 4; h1 = `Vi leverer i ${uTekst}`; under = saetninger(flyttetUge(), TEKST['forloeb.dagVenter']); }
    else { nr = 3; h1 = `Vi leverer i ${uTekst}`; under = TEKST['forloeb.dagVenter']; }
  } else if (fristDato && iDag <= fristDato) {
    nr = 1; h1 = `Vi bekræfter leveringsugen senest ${dagTekst(fristDato, iDag)}`; under = 'Du får en mail, og ugen står her på siden.';
  } else {
    nr = 2; h1 = 'Leveringsugen er ikke bekræftet endnu'; under = `Det skulle den have været. ${ringEllerSvar}`;
  }

  // ---------- forløbets fire rækker ----------
  // Annulleret og fortrudt (Fable port 3, nr. 4): kun de trin, der er sket, og til sidst en række med flueben.
  const raekke = (trin, navnNoegle, sket, iso, tekst, venter) => (sket
    ? { trin, navn: TEKST[navnNoegle], sket: true, iso, dato: datoTekst(iso), tekst: tekst ?? null }
    : { trin, navn: TEKST[navnNoegle], sket: false, tekst: venter ?? null });
  const middel = BETALINGSMIDDEL[bet.betalingsmiddel] ?? null;
  const inkl = ordre.total?.inkl_oere;
  // En flyttet uge eller dag (Fable port 3, nr. 2): rækken viser datoen for den seneste ændring og siger, at den er ændret
  const ugeIso = s.ugeFlyttet ? kbhDato(s.ugeFlyttet.tid) : s.ugeFoerst ? kbhDato(s.ugeFoerst) : null;
  const ugeRaekkeTekst = uTekst
    ? `${stort(uTekst)}${s.ugeFlyttet?.fra?.uge != null ? `, ændret fra uge ${s.ugeFlyttet.fra.uge}` : ''}` : null;
  const dagIso = s.dagFlyttet ? kbhDato(s.dagFlyttet.tid) : s.dagFoerst ? kbhDato(s.dagFoerst) : null;
  const dagRaekkeTekst = s.dag
    ? `${stort(dagTekst(s.dag.dato, iDag))}${s.dagFlyttet?.tidligere ? `, ændret fra ${dagTekst(s.dagFlyttet.tidligere, iDag)}` : ''}` : null;
  const ugeVenter = s.lev ? null
    : nr === 1 ? `Vi bekræfter ugen senest ${dagTekst(fristDato, iDag)}. Du får en mail.`
      : nr === 2 ? TEKST['forloeb.ugeIkke'] : null;
  let forloeb = [
    raekke('betalt', 'forloeb.betalt', !!betaltAt, betaltAt ? kbhDato(betaltAt) : null,
      Number.isSafeInteger(Number(inkl)) && inkl != null ? `${kr(inkl)}${middel ? ` med ${middel}` : ''}` : null),
    raekke('uge', 'forloeb.uge', !!s.uge, ugeIso, ugeRaekkeTekst, ugeVenter),
  ];
  if (afhent) {
    forloeb.push(raekke('afhentKlar', 'forloeb.afhentKlar', !!s.klar, s.klar ? kbhDato(s.klar.tid) : null, null,
      s.lev ? null : TEKST['forloeb.afhentVenter']));
    forloeb.push(raekke('hentet', 'forloeb.hentet', !!s.lev, s.lev ? s.lev.dato : null, null,
      s.lev ? null : s.klar ? TEKST['forloeb.hentetKlar'] : TEKST['forloeb.hentetVenter']));
  } else {
    forloeb.push(raekke('dag', 'forloeb.dag', !!s.dag, dagIso, dagRaekkeTekst, s.lev ? null : TEKST['forloeb.dagVenter']));
    forloeb.push(raekke('leveret', 'forloeb.leveret', !!s.lev, s.lev ? s.lev.dato : null, null, TEKST['forloeb.leveretVenter']));
  }
  if (nr === 14) {
    // "Annulleret" · datoen · "{beløb} tilbageført" — uden registreret tilbageførsel uden dato og beløb
    const medBeloeb = refunderet > 0 && bet.refunderet_at;
    forloeb = forloeb.filter((r) => r.sket);
    forloeb.push(medBeloeb
      ? { trin: 'annulleret', navn: TEKST['forloeb.annulleret'], sket: true, iso: kbhDato(bet.refunderet_at), dato: datoTekst(kbhDato(bet.refunderet_at)), tekst: `${kr(refunderet)} tilbageført` }
      : { trin: 'annulleret', navn: TEKST['forloeb.annulleret'], sket: true, tekst: null });
  } else if (nr === 15) {
    forloeb = forloeb.filter((r) => r.sket);
    const b = Number(s.fortrudt.beloeb_oere);
    forloeb.push({ trin: 'fortrudt', navn: TEKST['forloeb.fortrudt'], sket: true, iso: s.fortrudt.dato, dato: datoTekst(s.fortrudt.dato),
      tekst: Number.isSafeInteger(b) ? `${kr(b)} tilbageført` : null });
  }

  // ---------- betaling og vilkår (samme kalenderregler som overskriften) ----------
  const betaling = {
    // med punktum som linjerne omkring den (Fable port 3, nr. 22)
    betalt: betaltAt ? `Betalt ${datoTekst(betaltAt)}${middel ? ` med ${middel}` : ''}.` : null,
    refunderet: refunderet > 0 && bet.refunderet_at ? `Tilbageført ${datoTekst(bet.refunderet_at)}: ${kr(refunderet)}` : null,
  };
  let vilkaar;
  // Annulleret eller fortrudt (Fable port 3, nr. 3): kun linket til handelsbetingelserne (siden sætter det selv)
  if (nr === 14 || nr === 15) vilkaar = [];
  else if (!ordre.fortrydelsesret) vilkaar = [TEKST['vilkaar.fortrydNej'], TEKST['vilkaar.reklamation']];
  else if (!s.lev) vilkaar = [TEKST['vilkaar.fortrydJa'], TEKST['vilkaar.reklamation']];
  else if (s.lev.fortryd_til && iDag <= s.lev.fortryd_til) {
    vilkaar = [TEKST['vilkaar.fortrydJa'], `Du kan fortryde til og med ${datoTekst(s.lev.fortryd_til)}.`, TEKST['vilkaar.reklamation']];
  } else vilkaar = [TEKST['vilkaar.reklamation']];

  return {
    nr, h1, under, forloeb,
    delvisRefusion: ordre.status === 'betalt' && nr !== 15 && refunderet > 0,
    betaling, vilkaar, aftalt: s.aftalt,
    form: afhent ? 'afhentning' : 'levering', uge: s.uge, dag: afhent ? null : s.dag, iDag,
  };
}
