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

test('синоним находит ту же запись', () => {
  const withAlias = [{ name: 'All Damage Multiplier', id: 999, source: 'game-export',
    aliases: ['All Damage Multipler'] }];
  const lookup = makeLookup(withAlias);
  assert.equal(lookup('All Damage Multiplier').id, 999);
  assert.equal(lookup('All Damage Multipler').id, 999, 'опечатка d4builds должна находиться');
});

test('все аффиксы билда владельца переводятся', () => {
  const table = JSON.parse(readFileSync(new URL('../data/affix-ids.json', import.meta.url), 'utf8'));
  const lookup = makeLookup(table.affixes);
  const fromBuild = [
    'Willpower', 'Maximum Life', 'Maximum Resource', 'Cooldown Reduction', 'Wrath Regeneration',
    'Critical Strike Chance', 'Critical Strike Damage Multiplier', 'Attack Speed',
    'Resistance to All Elements', 'Movement Speed', 'All Damage Multipler',
  ];
  for (const name of fromBuild) {
    assert.ok(lookup(name), `не найдено: ${name}`);
    assert.equal(lookup(name).source, 'game-export', `${name} должен быть подтверждён игрой`);
  }
});

test('все типы вещей билда владельца переводятся', () => {
  const table = JSON.parse(readFileSync(new URL('../data/type-ids.json', import.meta.url), 'utf8'));
  const lookup = makeLookup(table.types);
  // Ключи ровно те, что кладёт profile.js в поле itemType.
  for (const key of ['helm', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring', 'offhand']) {
    assert.ok(lookup(key), `не найден тип: ${key}`);
    assert.equal(lookup(key).source, 'game-export', `${key} должен быть подтверждён игрой`);
  }
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
