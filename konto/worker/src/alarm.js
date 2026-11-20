// Alarmer (R19) til en webhook fra miljøet: TEAMS_ALARM_URL (+ evt. TEAMS_ALARM_NOEGLE som x-ni-key, så ERP'ets
// post-teams kan bruges direkte; ALARM_TIL = modtagerens mail, standard js@). Kroppen følger post-teams:
// {title, lines, to_email}. Kun type og tal — aldrig e-mail, kode, cookie eller nøgle (R17). Fejler aldrig.

export const ALARM_TYPER = Object.freeze({
  koder_doegn: 'Mange koder i dag',
  forkerte_time: 'Mange forkerte koder i denne time',
  byge: 'Mange afviste kodeanmodninger (429) i denne time',
  graph: 'Graph kunne ikke sende en kontomail',
  konto_slettet: 'En kunde har slettet sin konto',
});

export async function alarm(env, fetcher, type, linjer = []) {
  if (!env.TEAMS_ALARM_URL || !Object.hasOwn(ALARM_TYPER, type)) return false;
  const headers = { 'content-type': 'application/json' };
  if (env.TEAMS_ALARM_NOEGLE) headers['x-ni-key'] = env.TEAMS_ALARM_NOEGLE;
  try {
    const res = await fetcher(env.TEAMS_ALARM_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `ni-konto (${env.MILJOE || 'ukendt'}): ${ALARM_TYPER[type]}`,
        lines: [`type: ${type}`, ...linjer.map(String)],
        to_email: env.ALARM_TIL || 'js@neminventar.dk',
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
