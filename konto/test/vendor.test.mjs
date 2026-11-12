// konto/vendor/webordre/ er en kopi af kernen i ni-apps lib/webordre/ (kontrakter §1). Kopien må ikke rettes i hånden:
// sha256 af hver fil (med LF) skal passe med MANIFEST.json, og der må ikke ligge andre filer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const MAPPE = new URL('../vendor/webordre/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('MANIFEST.json', MAPPE), 'utf8'));

test('vendor-kopien matcher MANIFEST.json (sha256, LF)', () => {
  const filer = readdirSync(MAPPE).filter((f) => f !== 'MANIFEST.json').sort();
  assert.deepEqual(filer, Object.keys(manifest.filer).sort(), 'samme filer som i manifestet');
  for (const [f, sha] of Object.entries(manifest.filer)) {
    const indhold = readFileSync(new URL(f, MAPPE), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(indhold, 'utf8').digest('hex'), sha, f);
  }
});
