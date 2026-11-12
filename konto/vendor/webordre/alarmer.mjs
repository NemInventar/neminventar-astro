// Kernen for Min side og ordrestatus: alarmerne på webordrer (Fable runde 3, afsnit g "Alarmer"; teknik R19, §9).
// Én ren funktion afgør, hvilke af de otte alarmer der gælder for en ordre lige nu. Samme regel står i SQL som
// fn_webordre_alarm_regel (ni-apps sql/2026-11-12-min-side-06-alarmer.sql), og testvektorerne i
// test/fixtures/webordre-alarmer.json køres mod begge. pg_cron kalder SQL-udgaven; /webordrer og testene bruger denne.
// Rene funktioner uden I/O; kanonisk i ni-apps lib/webordre/ — se datoer.mjs.
//
//   alarmer(ordrer, nuIso) -> [{ nr, noegle, ordre_id, ref, tekst, huskeliste, til: [{ email, kanal }] }]
//
// ordre = { id, ref?, status, stripe_mode, ansvarlig, uge_frist_at?, betaling: {betalt_at}, levering: {form},
//           forloeb: [{ id, trin, data, tid }], mailjob: [{ id, forsoeg, sendt_at }] }
// noegle er alarmens identitet: SQL-udgaven gemmer den og sender aldrig samme nøgle to gange.
// kanal: 'teams' = 1:1 fra botten (fn_teams_notify) · 'teams_alarm' = Joachims systemalarm (api_secrets teams_alarm).
//
// Reglerne (dansk tid, Europe/Copenhagen):
//   1 Leveringsugen skal bekræftes i dag  på fristdagen fra kl. 7, til fristen er gået        → den ansvarlige
//   2 Fristen er ikke handlet             på fristdagen fra kl. 12, til fristen er gået       → Joachim
//   3 Fristen er overskredet              når fristen er gået (kundens side: tilstand 2)      → den ansvarlige og Joachim
//   4 Ingen dag aftalt                    fredag i den bekræftede uge fra kl. 7, ugen ud      → den ansvarlige (kun levering)
//   5 Ugen er gået uden levering          mandag efter ugen fra kl. 7 (kundens side: tilst. 5) → den ansvarlige og Joachim
//   6 Aftalt dag passeret uden "Leveret"  dagen efter den aftalte dag fra kl. 7               → den ansvarlige
//   7 Kunden har meldt "ikke min bestilling"  straks (huskelisten lægger broen; her kun Teams)  → den ansvarlige
//   8 Mail ikke sendt                     når sidste forsøg (5) er fejlet                     → den ansvarlige
// 1–6 kun for betalte ordrer, der ikke er leveret/hentet eller fortrudt. TEST-ordrer (stripe_mode ≠ PROD) går kun til
// Joachim (1:1) med "[TEST] " foran — som designer-ordre gør med huskelisten i TEST.
import { kbhDato, plusDage, ugeDatoer, ugeFrist } from './datoer.mjs';
import { tilstand } from './tilstand.mjs';

export const JOACHIM = 'js@neminventar.dk';
export const MORGEN = 7;       // "om morgenen"
export const MIDDAG = 12;      // "kl. 12 på fristdagen"
export const MAX_FORSOEG = 5;  // = webordre-mailkoe regler.js MAX_FORSOEG
export const SIDE = 'https://ni-apps.pages.dev/webordrer/';

export const TITEL = Object.freeze({
  1: 'Leveringsugen skal bekræftes i dag',
  2: 'Fristen er ikke handlet',
  3: 'Fristen er overskredet',
  4: 'Ingen dag aftalt',
  5: 'Ugen er gået uden levering',
  6: 'Aftalt dag passeret uden "Leveret"',
  7: 'Kunden har meldt "ikke min bestilling"',
  8: 'Mail ikke sendt',
});
const HVEM = Object.freeze({ 1: ['a'], 2: ['j'], 3: ['a', 'j'], 4: ['a'], 5: ['a', 'j'], 6: ['a'], 7: ['a'], 8: ['a'] });

const refAf = (o) => o?.ref ?? `NI-${String(o?.id ?? '').slice(0, 8).toUpperCase()}`;
/** Link til rækken på /webordrer (pointeren i huskelisten). */
export const sideLink = (ref) => `${SIDE}?ordre=${encodeURIComponent(ref)}`;

// Klokken i København (hel time 0-23) for et øjeblik
let _fmt = null;
const time = (ms) => {
  _fmt ??= new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', hourCycle: 'h23' });
  return Number(_fmt.format(new Date(ms))) % 24;
};
const kortDato = (d) => { const [, m, dd] = d.split('-'); return `${Number(dd)}/${Number(m)}`; };

/** Alarmerne for én ordre lige nu. */
export function alarmerFor(o, nuIso) {
  if (!o || (o.status !== 'betalt' && o.status !== 'annulleret')) return [];
  const nuMs = typeof nuIso === 'number' ? nuIso : Date.parse(nuIso instanceof Date ? nuIso.toISOString() : String(nuIso));
  if (!Number.isFinite(nuMs)) throw new TypeError(`nu er ikke et tidspunkt: ${nuIso}`);
  const iDag = kbhDato(nuMs), kl = time(nuMs), ref = refAf(o);
  const ud = [];
  const tilfoej = (nr, noegle, ekstra = '') => ud.push({ nr, noegle, ordre_id: o.id, ref, tekst: `${TITEL[nr]}${ekstra}: ${ref}` });
  const forloeb = Array.isArray(o.forloeb) ? o.forloeb : [];

  if (o.status === 'betalt' && !forloeb.some((f) => f?.trin === 'fortrudt')) {
    const t = tilstand({ ...o, betaling: o.betaling ?? {} }, nuMs);
    const lev = forloeb.some((f) => f?.trin === 'leveret' || f?.trin === 'hentet');
    const afhent = o.levering?.form === 'afhentning';
    const fristIso = o.uge_frist_at ?? (o.betaling?.betalt_at ? ugeFrist(o.betaling.betalt_at) : null);
    if (!lev && !t.uge && fristIso) {
      const fristDato = kbhDato(fristIso), fristMs = Date.parse(fristIso);
      if (nuMs > fristMs) tilfoej(3, `3:${o.id}:${fristDato}`);
      else if (iDag === fristDato) {
        if (kl >= MORGEN) tilfoej(1, `1:${o.id}:${fristDato}`);
        if (kl >= MIDDAG) tilfoej(2, `2:${o.id}:${fristDato}`);
      }
    }
    if (!lev && t.uge) {
      const { mandag, fredag } = ugeDatoer(t.uge.aar, t.uge.uge), efter = plusDage(mandag, 7);
      const uge = `${t.uge.aar}-${t.uge.uge}`;
      const fra = (dag) => iDag > dag || (iDag === dag && kl >= MORGEN);   // fra kl. 7 på dagen (og alle dage efter)
      if (!afhent && !t.dag && fra(fredag) && iDag < efter) tilfoej(4, `4:${o.id}:${uge}`, ` (uge ${t.uge.uge})`);
      if (fra(efter) && (afhent ? t.nr !== 12 : !t.dag)) tilfoej(5, `5:${o.id}:${uge}`, ` (uge ${t.uge.uge})`);
      if (!afhent && t.dag && fra(plusDage(t.dag.dato, 1))) tilfoej(6, `6:${o.id}:${t.dag.dato}`, ` (${kortDato(t.dag.dato)})`);
    }
  }
  for (const f of forloeb) if (f?.trin === 'ikke_min' && f.id != null) tilfoej(7, `7:${f.id}`);
  for (const m of Array.isArray(o.mailjob) ? o.mailjob : []) {
    if (m && !m.sendt_at && Number(m.forsoeg) >= MAX_FORSOEG && m.id != null) tilfoej(8, `8:${m.id}`);
  }

  // Modtagere: den ansvarlige (1:1 i Teams) og Joachim (systemalarmen). TEST: kun Joachim, 1:1, "[TEST] " foran
  const test = o.stripe_mode !== 'PROD';
  const ansvarlig = String(o.ansvarlig || 'kontakt@neminventar.dk').toLowerCase().trim();
  return ud.map((a) => {
    const til = [];
    for (const h of HVEM[a.nr]) {
      const email = test ? JOACHIM : h === 'a' ? ansvarlig : JOACHIM;
      const kanal = !test && h === 'j' ? 'teams_alarm' : 'teams';
      const findes = til.find((x) => x.email === email);
      if (!findes) til.push({ email, kanal });
      else if (kanal === 'teams_alarm') findes.kanal = kanal;
    }
    return { ...a, tekst: `${test ? '[TEST] ' : ''}${a.tekst}`, huskeliste: a.nr !== 7, til };
  });
}

/** Alarmerne for alle ordrer lige nu, i ordrernes rækkefølge og alarmernes nummerorden pr. ordre. */
export function alarmer(ordrer, nuIso) {
  return (Array.isArray(ordrer) ? ordrer : []).flatMap((o) => alarmerFor(o, nuIso));
}
