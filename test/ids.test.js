import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeLookup } from '../src/ids.js';

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

test('таблица типов несёт готовые группы из эталона', () => {
  const table = JSON.parse(readFileSync(new URL('../data/type-ids.json', import.meta.url), 'utf8'));
  assert.equal(table.groups.allExceptTalismans.ids.length, 27);
  assert.equal(table.groups.talismans.ids.length, 2);
});
