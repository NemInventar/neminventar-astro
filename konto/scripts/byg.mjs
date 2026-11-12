// Bygger konto-sitet i én udgivelse til en given mappe (bruges af testene og skærmbillederne, der skal have begge).
// byg({ udgivelse: 1|2, ud: '<absolut mappe>', sitekey?, kraevTurnstile? }) → Promise<ud>. Selve buildet: `npm run build:konto`.
// Testene styrer selv Turnstile-kravet (produktionens KONTO_KRAEV_TURNSTILE arves aldrig fra miljøet).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROD = fileURLToPath(new URL('../../', import.meta.url));
const ASTRO = path.join(ROD, 'node_modules', 'astro', 'bin', 'astro.mjs');

export function byg({ udgivelse, ud, sitekey, kraevTurnstile = false } = {}) {
  return new Promise((ok, nej) => {
    const env = { ...process.env, KONTO_UDGIVELSE: String(udgivelse), KONTO_OUT: ud, ASTRO_TELEMETRY_DISABLED: '1' };
    delete env.KONTO_TURNSTILE_SITEKEY;
    delete env.KONTO_KRAEV_TURNSTILE;
    if (sitekey) env.KONTO_TURNSTILE_SITEKEY = sitekey;
    if (kraevTurnstile) env.KONTO_KRAEV_TURNSTILE = '1';
    const p = spawn(process.execPath, [ASTRO, 'build', '--config', 'astro.konto.config.mjs', '--silent'], { cwd: ROD, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    p.stdout.on('data', (d) => { log += d; });
    p.stderr.on('data', (d) => { log += d; });
    p.on('error', nej);
    p.on('close', (kode) => (kode === 0 ? ok(ud) : nej(new Error(`astro build (udgivelse ${udgivelse}) fejlede:\n${log}`))));
  });
}
