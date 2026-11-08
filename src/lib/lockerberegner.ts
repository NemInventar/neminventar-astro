// Lockerberegneren (landingssiderne lockers og hvad-koster-lockers): antal brugere → antal rum, opstilling, prisoverslag og et
// link, der åbner præcis den væg i designeren. Priserne står i src/data/locker-beregner.json (scripts/locker_beregner_priser.py,
// designerens egen prismodel). Væglængden følger designerens bredde() i produkter/locker/produkt.js (formlen er tjekket mod den
// af samme script). Ren logik uden DOM, så den kan testes: node --test src/lib/lockerberegner.test.ts
import { kod } from './forside.ts';

export type Rum = 'elev' | 'standard' | 'hoej' | 'personale';
export type Mat = 'kryds' | 'birk' | 'kompakt';
export type Laas = 'haengelaas' | 'noegle' | 'kode' | 'elektronisk';

export interface Valg { brugere: number; rum: Rum; mat: Mat; laas: Laas }
export interface Data {
  rum: Record<Rum, { b: number; h: number; d: number; raekker: number; soejler: number }>;
  vaeg: Record<string, { tyk: number; plade: number; fuge: number }>;
  priser: Record<string, { inkl: number; ex: number }>;
}

export const RUM_VALG: { v: Rum; t: string; maal: string }[] = [
  { v: 'elev', t: 'Elevskab', maal: '30 × 40 × 40 cm, 3 rækker' },
  { v: 'standard', t: 'Standard', maal: '30 × 50 × 45 cm, 2 rækker' },
  { v: 'hoej', t: 'Høj', maal: '30 × 90 × 50 cm, 2 rækker' },
  { v: 'personale', t: 'Personale', maal: '40 × 90 × 50 cm, 2 rækker' },
];
export const MAT_VALG: { v: Mat; t: string }[] = [
  { v: 'kryds', t: 'Krydsfiner' }, { v: 'birk', t: 'Birkefiner' }, { v: 'kompakt', t: 'Kompaktlaminat' },
];
export const LAAS_VALG: { v: Laas; t: string }[] = [
  { v: 'haengelaas', t: 'Hængelås (egen lås)' }, { v: 'noegle', t: 'Nøglelås' },
  { v: 'kode', t: 'Kodelås' }, { v: 'elektronisk', t: 'Elektronisk lås' },
];

export const STANDARD: Valg = { brugere: 24, rum: 'standard', mat: 'kryds', laas: 'noegle' };
export const MAX_BRUGERE = 5000;

const har = <T extends string>(liste: { v: T }[], v: unknown): v is T => liste.some((x) => x.v === v);

// Valg fra adressen (?brugere=24&rum=elev&mat=kryds&laas=kode): ukendte eller manglende værdier falder tilbage til standarden.
export function laesValg(sp: URLSearchParams | string): Valg {
  const q = typeof sp === 'string' ? new URLSearchParams(sp) : sp;
  const n = Math.floor(Number(q.get('brugere')));
  const rum = q.get('rum'), mat = q.get('mat'), laas = q.get('laas');
  return {
    brugere: Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_BRUGERE) : STANDARD.brugere,
    rum: har(RUM_VALG, rum) ? rum : STANDARD.rum,
    mat: har(MAT_VALG, mat) ? mat : STANDARD.mat,
    laas: har(LAAS_VALG, laas) ? laas : STANDARD.laas,
  };
}
export const skrivValg = (v: Valg) => `brugere=${v.brugere}&rum=${v.rum}&mat=${v.mat}&laas=${v.laas}`;

// Væggens bredde (cm) som designerens bredde(): søjler × rumbredde + elementer × pladetykkelse + (elementer − 1) × fuge.
// Elementerne er så få som muligt, lige store og højst én plade lange.
export function vaegBreddeCm(soejler: number, b: number, v: { tyk: number; plade: number; fuge: number }): number {
  const kmax = Math.max(1, Math.floor((v.plade - v.tyk) / (b / 100) + 1e-9));
  const el = Math.ceil(soejler / kmax);
  return Math.round((soejler * b) / 100 * 100 + el * v.tyk * 100 + (el - 1) * v.fuge * 100);
}

export interface Resultat {
  soejler: number; raekker: number; antalRum: number; elementer: number;
  inkl: number; ex: number; vaegCm: number | null; tilstand: Record<string, unknown>;
}

export function beregn(valg: Valg, data: Data): Resultat | null {
  const m = data.rum[valg.rum];
  const pris = data.priser[`${valg.rum}/${valg.mat}/${valg.laas}`];
  if (!m || !pris) return null;
  const brugere = Math.min(Math.max(1, Math.floor(valg.brugere) || 1), MAX_BRUGERE);
  const soejler = Math.ceil(brugere / m.raekker);
  const antalRum = soejler * m.raekker;
  const v = data.vaeg[`${valg.rum}/${valg.mat}`];
  const kmax = v ? Math.max(1, Math.floor((v.plade - v.tyk) / (m.b / 100) + 1e-9)) : 0;
  return {
    soejler, raekker: m.raekker, antalRum, elementer: v ? Math.ceil(soejler / kmax) : 0,
    inkl: Math.round(pris.inkl * antalRum), ex: Math.round(pris.ex * antalRum),
    vaegCm: v ? vaegBreddeCm(soejler, m.b, v) : null,
    // samme nøgler som i prisberegningen (scripts/locker_beregner_priser.py): det, designeren får at se
    tilstand: { soejler, raekker: m.raekker, b: m.b, h: m.h, d: m.d, mat: valg.mat, laas: valg.laas, haengsel: 'institution' },
  };
}

export const DESIGNER = 'https://designer.neminventar.dk/designer.html';
export const designerUrl = (tilstand: Record<string, unknown>) => `${DESIGNER}?p=locker&t=${kod(tilstand)}`;

// "8 søjler i 3 rækker"
export const opstilling = (soejler: number, raekker: number) =>
  `${soejler} ${soejler === 1 ? 'søjle' : 'søjler'} i ${raekker} rækker`;

// Overslaget skrives som det udregnede tal, ikke rundet (Joachim 13-10-2026: ingen runde beløb ud af døren).
