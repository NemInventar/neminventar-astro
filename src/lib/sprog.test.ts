import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sprogLink } from './sprog.ts';

const par = [
  { hreflang: 'da', href: 'https://neminventar.dk/garderobeskab/' },
  { hreflang: 'en', href: 'https://neminventar.dk/en/wardrobes/' },
];

test('sproget findes på siden: samme side på det andet sprog', () => {
  assert.equal(sprogLink('/', 'en', par), '/en/wardrobes/');
  assert.equal(sprogLink('/', 'da', par), '/garderobeskab/');
});

test('siden findes ikke på sproget: sprogets forside', () => {
  assert.equal(sprogLink('/', 'de', par), '/de/');
  assert.equal(sprogLink('/', 'en', []), '/en/');
  assert.equal(sprogLink('/', 'da'), '/');
});

test('kun stien, så forhåndsvisningen bliver på sit eget domæne', () => {
  assert.equal(sprogLink('/', 'en', [{ hreflang: 'en', href: 'https://neminventar.dk/en/contact/' }]), '/en/contact/');
});
