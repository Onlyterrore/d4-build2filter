import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeFilter } from '../src/decode.js';
import { VISIBILITY, COND, RARITY, PROPERTY } from '../src/constants.js';

const code = readFileSync(new URL('./fixtures/maxroll-light.txt', import.meta.url), 'utf8').trim();

test('разбирает чужой рабочий код', () => {
  const f = decodeFilter(code);
  assert.equal(f.name, 'Maxroll Light');
  assert.ok(f.rules.length >= 7, `правил ${f.rules.length}, ожидалось не меньше 7`);
});

test('первое правило — перекраска мификов', () => {
  const r = decodeFilter(code).rules[0];
  assert.equal(r.name, 'mythics');
  assert.equal(r.visibility, VISIBILITY.RECOLOR);
  assert.equal(r.enabled, true);
  const props = r.conditions.find(c => c.type === COND.ITEM_PROPERTIES);
  assert.equal(props.value1, PROPERTY.MYTHIC);
  const rarity = r.conditions.find(c => c.type === COND.ITEM_RARITY_MATCH);
  assert.equal(rarity.value1, RARITY.UNIQUE | RARITY.MYTHIC);
});

test('правило про белое и синее прячет и ограничивает силу предмета', () => {
  const r = decodeFilter(code).rules.find(x => x.name.includes('white/blue'));
  assert.equal(r.visibility, VISIBILITY.HIDE_ALL);
  const rarity = r.conditions.find(c => c.type === COND.ITEM_RARITY_MATCH);
  assert.equal(rarity.value1, RARITY.COMMON | RARITY.MAGIC);
  // 851 — факт про этот конкретный эталон. Сам эталон непоследователен:
  // в двух других его правилах стоит 850. Замер 2026-09-21.
  const power = r.conditions.find(c => c.type === COND.ITEM_POWER_RANGE);
  assert.equal(power.value2, 851);
});

test('условие "апгрейд кодекса" несёт флаг в value3', () => {
  const r = decodeFilter(code).rules.find(x => x.name.includes('codex'));
  const c = r.conditions.find(x => x.type === COND.CODEX_UPGRADE_CHECK);
  assert.equal(c.value3, 1);
  assert.equal(c.value1, 0);
});

test('хвостовые поля сохраняются, а не подменяются тройками', () => {
  const f = decodeFilter(code);
  assert.equal(f.meta3, 5);
  assert.equal(f.meta4, 1);
});
