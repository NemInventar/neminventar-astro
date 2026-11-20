// konto.neminventar.dk/api/* → Worker ni-konto-backend (service binding KONTO). Kun videresendelse: metode, headere og
// body bevares uændret, og svaret kommer tilbage uændret. Ingen logik og ingen nøgler her (kontrakter.md §6).
export function onRequest({ request, env }) {
  return env.KONTO.fetch(request);
}
