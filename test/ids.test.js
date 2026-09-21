import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeLookup } from '../src/ids.js';
import { decodeFilter } from '../src/decode.js';
import { COND } from '../src/constants.js';

const rows = [
  { name: 'Critical Strike Chance', id: 111, source: 'game-export', verified: '2026-09-21' },
  { name: 'Resistance to All Elements', id: 222, source: 'community-s13' },
];

test('находит по точному названию', () => {
  assert.deepEqual(makeLookup(rows)('Critical Strike Chance'),
    { id: 111, source: 'game-export', verified: '2026-09-21' });
});

test('регистр и лишние пробелы не мешают', () => {
  // d4builds пишет одно и то же свойство то с большой, то с маленькой буквы:
  // в документе билда "Resistance to All Elements", на странице "Resistance To All Elements".
  assert.equal(makeLookup(rows)('  Resistance To All Elements ').id, 222);
});

test('неизвестное название даёт null, а не выдуманный id', () => {
  assert.equal(makeLookup(rows)('Что-то Неизвестное'), null);
});

test('группы типов совпадают с эталонным фильтром, а не переписаны руками', () => {
  // Числа в data/type-ids.json однажды были вписаны глазами и разошлись с
  // эталоном. Этот тест сверяет таблицу с самим эталоном, чтобы такое
  // больше не прошло незамеченным.
  const table = JSON.parse(readFileSync(new URL('../data/type-ids.json', import.meta.url), 'utf8'));
  const code = readFileSync(new URL('./fixtures/maxroll-light.txt', import.meta.url), 'utf8');
  const f = decodeFilter(code);
  const typeSets = f.rules
    .map(r => r.conditions.find(c => c.type === COND.ITEM_TYPE_MATCH))
    .filter(Boolean)
    .map(c => c.params);

  const big = typeSets.find(s => s.length === 27);
  const small = typeSets.find(s => s.length === 2);
  assert.deepEqual(table.groups.allExceptTalismans.ids, big);
  assert.deepEqual(table.groups.talismans.ids, small);
});
