// node --test src/integrations/skraastreg.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { tilfoejSkraastreg } from './skraastreg.mjs';

const SIDER = new Set(['kontakt', 'inventar', 'lockers', 'projekter', 'projekter/morkhoj-skole']);
const findes = (rel) => SIDER.has(rel);
const k = (html, base) => tilfoejSkraastreg(html, findes, base).html;

test('interne links til sider får skråstreg, også med ankre, query og fuldt domæne', () => {
  assert.equal(k('<a href="/kontakt">'), '<a href="/kontakt/">');
  assert.equal(k('<a href="/kontakt#send">'), '<a href="/kontakt/#send">');
  assert.equal(k('<a href="/inventar?v=x">'), '<a href="/inventar/?v=x">');
  assert.equal(k('<a href="/projekter/morkhoj-skole">'), '<a href="/projekter/morkhoj-skole/">');
  assert.equal(k('<a href="https://neminventar.dk/lockers">'), '<a href="https://neminventar.dk/lockers/">');
  assert.equal(k('<a href="https://www.neminventar.dk/lockers">'), '<a href="https://www.neminventar.dk/lockers/">');
});

test('filer, forsiden, ukendte stier, andre domæner og mailto røres ikke', () => {
  for (const h of ['/', '/kontakt/', '/nem-inventar-brochure.pdf', '/_b/x-w640.webp', '/findes-ikke', '#send',
    'https://designer.neminventar.dk/designer?p=locker', 'https://neminventar.dk.evil.example/kontakt',
    'mailto:tilbud@neminventar.dk', 'tel:+4542422684']) {
    assert.equal(k(`<a href="${h}">`), `<a href="${h}">`, h);
  }
});

test('tæller og respekterer base (GitHub Pages projekt-side)', () => {
  assert.equal(tilfoejSkraastreg('<a href="/kontakt"><a href="/lockers">', findes).n, 2);
  assert.equal(k('<a href="/neminventar-astro/kontakt">', '/neminventar-astro/'), '<a href="/neminventar-astro/kontakt/">');
  assert.equal(k('<a href="/kontakt">', '/neminventar-astro/'), '<a href="/kontakt">');
});
