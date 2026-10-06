// node --test src/lib/varianter.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { varianterAf, variantId, prisHref, variantFraUrl, variantTilbud, typeTilbud } from './varianter.ts';

const kulorer = [
  { slug: 'natur', label: 'Natur', swatch_hex: '#D9C4A0', sort_order: 1 },
  { slug: 'charcoal', label: 'Charcoal', swatch_hex: '#3A3A38', sort_order: 3 },
  { slug: 'blaa', label: 'Blå', swatch_hex: '#43687C', sort_order: 6 },
];
const img = (n: string) => `https://x/storage/v1/object/public/a/${n}.jpg`;
const locker = {
  slug: 'garderobeskab-perforerede-lager', name: 'Garderobeskabe med perforerede låger', color_order: ['blaa'],
  images_meta: [
    { url: img('detalje'), color: 'charcoal' }, { url: img('uden'), color: null }, { url: img('charcoal2'), color: 'charcoal' },
    { url: img('burgundy'), color: 'deep-burgundy' }, { url: img('blaa'), color: 'blaa' }, { url: img('natur'), color: 'natur' },
  ],
};

test('varianterAf: color_order først, så farvekortet, én pr. kulør, og ukendte kulører og billeder uden kulør springes over', () => {
  const v = varianterAf(locker, kulorer);
  assert.deepEqual(v.map((x) => x.kuloer), ['blaa', 'natur', 'charcoal']);
  assert.equal(v[2].img, img('detalje'));
  assert.equal(v[0].label, 'Blå');
  assert.equal(v[0].hex, '#43687C');
  assert.equal(v[0].id, 'v-blaa');
  assert.equal(v[0].navn, 'Garderobeskabe med perforerede låger');
});

test('varianterAf: materialefarver får deres eget navn og ingen prøvefarve', () => {
  const p = {
    slug: 'koekkenvaeg-laminat-standard', name: 'Køkkenvæg i laminat', color_order: null,
    images_meta: [{ url: img('graa'), color: null }, { url: img('shade'), color: 'rosa-shade' }, { url: img('pino'), color: 'verde-pino' }],
  };
  const v = varianterAf(p, kulorer);
  assert.deepEqual(v.map((x) => x.label), ['Rosa Shade', 'Verde Pino']);
  assert.equal(v[0].hex, null);
});

test('varianterAf: ingen billeder giver ingen varianter', () => {
  assert.deepEqual(varianterAf({ slug: 'x', name: 'X', color_order: null, images_meta: null }, kulorer), []);
});

test('variantId er et gyldigt anker, også med æøå og mellemrum', () => {
  assert.equal(variantId('blaa'), 'v-blaa');
  assert.equal(variantId('grøn'), 'v-groen');
  assert.equal(variantId('terrakotta HPL'), 'v-terrakotta-hpl');
});

test('prisHref: emnet og varianten går med til kontaktsiden', () => {
  assert.equal(
    prisHref('/', { slug: 'hoejskab-krydsfiner', navn: 'Højskab i krydsfiner', kuloer: 'blaa', label: 'Blå' }),
    '/kontakt?emne=H%C3%B8jskab%20i%20krydsfiner%2C%20bl%C3%A5&v=hoejskab-krydsfiner~blaa',
  );
  assert.equal(prisHref('/', { slug: 'hoejskab-krydsfiner', navn: 'Højskab i krydsfiner' }), '/kontakt?emne=H%C3%B8jskab%20i%20krydsfiner');
});

test('variantFraUrl læser ?v=<slug>~<kulør> og afviser alt andet', () => {
  assert.deepEqual(variantFraUrl('?emne=x&v=hoejskab-krydsfiner~blaa'), { type: 'variant', produkt: 'hoejskab-krydsfiner', kuloer: 'blaa' });
  assert.deepEqual(variantFraUrl('?v=hoejskab-krydsfiner~terrakotta%20HPL'), { type: 'variant', produkt: 'hoejskab-krydsfiner', kuloer: 'terrakotta HPL' });
  assert.equal(variantFraUrl('?emne=x'), null);
  assert.equal(variantFraUrl('?v=~blaa'), null);
  assert.equal(variantFraUrl('?v=Hoejskab~blaa'), null);
  assert.equal(variantFraUrl('?v=hoejskab-krydsfiner~'), null);
});

test('typeTilbud: en type uden kulør åbner forsidens formular med typen som emne og uden konfiguration', () => {
  assert.deepEqual(typeTilbud('Garderobeskabe med perforerede låger'), { besked: 'Vedr. Garderobeskabe med perforerede låger', spor: 'skitse' });
});

test('variantTilbud: forsidens besked og konfiguration er de samme som kontaktsidens', () => {
  assert.deepEqual(variantTilbud({ slug: 'hoejskab-krydsfiner', navn: 'Højskab i krydsfiner', kuloer: 'blaa', label: 'Blå' }), {
    besked: 'Vedr. Højskab i krydsfiner, blå',
    spor: 'variant',
    konfiguration: { type: 'variant', produkt: 'hoejskab-krydsfiner', kuloer: 'blaa' },
  });
});
