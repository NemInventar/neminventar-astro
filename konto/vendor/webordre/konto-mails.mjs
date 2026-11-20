// Kontomails fra konto@neminventar.dk (Reply-To tilbud@), sendt af Workeren ni-konto-backend: fable-runde3.md d6 nr. 1, 2, 13
// og 15. Dansk og engelsk. Ingen navn: kontomails hilser "Hej" / "Hello" (d6, indledningen). Rene funktioner uden I/O.
//
//   kontoMail(type, data = {}, sprog = 'da') -> { emne, html, tekst }
//
//   'kode'        (nr. 1)  data.kode: 6 cifre                       — login-kode, 15 minutter (R1)
//   'slette_kode' (nr. 2)  data.kode: 6 cifre                       — kode til at slette kontoen, 10 minutter (R7)
//   'slettet'     (nr. 13) data.harOrdrer: bool                     — kontoen er slettet
//   'varsel'      (nr. 15) data.dato 'YYYY-MM-DD', data.harOrdrer   — varsel før en ubrugt konto slettes (skrevet nu, bygges senere)
//
// Samme form og stil som mails.mjs (mailUd). Workeren vendorer kernen, så filen importerer kun fra lib/webordre/.
import { datoTekst } from './datoer.mjs';
import { mailUd, HILSEN, TELEFON } from './mails.mjs';

const fejl = (besked) => { throw new Error(`konto-mails: ${besked}`); };
// '482913' → '482 913' (som i d6)
export function kodeTekst(kode) {
  const s = String(kode ?? '');
  if (!/^\d{6}$/.test(s)) fejl('koden skal være 6 cifre');
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}
const datoOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d ?? '')) ? d : fejl(`dato ${d}`));
const KONTO = { da: ['konto.neminventar.dk', 'https://konto.neminventar.dk/'], en: ['konto.neminventar.dk/en/', 'https://konto.neminventar.dk/en/'] };

const TEKSTER = {
  da: {
    kode: (d) => {
      const k = kodeTekst(d.kode);
      return [`${k} er din kode til Nem Inventar`, [
        'Hej',
        `Din kode er ${k}`,
        'Skriv den på siden, hvor du bad om den. Koden gælder i 15 minutter og kan bruges én gang.',
        'Har du ikke bedt om en kode, kan du se bort fra mailen. Ingen kan logge ind uden den. Vi beder dig aldrig om koden på telefon eller mail.',
      ]];
    },
    slette_kode: (d) => ['Kode til at slette din konto hos Nem Inventar', [
      'Hej',
      `Du har bedt om at slette din konto. Koden er ${kodeTekst(d.kode)}`,
      'Skriv den på Min side for at slette kontoen. Koden gælder i 10 minutter og kan bruges én gang.',
      `Har du ikke bedt om at slette kontoen, så ring til os på ${TELEFON}. Uden koden sker der ingenting.`,
    ]],
    slettet: (d) => ['Din konto hos Nem Inventar er slettet', [
      'Hej',
      'Vi har slettet dit login og dine gemte designs.',
      d.harOrdrer ? 'Dine bestillinger gemmer vi i fem år efter regnskabsårets udgang, som bogføringsloven kræver. Linket i din ordrebekræftelse virker fortsat.' : null,
      `Har du ikke selv slettet kontoen, så ring til os på ${TELEFON}.`,
    ]],
    varsel: (d) => {
      const dato = datoTekst(datoOk(d.dato), 'da');
      return [`Vi sletter din konto hos Nem Inventar den ${dato}`, [
        'Hej',
        `Du har ikke været logget ind på Min side i to år. Den ${dato} sletter vi derfor dit login og dine gemte designs.`,
        'Vil du beholde kontoen, så log ind inden da på konto.neminventar.dk.',
        d.harOrdrer ? 'Dine bestillinger gemmer vi, så længe bogføringsloven kræver det, og linket i din ordrebekræftelse virker fortsat.' : null,
      ]];
    },
  },
  en: {
    kode: (d) => {
      const k = kodeTekst(d.kode);
      return [`${k} is your Nem Inventar code`, [
        'Hello',
        `Your code is ${k}`,
        'Enter it on the page where you asked for it. The code is valid for 15 minutes and can be used once.',
        'If you did not ask for a code, you can ignore this email. Nobody can log in without it. We will never ask you for the code by phone or email.',
      ]];
    },
    slette_kode: (d) => ['Code to delete your Nem Inventar account', [
      'Hello',
      `You have asked to delete your account. The code is ${kodeTekst(d.kode)}`,
      'Enter it on My account to delete the account. The code is valid for 10 minutes and can be used once.',
      `If you did not ask to delete the account, call us on ${TELEFON}. Without the code, nothing happens.`,
    ]],
    slettet: (d) => ['Your Nem Inventar account has been deleted', [
      'Hello',
      'We have deleted your login and your saved designs.',
      d.harOrdrer ? 'We keep your orders for five years after the end of the financial year, as Danish bookkeeping law requires. The link in your order confirmation still works.' : null,
      `If you did not delete the account yourself, call us on ${TELEFON}.`,
    ]],
    varsel: (d) => {
      const dato = datoTekst(datoOk(d.dato), 'en');
      return [`We will delete your Nem Inventar account on ${dato}`, [
        'Hello',
        `You have not been logged in to My account for two years. On ${dato} we will therefore delete your login and your saved designs.`,
        'If you want to keep the account, log in before then at konto.neminventar.dk/en/.',
        d.harOrdrer ? 'We keep your orders for as long as Danish bookkeeping law requires, and the link in your order confirmation still works.' : null,
      ]];
    },
  },
};
export const KONTO_MAILS = Object.freeze({ kode: 1, slette_kode: 2, slettet: 13, varsel: 15 });

export function kontoMail(type, data = {}, sprog = 'da') {
  const s = sprog === 'en' ? 'en' : 'da';
  const byg = Object.hasOwn(TEKSTER[s], type) ? TEKSTER[s][type] : null;
  if (!byg) fejl(`ukendt mailtype ${type}`);
  const [emne, afsnit] = byg(data ?? {});
  // Kun varslet nævner adressen; den gøres klikbar i HTML-udgaven
  const m = mailUd(emne, [...afsnit, HILSEN[s]], type === 'varsel' ? [KONTO[s]] : []);
  return type === 'kode' || type === 'slette_kode' ? { ...m, html: kodeLinje(m.html, kodeTekst(data.kode)) } : m;
}

// Fable port 3, nr. 33: i HTML-delen står koden med fed skrift og 22 px på sin egen linje ("Din kode er" / "482 913").
// Teksten og emnet er uændrede. En blok i samme afsnit (ikke et nyt <p>), så HTML og tekst stadig siger præcis det samme;
// en mailklient uden display:block viser koden fed og stor i linjen. Koden er seks cifre og et mellemrum og står sidst i
// sit afsnit, så den kan ikke ramme andet i mailen.
export const KODE_STIL = 'display:block;margin-top:6px;font-size:22px;font-weight:700;letter-spacing:.06em';
function kodeLinje(html, k) {
  const foer = ` ${k}</p>`;
  if (!html.includes(foer)) fejl('koden står ikke sidst i sit afsnit');
  return html.replace(foer, ` <strong style="${KODE_STIL}">${k}</strong></p>`);
}
