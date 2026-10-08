// node --test supabase/functions/contact-form/lead.test.ts  (Node 24: TypeScript køres direkte)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapKanal, byggLead, erMistaenkelig, kanalFraHost } from './lead.ts';

const CHECK = ['ChatGPT/AI', 'Google', 'Bing', 'Byggefakta', 'Opsøgende', 'Anbefaling', 'Relation', 'Opfordret', 'LinkedIn', 'Andet', 'Ukendt'];

test('kilde_svar vinder over referrer', () => {
  assert.equal(mapKanal('Google', 'chatgpt.com'), 'Google');
  assert.equal(mapKanal('ChatGPT eller anden AI', ''), 'ChatGPT/AI');
  assert.equal(mapKanal('Anbefaling', ''), 'Anbefaling');
  assert.equal(mapKanal('LinkedIn', ''), 'LinkedIn');
  assert.equal(mapKanal('Vi har arbejdet sammen før', ''), 'Relation');
  assert.equal(mapKanal('Andet', ''), 'Andet');
});

test('uden svar bruges referrer, og ukendte værdier bliver Ukendt', () => {
  assert.equal(mapKanal('', 'chatgpt.com'), 'ChatGPT/AI');
  assert.equal(mapKanal('', 'www.google.dk'), 'Google');
  assert.equal(mapKanal('', 'www.bing.com'), 'Bing');
  assert.equal(mapKanal('', 'dk.linkedin.com'), 'LinkedIn');
  assert.equal(mapKanal('', 'krak.dk'), 'Ukendt');
  assert.equal(mapKanal('', ''), 'Ukendt');
  assert.equal(mapKanal('<script>', 'krak.dk'), 'Ukendt');
});

test('alle mapninger overholder CHECK-reglen', () => {
  for (const s of ['Google', 'ChatGPT eller anden AI', 'Anbefaling', 'LinkedIn', 'Vi har arbejdet sammen før', 'Andet', '', 'x'])
    for (const h of ['chatgpt.com', 'google.com', 'bing.com', 'linkedin.com', 'krak.dk', ''])
      assert.ok(CHECK.includes(mapKanal(s, h)), `${s} / ${h}`);
  assert.ok(CHECK.includes(kanalFraHost('perplexity.ai')));
});

test('lead-rækken overholder CHECK-reglerne og bærer kilden', () => {
  const r = byggLead({ name: 'Asmus', company: 'JVST', email: 'a@jvst.dk', phone: '', message: 'Toiletbåse til en pub', side: '/kontakt/', spor: 'besked', kanal: 'ChatGPT/AI', landingsside: '/toiletbaase/', referrer_host: 'chatgpt.com', filer: 2 });
  assert.equal(r.pipeline_stage, 'lead');
  assert.equal(r.created_by, 'claude_auto');
  assert.equal(r.assigned_to, 'milot');
  assert.equal(r.source_channel, 'Hjemmeside: formular');
  assert.equal(r.lead_kanal, 'ChatGPT/AI');
  assert.equal(r.title, 'Web: JVST');
  assert.equal(r.primary_contact_phone, null);
  assert.match(r.contact_info, /a@jvst\.dk/);
  assert.match(r.description, /Landingsside: neminventar\.dk\/toiletbaase\//);
  assert.match(r.description, /Spor: besked · 2 fil\(er\)/);
  assert.deepEqual(r.tags, ['hjemmeside', 'formular', 'besked']);
});

test('privatkunde får navnet i titlen', () => {
  const r = byggLead({ name: 'Mette', company: 'Privatkunde', email: 'm@x.dk', phone: '12345678', message: 'Garderobe', side: '/', spor: 'skitse', kanal: 'Google', landingsside: '/', referrer_host: 'google.com', filer: 0 });
  assert.equal(r.title, 'Web: Mette');
  assert.equal(r.primary_contact_phone, '12345678');
});

test('mistanke: for hurtig udfyldning eller mange links', () => {
  assert.equal(erMistaenkelig({ ms: 1200, message: 'hej' }), true);
  assert.equal(erMistaenkelig({ ms: 9000, message: 'se http://a.ru http://b.ru https://c.ru http://d.ru http://e.ru http://f.ru' }), true);
  // tre links til udbudsmaterialet er en rigtig kunde, ikke spam (v9)
  assert.equal(erMistaenkelig({ ms: 9000, message: 'Tegninger: https://dalux.com/x https://ibinder.com/y https://byggefakta.dk/z' }), false);
  assert.equal(erMistaenkelig({ ms: 9000, message: 'Vi skal bruge 12 lockers' }), false);
  assert.equal(erMistaenkelig({ ms: undefined, message: 'gammelt v5-kald' }), false);
});
