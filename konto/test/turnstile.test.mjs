// Turnstile i produktion (sikkerhedsgennemgangen 12-11 nr. 9): udgivelse 2 på main bygges aldrig med Cloudflares testnøgle.
// KontoLayout.astro → turnstileNoegle(process.env); .github/workflows/konto.yml sætter KONTO_KRAEV_TURNSTILE=1 på main.
// Selve buildet, der fejler, prøves i build.test.mjs (builds må ikke køre samtidig).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { turnstileNoegle, TURNSTILE_TEST } from '../src/lib/turnstile.mjs';

const RIGTIG = '0x4AAAAAAAAAAAAAAAAAAAAA';
const ROD = (p) => new URL(`../../${p}`, import.meta.url);

test('turnstile: den rigtige nøgle bruges altid, når den er sat', () => {
  for (const env of [{ KONTO_TURNSTILE_SITEKEY: RIGTIG }, { KONTO_TURNSTILE_SITEKEY: ` ${RIGTIG} `, KONTO_UDGIVELSE: '2', KONTO_KRAEV_TURNSTILE: '1' }]) {
    assert.deepEqual(turnstileNoegle(env), { sitekey: RIGTIG, test: false });
  }
});

test('turnstile: uden nøgle — testnøglen på staging og i udgivelse 1, men produktionens udgivelse 2 fejler', () => {
  assert.equal(TURNSTILE_TEST, '1x00000000000000000000BB');
  for (const env of [{}, { KONTO_UDGIVELSE: '2' }, { KONTO_UDGIVELSE: '1', KONTO_KRAEV_TURNSTILE: '1' }, { KONTO_UDGIVELSE: '2', KONTO_KRAEV_TURNSTILE: '' },
    { KONTO_UDGIVELSE: '2', KONTO_KRAEV_TURNSTILE: '0' }]) {
    assert.deepEqual(turnstileNoegle(env), { sitekey: TURNSTILE_TEST, test: true }, JSON.stringify(env));
  }
  for (const env of [{ KONTO_UDGIVELSE: '2', KONTO_KRAEV_TURNSTILE: '1' }, { KONTO_UDGIVELSE: '2', KONTO_KRAEV_TURNSTILE: '1', KONTO_TURNSTILE_SITEKEY: '  ' }]) {
    assert.throws(() => turnstileNoegle(env), /KONTO_TURNSTILE_SITEKEY mangler/, JSON.stringify(env));
  }
});

test('turnstile: KontoLayout bruger turnstileNoegle, og konto.yml kræver nøglen på main (kun der)', () => {
  const layout = readFileSync(ROD('konto/src/layouts/KontoLayout.astro'), 'utf8');
  assert.match(layout, /import \{ turnstileNoegle \} from '\.\.\/lib\/turnstile\.mjs';/);
  assert.match(layout, /const ts = turnstileNoegle\(process\.env\);/);
  assert.doesNotMatch(layout, /1x00000000000000000000BB/, 'testnøglen står kun ét sted (turnstile.mjs)');
  const yml = readFileSync(ROD('.github/workflows/konto.yml'), 'utf8');
  const byg = yml.slice(yml.indexOf('- name: Byg siderne'), yml.indexOf('- name: Test siderne'));
  assert.match(byg, /KONTO_KRAEV_TURNSTILE: \$\{\{ github\.ref_name == 'main' && '1' \|\| '' \}\}/, 'kravet sættes i byggetrinnet, kun på main');
  assert.match(byg, /KONTO_TURNSTILE_SITEKEY: \$\{\{ vars\.KONTO_TURNSTILE_SITEKEY \}\}/);
  assert.equal((yml.match(/KONTO_KRAEV_TURNSTILE/g) ?? []).length, 1, 'kravet står kun i byggetrinnet (testene styrer det selv)');
});
