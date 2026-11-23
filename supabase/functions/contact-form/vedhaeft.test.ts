// node --test supabase/functions/contact-form/vedhaeft.test.ts  (Node 24: TypeScript køres direkte; deno test virker også)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docxXmlTilTekst, kortTekst, odtXmlTilTekst, tekstAf, txtTilTekst, zipFil } from './vedhaeft.ts';

const enc = new TextEncoder();

async function deflateRaw(b: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter();
  w.write(b); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

// En lille zip-skriver til testene: metode 8 (deflate) eller 0 (gemt), uden CRC (læseren tjekker den ikke)
async function zip(filer: Record<string, string>, metode: 0 | 8 = 8): Promise<Uint8Array> {
  const dele: Uint8Array[] = [], central: Uint8Array[] = [];
  let off = 0;
  for (const [navn, indhold] of Object.entries(filer)) {
    const raa = enc.encode(indhold), data = metode === 8 ? await deflateRaw(raa) : raa, fn = enc.encode(navn);
    const lh = new Uint8Array(30 + fn.length), lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, metode, true); lv.setUint32(18, data.length, true); lv.setUint32(22, raa.length, true);
    lv.setUint16(26, fn.length, true); lh.set(fn, 30);
    const ch = new Uint8Array(46 + fn.length), cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, metode, true); cv.setUint32(20, data.length, true); cv.setUint32(24, raa.length, true);
    cv.setUint16(28, fn.length, true); cv.setUint32(42, off, true); ch.set(fn, 46);
    dele.push(lh, data); central.push(ch); off += lh.length + data.length;
  }
  const cdLen = central.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array(22), ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdLen, true); ev.setUint32(16, off, true);
  const alle = [...dele, ...central, eocd], ud = new Uint8Array(alle.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const d of alle) { ud.set(d, o); o += d.length; }
  return ud;
}

const DOCX_XML = '<?xml version="1.0"?><w:document><w:body>' +
  '<w:p><w:r><w:t>Jeg skal bruge 3 garderobeskabe. De skal være 60 i bredde &amp; dybde.</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t xml:space="preserve">1 stk med 6 hylder</w:t></w:r><w:r><w:br/><w:t>og 2 stk med bøjlestang</w:t></w:r></w:p>' +
  '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Bredde</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>60</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
  '</w:body></w:document>';

test('docx: afsnit, linjeskift og entiteter', async () => {
  const z = await zip({ '[Content_Types].xml': '<x/>', 'word/document.xml': DOCX_XML });
  const r = await tekstAf('Garderobeskabe.docx', z);
  assert.ok(r);
  assert.match(r.tekst, /^Jeg skal bruge 3 garderobeskabe\. De skal være 60 i bredde & dybde\.\n1 stk med 6 hylder\nog 2 stk med bøjlestang/);
  assert.match(r.tekst, /Bredde/);
  assert.equal(r.afkortet, false);
});

test('zip: gemt uden komprimering og et medlem, der ikke findes', async () => {
  const z = await zip({ 'word/document.xml': DOCX_XML }, 0);
  assert.ok(await zipFil(z, 'word/document.xml'));
  assert.equal(await zipFil(z, 'content.xml'), null);
  assert.equal(await zipFil(enc.encode('ikke en zip'), 'word/document.xml'), null);
});

test('odt: content.xml', async () => {
  const z = await zip({ mimetype: 'application/vnd.oasis.opendocument.text', 'content.xml': '<office:text><text:h>Ønsker</text:h><text:p>Skab<text:s text:c="2"/>60 × 225</text:p></office:text>' });
  const r = await tekstAf('skab.odt', z);
  assert.equal(r?.tekst, 'Ønsker\nSkab  60 × 225');
});

test('txt og csv: UTF-8, ellers Windows-1252', async () => {
  assert.equal((await tekstAf('noter.txt', enc.encode('﻿Højskab\r\nmed låger')))?.tekst, 'Højskab\nmed låger');
  const cp1252 = new Uint8Array([0x48, 0xf8, 0x6a, 0x73, 0x6b, 0x61, 0x62]); // "Højskab" i Windows-1252
  assert.equal(txtTilTekst(cp1252), 'Højskab');
  assert.equal((await tekstAf('maal.csv', enc.encode('b;h;d\n60;225;60')))?.tekst, 'b;h;d\n60;225;60');
});

test('afkortes ved et ordskifte, og ukendte eller ødelagte filer giver null', async () => {
  const lang = ('ord '.repeat(600)).trim();
  const k = kortTekst(lang, 1500);
  assert.equal(k.afkortet, true);
  assert.ok(k.tekst.length <= 1500 && k.tekst.endsWith('ord'));
  assert.equal(await tekstAf('tegning.pdf', enc.encode('%PDF-1.7')), null);
  assert.equal(await tekstAf('brev.docx', enc.encode('PK ødelagt')), null);
  assert.equal(await tekstAf('tom.txt', enc.encode('   ')), null);
});

test('xml til tekst', () => {
  assert.equal(docxXmlTilTekst('<w:p><w:r><w:t>A</w:t></w:r><w:r><w:tab/><w:t>B &#248; &#xE6;</w:t></w:r></w:p>'), 'A\tB ø æ\n');
  assert.equal(odtXmlTilTekst('<text:p>A<text:line-break/>B</text:p>'), 'A\nB\n');
});
