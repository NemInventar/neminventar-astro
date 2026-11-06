// Sprogskiftet i menuen og footeren (Milot 06-11-2026: "når man skifter sprog skal man forblive på samme side som man var
// på … og ikke hoppe tilbage til forsiden"). Linket går til sidens egen udgave på sproget — de hreflang-par, siden selv
// giver Base (alternates) — og ellers til sprogets forside. Stien uden domæne, så forhåndsvisningen bliver på sit domæne.
export type Sprog = 'da' | 'en' | 'de';
export type Alternate = { hreflang: string; href: string };

const FORSIDE: Record<Sprog, string> = { da: '', en: 'en/', de: 'de/' };

export function sprogLink(base: string, lang: Sprog, alternates: Alternate[] = []): string {
  const a = alternates.find((x) => x.hreflang === lang);
  return a ? new URL(a.href).pathname : base + FORSIDE[lang];
}
