// Kontomails fra konto@ (fable-runde3.md d6): nr. 1 login-kode, nr. 2 slette-kode, nr. 13 kontoen er slettet.
// Ordret fra Fable, dansk og engelsk. Kontomails har ingen navn og hilser "Hej" (d6). Ingen tekst fra anmodningen
// kommer med (S2) — kun koden, som vi selv har lavet.

const SIGNATUR = {
  da: 'Venlig hilsen\nNem Inventar\ntilbud@neminventar.dk · +45 42 42 26 84',
  en: 'Kind regards\nNem Inventar\ntilbud@neminventar.dk · +45 42 42 26 84',
};

// "482913" → "482 913"
export const visKode = (k) => `${k.slice(0, 3)} ${k.slice(3)}`;

const sprogAf = (s) => (s === 'en' ? 'en' : 'da');

export function loginKodeMail(kode, sprog) {
  const k = visKode(kode);
  if (sprogAf(sprog) === 'en') {
    return {
      emne: `${k} is your Nem Inventar code`,
      tekst: [
        'Hello',
        `Your code is ${k}`,
        'Enter it on the page where you asked for it. The code is valid for 15 minutes and can be used once.',
        'If you did not ask for a code, you can ignore this email. Nobody can log in without it. We will never ask you for the code by phone or email.',
        SIGNATUR.en,
      ].join('\n\n'),
    };
  }
  return {
    emne: `${k} er din kode til Nem Inventar`,
    tekst: [
      'Hej',
      `Din kode er ${k}`,
      'Skriv den på siden, hvor du bad om den. Koden gælder i 15 minutter og kan bruges én gang.',
      'Har du ikke bedt om en kode, kan du se bort fra mailen. Ingen kan logge ind uden den. Vi beder dig aldrig om koden på telefon eller mail.',
      SIGNATUR.da,
    ].join('\n\n'),
  };
}

export function sletKodeMail(kode, sprog) {
  const k = visKode(kode);
  if (sprogAf(sprog) === 'en') {
    return {
      emne: 'Code to delete your Nem Inventar account',
      tekst: [
        'Hello',
        `You have asked to delete your account. The code is ${k}`,
        'Enter it on My account to delete the account. The code is valid for 10 minutes and can be used once.',
        'If you did not ask to delete the account, call us on +45 42 42 26 84. Without the code, nothing happens.',
        SIGNATUR.en,
      ].join('\n\n'),
    };
  }
  return {
    emne: 'Kode til at slette din konto hos Nem Inventar',
    tekst: [
      'Hej',
      `Du har bedt om at slette din konto. Koden er ${k}`,
      'Skriv den på Min side for at slette kontoen. Koden gælder i 10 minutter og kan bruges én gang.',
      'Har du ikke bedt om at slette kontoen, så ring til os på +45 42 42 26 84. Uden koden sker der ingenting.',
      SIGNATUR.da,
    ].join('\n\n'),
  };
}

// harOrdrer: true kun når broen har svaret med mindst én bestilling; ukendt (broen nede) = linjen udelades
export function kontoSlettetMail(harOrdrer, sprog) {
  if (sprogAf(sprog) === 'en') {
    return {
      emne: 'Your Nem Inventar account has been deleted',
      tekst: [
        'Hello',
        'We have deleted your login and your saved designs.',
        ...(harOrdrer ? ['We keep your orders for five years after the end of the financial year, as Danish bookkeeping law requires. The link in your order confirmation still works.'] : []),
        'If you did not delete the account yourself, call us on +45 42 42 26 84.',
        SIGNATUR.en,
      ].join('\n\n'),
    };
  }
  return {
    emne: 'Din konto hos Nem Inventar er slettet',
    tekst: [
      'Hej',
      'Vi har slettet dit login og dine gemte designs.',
      ...(harOrdrer ? ['Dine bestillinger gemmer vi i fem år efter regnskabsårets udgang, som bogføringsloven kræver. Linket i din ordrebekræftelse virker fortsat.'] : []),
      'Har du ikke selv slettet kontoen, så ring til os på +45 42 42 26 84.',
      SIGNATUR.da,
    ].join('\n\n'),
  };
}
