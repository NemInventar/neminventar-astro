// `npm run test:konto-udgiv` — porten før kunder ser konto-fladen: fejler, så længe en tekst er TODO-TEKST
// (kontrakter.md §0). Den almindelige `npm run test:konto-site` melder dem kun som TODO, så den kan køre grønt undervejs.
import { readFileSync } from 'node:fs';
import { MANGLER as KERNEN } from '../vendor/webordre/tilstand.mjs';

const laes = (f) => JSON.parse(readFileSync(new URL(`../tekster/${f}`, import.meta.url), 'utf8'));
const todo = [];
for (const [sp, f] of [['da', 'da.json'], ['en', 'en.json'], ['da', 'ordre.da.json']]) {
  for (const [k, v] of Object.entries(laes(f))) if (String(v).includes('TODO-TEKST')) todo.push(`${sp}:${k}`);
}
const kernen = Object.values(KERNEN).flat();
if (todo.length || kernen.length) {
  console.error(`Konto-fladen er ikke klar til kunder: ${todo.length} tekster i kataloget og ${kernen.length} i kernen mangler fra Fable.`);
  for (const k of todo) console.error(`  katalog  ${k}`);
  for (const k of kernen) console.error(`  kernen   ${k}`);
  console.error('Se konto/tekster/mangler.json.');
  process.exit(1);
}
console.log('Alle tekster er skrevet.');
