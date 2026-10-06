// node --test src/lib/forside.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billedeAf, bevis, emneGruppe } from './forside.ts';

const p = {
  primary_image: 'https://x/storage/v1/object/public/a/natur.png',
  images_meta: [
    { url: 'https://x/storage/v1/object/public/a/natur.png', color: 'natur' },
    { url: 'https://x/storage/v1/object/public/a/blaa.jpg', color: 'blaa' },
  ],
};

test('billedeAf vælger kuløren og falder tilbage til primærbilledet', () => {
  assert.equal(billedeAf(p, 'blaa'), 'https://x/storage/v1/object/public/a/blaa.jpg');
  assert.equal(billedeAf(p, 'sort'), 'https://x/storage/v1/object/public/a/natur.png');
  assert.equal(billedeAf({ primary_image: null, images_meta: null }, 'blaa'), '');
});

test('bevis tager det første tal fra leverancen', () => {
  assert.deepEqual(bevis({ delivery_label: '342 lockers · 342 skohylder · 14 højskabe' }), { b: '342', t: 'lockers' });
  assert.deepEqual(bevis({ delivery_label: '150 m bænke · 150 locker-rum' }), { b: '150 m', t: 'bænke' });
  assert.deepEqual(bevis({ delivery_label: '230 badeværelsesskabe i kompaktlaminat · 220 boliger' }), { b: '230', t: 'badeværelsesskabe i kompaktlaminat' });
  assert.equal(bevis({ delivery_label: 'Garderober med siddenicher' }), null);
  assert.equal(bevis({ delivery_label: null }), null);
});

test('emneGruppe: materialer og arbejdsform for sig, alt andet (også nye emner) er inventar', () => {
  assert.equal(emneGruppe('kompaktlaminat'), 'materialer');
  assert.equal(emneGruppe('vaerkstedstegninger-og-3d-model'), 'arbejdsform');
  assert.equal(emneGruppe('lockers'), 'inventar');
  assert.equal(emneGruppe('et-helt-nyt-emne'), 'inventar');
});
