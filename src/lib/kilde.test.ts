// node --test src/lib/kilde.test.ts  (Node 24: TypeScript køres direkte)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foersteBesoeg, mailtoMedEmne, KILDE_SVAR } from './kilde.ts';

function lager() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

test('ekstern referrer gemmes som hostname, og første besøg vinder', () => {
  const ss = lager();
  const a = foersteBesoeg({ referrer: 'https://chatgpt.com/c/abc?x=1', href: 'https://neminventar.dk/toiletbaase/?utm_source=chatgpt.com', host: 'neminventar.dk' }, ss);
  assert.deepEqual(a, { referrer_host: 'chatgpt.com', landingsside: '/toiletbaase/', utm: { utm_source: 'chatgpt.com' } });
  const b = foersteBesoeg({ referrer: 'https://neminventar.dk/', href: 'https://neminventar.dk/kontakt/', host: 'neminventar.dk' }, ss);
  assert.equal(b.referrer_host, 'chatgpt.com');
  assert.equal(b.landingsside, '/toiletbaase/');
});

test('intern referrer giver tom kilde', () => {
  const a = foersteBesoeg({ referrer: 'https://neminventar.dk/lockers/', href: 'https://neminventar.dk/kontakt/', host: 'neminventar.dk' }, lager());
  assert.equal(a.referrer_host, '');
  assert.equal(a.landingsside, '/kontakt/');
});

test('virker uden storage (privat vindue)', () => {
  const ss = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const a = foersteBesoeg({ referrer: '', href: 'https://neminventar.dk/', host: 'neminventar.dk' }, ss);
  assert.deepEqual(a, { referrer_host: '', landingsside: '/', utm: {} });
});

test('mailto får emne, eksisterende emne bevares', () => {
  assert.equal(mailtoMedEmne('mailto:tilbud@neminventar.dk', 'Lockers'),
    'mailto:tilbud@neminventar.dk?subject=' + encodeURIComponent('Forespørgsel fra neminventar.dk – Lockers'));
  assert.equal(mailtoMedEmne('mailto:a@b.dk?subject=Hej', 'X'), 'mailto:a@b.dk?subject=Hej');
  assert.equal(mailtoMedEmne('mailto:a@b.dk?cc=c@d.dk', 'X'), 'mailto:a@b.dk?cc=c@d.dk&subject=' + encodeURIComponent('Forespørgsel fra neminventar.dk – X'));
});

test('svarmulighederne er de seks fra spec §4', () => {
  assert.deepEqual([...KILDE_SVAR], ['Google', 'ChatGPT eller anden AI', 'Anbefaling', 'LinkedIn', 'Vi har arbejdet sammen før', 'Andet']);
});
