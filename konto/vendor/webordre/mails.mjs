// Mails om en webordre (Min side og ordrestatus): fable-runde3.md d6 nr. 3-12 og 14. Kontrakt: kontrakter.md §3 og §7.
// Rene funktioner uden I/O: kører i Node, Deno, browser og Workers. Afsender (tilbud@) og modtager stilles af mailkøen.
//
//   mail(type, ordre, data, sprog = 'da') -> { emne, html, tekst } | null
//
// type    = forløbets trin (§3) eller 'ordrebekraeftelse' / 'nu_kan_du_foelge'. Se MAILS. Trin uden mail (refusion = d6 nr. 14,
//           fortrudt, ikke_min, ordreside_aabnet) giver null. Ukendt type kaster.
// ordre   = OrdreMedLogin (kontrakter §5) + email, noegleLink (fuldt link til ordresiden). email bruges ikke i teksten.
// data    = trinnets data (§3). data.iDag ('YYYY-MM-DD', dansk dato) styrer, om en dag skrives med årstal; mangler den,
//           bruges dagens danske dato.
// sprog   = mails om en bestilling findes kun på dansk (d6, tabellen øverst). Andre værdier giver den danske tekst.
//
// Teksten er ordret fra d6. Ugen skrives altid med ugeTekst, beløb med kr, dage med dagTekst og datoer med datoTekst.
// Fri tekst fra medarbejdere (Aftalt med dig, årsager, egen linje) HTML-escapes; ordvagten køres før, i /webordrer (R15).
// Mangler en tekst eller et påkrævet felt, kaster funktionen, så mailen aldrig går ud halv.
import { kbhDato, ugeTekst, dagTekst, datoTekst, klTekst } from './datoer.mjs';
import { kr } from './beloeb.mjs';

export const TELEFON = '+45 42 42 26 84';
export const SVAR_ADRESSE = 'tilbud@neminventar.dk';
export const AFHENTNINGSSTED = 'Mågevej 73, st. tv., 2400 København NV';
const FORTRYDELSE_DAGE = 14; // = core/bestil.js FORTRYDELSE_DAGE (testen sammenligner teksten)

// type → nummer i d6. email_rettet sender ordrebekræftelsen igen til den nye adresse; noegle_fornyet sender den med "Nyt link"
export const MAILS = Object.freeze({
  ordrebekraeftelse: 3, email_rettet: 3, noegle_fornyet: 3, uge_bekraeftet: 4, dag_aftalt: 5, dag_flyttet: 6,
  klar_afhentning: 7, leveret: 8, hentet: 8, uge_flyttet: 9, aftalt_med_dig: 10, nu_kan_du_foelge: 11,
});
// Ingen mail: refusion (d6 nr. 14: kunden hører det i samtalen, der gik forud) og trinnene uden mail i §3
export const UDEN_MAIL = Object.freeze(['refusion', 'fortrudt', 'ikke_min', 'ordreside_aabnet']);

// ---------------------------------------------------------------- form (som ordrebekræftelsen i designer-ordre/regler.js)

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const LINK_STIL = 'color:#17140E;text-decoration:underline';

// afsnit: tekstblokke (linjeskift = <br>). links: [[synlig tekst, href]] gøres klikbare i HTML-udgaven.
export function mailUd(emne, afsnit, links = []) {
  const blokke = afsnit.filter((a) => a != null && a !== '');
  const tekst = blokke.join('\n\n');
  const p = (blok) => {
    let h = esc(blok);
    for (const [synlig, href] of links) h = h.split(esc(synlig)).join(`<a href="${esc(href)}" style="${LINK_STIL}">${esc(synlig)}</a>`);
    return `<p style="margin:0 0 14px">${h.replace(/\n/g, '<br>')}</p>`;
  };
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#17140E;line-height:1.5;max-width:720px">${
    tekst.split(/\n{2,}/).map(p).join('')}</div>`;
  return { emne, html, tekst };
}
export const HILSEN = Object.freeze({
  da: `Venlig hilsen\nNem Inventar\n${SVAR_ADRESSE} · ${TELEFON}`,
  en: `Kind regards\nNem Inventar\n${SVAR_ADRESSE} · ${TELEFON}`,
});

// Fri tekst: kontroltegn væk, højst ét tomt linjeskift i træk, trimmet. Escapes først i mailUd.
export const fri = (s) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, ' ')
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const fejl = (besked) => { throw new Error(`mails: ${besked}`); };
const kraevet = (s, hvad) => fri(s) || fejl(`${hvad} mangler (mailen kan ikke sendes uden)`);
const datoOk = (d, hvad) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d ?? '')) ? d : fejl(`${hvad}: dato ${d}`));
const ugeOk = (d, hvad) => (Number.isInteger(d?.aar) && Number.isInteger(d?.uge) && d.uge >= 1 && d.uge <= 53 ? d : fejl(`${hvad}: uge ${JSON.stringify(d)}`));

export { klTekst }; // bor i datoer.mjs, så siden og mailen skriver klokkeslæt ens
const tidsrum = (d) => {
  if (!d.fra && !d.til) return '';
  // Fable runde 4, A: kun "fra" eller kun "til" får ingen tekst — formularen (/webordrer tidsrumFejl) kræver begge eller ingen
  if (!d.fra || !d.til) fejl('tidsrummet skal have både fra og til, eller ingen af dem');
  return ` mellem kl. ${klTekst(d.fra)} og ${klTekst(d.til)}`;
};

// ---------------------------------------------------------------- ordrens felter

const refAf = (o) => (/^NI-[0-9A-F]{8}$/.test(String(o?.ref ?? '')) ? o.ref : fejl(`ordrenummer ${o?.ref}`));
const navnAf = (o) => fri(o?.adresse?.navn ?? o?.navn) || fejl('ordren mangler kundens navn');
const adresseAf = (o) => {
  const a = o?.adresse ?? {};
  if (!fri(a.gade) || !fri(a.postnr) || !fri(a.by)) fejl('ordren mangler adressen');
  return `${fri(a.gade)}, ${fri(a.postnr)} ${fri(a.by)}`;
};
const LINK_OK = /^https:\/\/[a-z0-9.-]+(:\d{2,5})?\/[^\s"'<>\\]*$/i;
const linkAf = (o) => (LINK_OK.test(String(o?.noegleLink ?? '')) ? o.noegleLink : fejl('ordren mangler et gyldigt link til ordresiden (noegleLink)'));
const afhentning = (o) => o?.levering?.form === 'afhentning';
const leveringTekst = (o) => fri(o?.levering?.tekst);
const iDagAf = (o, d) => d?.iDag ?? o?.iDag ?? kbhDato(new Date().toISOString());

// ---------------------------------------------------------------- nr. 3 · ordrebekræftelsen (designer-ordre kundeMail + d6-ændringen)

// = core/bestil.js fortrydelseMail (samme tekst som ved knappen); testen holder dem ens
export const fortrydelseTekst = (fortrydelse) => (fortrydelse
  ? `Du har ${FORTRYDELSE_DAGE} dages fortrydelsesret fra den dag, du modtager varen.`
  : 'Varen laves efter de mål, du har valgt. Derfor er der ingen fortrydelsesret.');

// Fable e regel 5: et løfte med en dato bliver ikke stående, når datoen er passeret, eller når ugen allerede er bekræftet
function fristLoefte(o, iDag) {
  if (!o?.uge_frist_at) return '';
  const frist = kbhDato(o.uge_frist_at);
  return ugeSat(o) || frist < iDag ? '' : `Vi bekræfter leveringsugen senest ${dagTekst(frist, iDag)}. `;
}

// Fable port 3, nr. 23: når ugen allerede er sat (fx "Nyt link" efter bekræftelsen), lover siden ikke længere ugen
const ugeSat = (o) => (o?.forloeb ?? []).some((f) => f?.trin === 'uge_bekraeftet' || f?.trin === 'uge_flyttet');

function ordrebekraeftelse(o, d, { nytLink = false } = {}) {
  const ref = refAf(o), link = linkAf(o), iDag = iDagAf(o, d), t = o?.total ?? {};
  if (!Number.isFinite(t.inkl_oere) || !Number.isFinite(t.moms_oere)) fejl('ordren mangler totalen');
  const linjer = (o.linjer ?? []).map((l) => `${Number(l.antal) > 1 ? `${l.antal} × ` : ''}${fri(l.tekst)}: ${kr(l.beloeb_oere)}`);
  return mailUd(nytLink ? `Nyt link til din bestilling ${ref}` : `Ordrebekræftelse ${ref} fra Nem Inventar`, [
    `Hej ${navnAf(o)}`,
    nytLink ? 'Her er et nyt link til din bestilling. Det gamle virker ikke længere.' : null,
    `Tak for din bestilling. Vi har modtaget din betaling på ${kr(t.inkl_oere)} inkl. moms.`,
    [`Ordre: ${ref}`, ...linjer, `I alt: ${kr(t.inkl_oere)} inkl. moms (heraf moms ${kr(t.moms_oere)})`].join('\n'),
    // Fable port 3, nr. 7: ved afhentning står afhentningsstedet, og kundens adresse kræves kun ved levering
    afhentning(o) ? `Afhentning: ${AFHENTNINGSSTED}, efter aftale.` : `Levering til: ${adresseAf(o)}`,
    `${fristLoefte(o, iDag)}Vi laver det, du har bestilt, på vores eget værksted efter det, du har tegnet.`,
    `Følg din bestilling her: ${link}\n${ugeSat(o) ? 'Siden viser leveringen og det, du har bestilt.' : 'Siden viser leveringsugen, så snart den er bekræftet, og det, du har bestilt.'}`,
    fortrydelseTekst(!!o.fortrydelsesret),
    'Har du spørgsmål, så svar på denne mail eller ring til os.',
    HILSEN.da,
  ], [[link, link]]);
}

// ---------------------------------------------------------------- nr. 4-11

const statusmail = (o, emne, krop) => {
  const link = linkAf(o);
  return mailUd(emne, [`Hej ${navnAf(o)}`, ...krop(link), HILSEN.da], [[link, link]]);
};
const foelg = (link) => `Følg din bestilling: ${link}`;

const BYG = {
  // 4 · Leveringsugen er bekræftet (ved afhentning: klar til afhentning i ugen)
  uge_bekraeftet(o, d) {
    ugeOk(d, 'uge_bekraeftet');
    if (d.praecis !== true && d.praecis !== false) fejl('uge_bekraeftet kræver data.praecis');
    const uge = ugeTekst(d.aar, d.uge), afh = afhentning(o), lev = leveringTekst(o);
    const aftalt = d.praecis === false ? `Aftalt med dig: ${kraevet(d.aftalt?.tekst, 'Aftalt med dig')}` : null;
    // Fable port 3, nr. 8: "bliver klar" — på en telefon skæres emnet af efter "klar til afhentning", som mail nr. 7
    return statusmail(o, afh ? `Din bestilling ${refAf(o)} bliver klar til afhentning i ${uge}` : `Din bestilling ${refAf(o)} leveres i ${uge}`, (link) => [
      afh ? `Din bestilling bliver klar til afhentning i ${uge}. Du får en mail, når den står klar.`
        : `Vi leverer din bestilling i ${uge}. Vi aftaler leveringsdagen med dig.`,
      [afh ? null : `Leveres til: ${adresseAf(o)}`, lev ? `Sådan kommer det: ${lev}` : null].filter(Boolean).join('\n'),
      aftalt,
      fri(d.egen_linje),
      'Vil du ændre noget, så svar på denne mail hurtigst muligt. Når pladerne er skåret, kan målene ikke ændres.',
      foelg(link),
    ]);
  },

  // 5 · Leveringsdagen er aftalt. Båret ind / Til kantsten læses af leveringsformens ord (designerens valg)
  dag_aftalt(o, d) {
    if (afhentning(o)) fejl('dag_aftalt findes kun ved levering (afhentning: klar_afhentning, d6 nr. 7)');
    const iDag = iDagAf(o, d), dag = dagTekst(datoOk(d.dato, 'dag_aftalt'), iDag), lev = leveringTekst(o).toLowerCase();
    const form = lev.includes('båret ind') ? 'Vi bærer det ind i det rum, det skal stå i.'
      : lev.includes('kantsten') ? 'Vi stiller det ved kantstenen eller i indkørslen, og du bærer selv ind. Når det er stillet af, er det dit ansvar, fx for regn og tyveri. Er du ikke hjemme, stiller vi det kun, hvis vi har aftalt det skriftligt.'
        : null;
    return statusmail(o, `Vi leverer din bestilling ${dag}`, (link) => [
      `Som aftalt leverer vi din bestilling ${dag}${tidsrum(d)}.`,
      [form, 'Bilen skal kunne holde tæt på din adresse, det vil sige inden for ca. 25 meter fra indgangen. Kan den ikke det, aftaler vi en løsning med dig før leveringen. Ring til os, hvis du ved, at det bliver svært.'].filter(Boolean).join('\n'),
      `Leveres til: ${adresseAf(o)}`,
      fri(d.egen_linje),
      `Passer dagen alligevel ikke, så ring til os på ${TELEFON}.`,
      foelg(link),
    ]);
  },

  // 6 · Ny leveringsdag ("Flyt dag"). Årsagen er påkrævet, når det er os, der flytter
  dag_flyttet(o, d) {
    if (afhentning(o)) fejl('dag_flyttet findes kun ved levering');
    const iDag = iDagAf(o, d), dag = dagTekst(datoOk(d.dato, 'dag_flyttet'), iDag), foer = dagTekst(datoOk(d.tidligere, 'dag_flyttet.tidligere'), iDag);
    const aarsag = d.efter_kundens_oenske === true ? 'Som du har bedt om.' : kraevet(d.aarsag, 'Årsagen til den nye dag');
    return statusmail(o, `Ny leveringsdag for din bestilling ${refAf(o)}: ${dag}`, (link) => [
      `Vi leverer din bestilling ${dag}${tidsrum(d)} i stedet for ${foer}.`,
      aarsag,
      `Passer den nye dag ikke, så ring til os på ${TELEFON}.`,
      foelg(link),
    ]);
  },

  // 7 · Klar til afhentning
  klar_afhentning(o, d) {
    if (!afhentning(o)) fejl('klar_afhentning findes kun ved afhentning');
    return statusmail(o, `Din bestilling ${refAf(o)} er klar til afhentning`, (link) => [
      `Din bestilling står klar på ${AFHENTNINGSSTED}.`,
      `Ring på ${TELEFON} og aftal et tidspunkt, før du kører.`,
      fri(d.egen_linje),
      foelg(link),
    ]);
  },

  // 8 · Leveret / Hentet. fortryd_til er regnet én gang ved trinnet (kun ved fortrydelsesret)
  leveret: (o, d) => leveretEllerHentet(o, d, false),
  hentet: (o, d) => leveretEllerHentet(o, d, true),

  // 9 · Ny leveringsuge ("Flyt uge"). Årsagen er påkrævet. Ved afhentning: Fable runde 4, afsnit 8
  uge_flyttet(o, d) {
    ugeOk(d, 'uge_flyttet'); ugeOk(d.fra, 'uge_flyttet.fra');
    const uge = ugeTekst(d.aar, d.uge), aarsag = kraevet(d.aarsag, 'Årsagen til den nye uge');
    if (afhentning(o)) {
      return statusmail(o, `Ny afhentningsuge for din bestilling ${refAf(o)}: ${uge}`, (link) => [
        `Din bestilling bliver ikke klar til afhentning i uge ${d.fra.uge}, som vi har bekræftet. Den bliver klar til afhentning i ${uge}.`,   // Fable port 3, nr. 8
        aarsag,
        `Du får en mail, når den står klar. Er det et problem for dig, så svar på denne mail eller ring på ${TELEFON}.`,
        foelg(link),
      ]);
    }
    return statusmail(o, `Ny leveringsuge for din bestilling ${refAf(o)}: ${uge}`, (link) => [
      `Vi kan ikke levere i uge ${d.fra.uge}, som vi har bekræftet. Vi leverer i ${uge}.`,
      aarsag,
      `Passer den nye uge ikke, så svar på denne mail eller ring på ${TELEFON}. Så finder vi en anden.`,
      foelg(link),
    ]);
  },

  // 10 · Aftalt med dig. kundens_ja er internt og kommer aldrig med
  aftalt_med_dig(o, d) {
    const tekst = kraevet(d.tekst, 'Teksten under "Aftalt med dig"');
    return statusmail(o, `Aftalt ændring på din bestilling ${refAf(o)}`, (link) => [
      'Vi har skrevet det, vi har aftalt, på din bestilling:',
      tekst,
      `Er det ikke det, vi aftalte, så svar på denne mail i dag eller ring på ${TELEFON}.`,
      foelg(link),
    ]);
  },

  // 11 · Nu kan du følge din bestilling (ordrer lagt før udgivelse 1)
  nu_kan_du_foelge(o) {
    return statusmail(o, `Nu kan du følge din bestilling ${refAf(o)}`, (link) => [
      'Din bestilling har fået sin egen side. Den viser leveringen, det, du har bestilt, og det, vi har aftalt med dig:',
      link,
      'Du skal ikke gøre noget. Vi skriver stadig til dig, når der er nyt.',
    ]);
  },

  ordrebekraeftelse: (o, d) => ordrebekraeftelse(o, d),
  email_rettet: (o, d) => ordrebekraeftelse(o, d),
  noegle_fornyet: (o, d) => ordrebekraeftelse(o, d, { nytLink: true }),
};

function leveretEllerHentet(o, d, hentet) {
  const iDag = iDagAf(o, d), dag = dagTekst(datoOk(d.dato, hentet ? 'hentet' : 'leveret'), iDag);
  const fortryd = d.fortryd_til ? `Du har ${FORTRYDELSE_DAGE} dages fortrydelsesret og kan fortryde til og med ${datoTekst(datoOk(d.fortryd_til, 'fortryd_til'))}.` : null;
  return statusmail(o, hentet ? `Du har hentet din bestilling ${refAf(o)}` : `Din bestilling ${refAf(o)} er leveret`, (link) => [
    hentet ? `Du har hentet din bestilling ${dag}.` : `Vi har leveret din bestilling ${dag}.`,
    hentet ? null : 'Se varen efter for synlige transportskader. Er der noget, så svar på denne mail, gerne med et foto.',
    [fortryd, 'Du har to års reklamationsret efter købeloven.'].filter(Boolean).join('\n'),
    `Det, du har bestilt, finder du her: ${link}`,
  ]);
}

// sprog står i signaturen (kontrakter §7), men mails om en bestilling findes kun på dansk (d6): alle sprog giver dansk
export function mail(type, ordre, data = {}, sprog = 'da') {
  void sprog;
  if (UDEN_MAIL.includes(type)) return null;
  const byg = Object.hasOwn(BYG, type) ? BYG[type] : null;
  if (!byg) fejl(`ukendt mailtype ${type}`);
  return byg(ordre ?? {}, data ?? {});
}

// ---------------------------------------------------------------- nr. 12 · Gem design (afsnit til designerens mail, udgivelse 2)

// Sidste afsnit før hilsenen i mailen fra designeren ("Gem design"). Ikke en hel mail: designer-render sætter det ind.
export function gemDesignAfsnit(sprog = 'da') {
  const [tekst, href] = sprog === 'en'
    ? ['The design is also on My account. Log in with this email at konto.neminventar.dk/en/ to find your saved designs there.', 'https://konto.neminventar.dk/en/']
    : ['Designet står også på Min side. Log ind med denne e-mail på konto.neminventar.dk, så finder du dine gemte designs dér.', 'https://konto.neminventar.dk/'];
  const synlig = sprog === 'en' ? 'konto.neminventar.dk/en/' : 'konto.neminventar.dk';
  return { tekst, html: `<p style="margin:0 0 14px">${esc(tekst).replace(esc(synlig), `<a href="${esc(href)}" style="${LINK_STIL}">${esc(synlig)}</a>`)}</p>` };
}
