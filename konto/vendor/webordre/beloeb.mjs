// Kernen for Min side og ordrestatus: beløb. Alle beløb er heltal i øre; teksten er dansk: '16.012,50 kr.'.
// Ingen Intl-locale (ens i Node, Deno, browser og Workers). Kanonisk i ni-apps lib/webordre/ — se datoer.mjs.

/** Øre → '16.012,50 kr.' (negativt: '-1.750,00 kr.'). */
export function kr(oere) {
  const n = oere == null || oere === '' ? NaN : Number(oere);
  if (!Number.isSafeInteger(n)) throw new TypeError(`beløbet skal være hele øre: ${oere}`);
  const a = Math.abs(n);
  const hele = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}${hele},${String(a % 100).padStart(2, '0')} kr.`;
}
