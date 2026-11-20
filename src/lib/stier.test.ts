import { test } from 'node:test';
import assert from 'node:assert/strict';
import { side, kontaktMedEmne, typeSti, sagSti, landingSti, designerSprog } from './stier.ts';

test('de danske adresser er de samme som før (uden afsluttende skråstreg, som skraastreg.mjs retter)', () => {
  assert.equal(side('da', 'kontakt'), 'kontakt');
  assert.equal(side('da', 'inventar'), 'inventar');
  assert.equal(side('da', 'forside'), '');
  assert.equal(typeSti('da', 'hoejskab-krydsfiner', 'plywood-tall-cabinet'), 'produkter/hoejskab-krydsfiner');
  assert.equal(sagSti('da', 'hou-skole', 'hou-school'), 'projekter/hou-skole');
  assert.equal(landingSti('da', 'kompaktlaminat', 'compact-laminate'), 'kompaktlaminat');
  assert.equal(kontaktMedEmne('da', 'Lignende projekt: Hou Skole'), 'kontakt?emne=Lignende%20projekt%3A%20Hou%20Skole');
});

test('engelsk: den engelske side, når den findes, ellers den danske', () => {
  assert.equal(side('en', 'kontakt'), 'en/contact/');
  assert.equal(side('en', 'omOs'), 'en/about/');
  assert.equal(typeSti('en', 'hoejskab-krydsfiner', 'plywood-tall-cabinet'), 'en/products/plywood-tall-cabinet/');
  assert.equal(typeSti('en', 'ny-type', null), 'produkter/ny-type');
  assert.equal(landingSti('en', 'kompaktlaminat', 'compact-laminate'), 'en/compact-laminate/');
  assert.equal(kontaktMedEmne('en', 'Wardrobes'), 'en/contact/?emne=Wardrobes');
});

test('designeren åbner på engelsk fra en engelsk side, og kun én gang', () => {
  const d = 'https://designer.neminventar.dk/designer.html?p=hoejskab';
  assert.equal(designerSprog(d, 'da'), d);
  assert.equal(designerSprog(d, 'en'), d + '&lang=en');
  assert.equal(designerSprog(d + '&lang=en', 'en'), d + '&lang=en');
  assert.equal(designerSprog('https://designer.neminventar.dk/designer.html', 'en'), 'https://designer.neminventar.dk/designer.html?lang=en');
});
