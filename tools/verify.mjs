// Пересобирает код фильтра из живого билда и сравнивает с файлом,
// в который положен текст из буфера обмена. Никакого переписывания руками.
import { readFileSync } from 'node:fs';

const ROOT = 'C:/Users/dased/OneDrive/Документы/Claude/Projects/Other/d4-build2filter';
const { firestoreToProfile } = await import(`file:///${ROOT}/src/profile.js`);
const { makeLookup } = await import(`file:///${ROOT}/src/ids.js`);
const { buildFilter } = await import(`file:///${ROOT}/src/rules.js`);
const { encodeFilter } = await import(`file:///${ROOT}/src/encode.js`);
const { decodeFilter } = await import(`file:///${ROOT}/src/decode.js`);

const ID = '87dc0249-02db-4eb0-b9fc-c2acfb012fa6';
const DB = 'https://firestore.googleapis.com/v1/projects/d4builds-a3254/databases/(default)/documents/builds/';

const doc = await fetch(DB + ID).then(r => r.json());
const profile = firestoreToProfile(doc, ID);
const affixTable = JSON.parse(readFileSync(`${ROOT}/data/affix-ids.json`, 'utf8'));
const typeTable = JSON.parse(readFileSync(`${ROOT}/data/type-ids.json`, 'utf8'));

const { filter } = buildFilter(profile, {
  affixLookup: makeLookup(affixTable.affixes),
  typeLookup: makeLookup(typeTable.types),
  typeGroups: typeTable.groups,
  tier: 'light',
  threshold: 2,
});
const expected = encodeFilter(filter);
const actual = readFileSync(process.argv[2], 'utf8').trim();

console.log('ожидали длину :', expected.length);
console.log('в файле длина :', actual.length);
console.log('СОВПАДАЕТ     :', expected === actual);

if (expected !== actual) {
  const a = decodeFilter(expected), b = decodeFilter(actual);
  console.log('');
  console.log('имя фильтра   :', JSON.stringify(a.name), 'vs', JSON.stringify(b.name));
  console.log('правил        :', a.rules.length, 'vs', b.rules.length);
  console.log('meta          :', a.meta3, a.meta4, 'vs', b.meta3, b.meta4);
  const n = Math.max(a.rules.length, b.rules.length);
  for (let i = 0; i < n; i++) {
    const x = a.rules[i], y = b.rules[i];
    const same = JSON.stringify(x) === JSON.stringify(y);
    if (!same) {
      console.log(`  правило ${i}: РАСХОЖДЕНИЕ`);
      console.log('    ожидали:', JSON.stringify(x)?.slice(0, 220));
      console.log('    в файле:', JSON.stringify(y)?.slice(0, 220));
    }
  }
}
