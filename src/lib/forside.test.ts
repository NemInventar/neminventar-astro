// node --test src/lib/forside.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billedeAf, bevis, emneGruppe, designerLink } from './forside.ts';

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

test('designerLink: kuløren som farvede låger, IFC-download og intet link for typer uden model', () => {
  const u = new URL(designerLink('hoejskab-krydsfiner', 'blaa', 'ifc')!);
  assert.equal(u.searchParams.get('p'), 'hoejskab');
  assert.equal(u.searchParams.get('hent'), 'ifc');
  const st = JSON.parse(Buffer.from(u.searchParams.get('t')!, 'base64url').toString('utf8'));
  assert.deepEqual(st, { mat: 'kryds', front: 'farve', farve: { kryds: 'natur', laage: 'blaa' } });
  const lock = JSON.parse(Buffer.from(new URL(designerLink('garderobeskab-perforerede-lager', 'fern')!).searchParams.get('t')!, 'base64url').toString('utf8'));
  assert.deepEqual(lock, { mat: 'kryds', farve: { kryds: 'fern' } });
  assert.equal(designerLink('akustikpanel-kvadrat-stof'), null);
});

test('emneGruppe: materialer og arbejdsform for sig, alt andet (også nye emner) er inventar', () => {
  assert.equal(emneGruppe('kompaktlaminat'), 'materialer');
  assert.equal(emneGruppe('vaerkstedstegninger-og-3d-model'), 'arbejdsform');
  assert.equal(emneGruppe('lockers'), 'inventar');
  assert.equal(emneGruppe('et-helt-nyt-emne'), 'inventar');
});
