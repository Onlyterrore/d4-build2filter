import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeFilter } from '../src/decode.js';
import { encodeFilter } from '../src/encode.js';
import { VISIBILITY, COND, RARITY } from '../src/constants.js';

const code = readFileSync(new URL('./fixtures/maxroll-light.txt', import.meta.url), 'utf8').trim();

test('круг: разобрал чужой код, закодировал, разобрал снова — совпало', () => {
  const original = decodeFilter(code);
  const again = decodeFilter(encodeFilter(original));
  assert.deepEqual(again, original);
});

// Самый сильный тест проекта. Круг выше проходит, даже если обе стороны
// одинаково не знают про какое-то поле, — так мы дважды теряли данные
// (хвостовые поля фильтра и value3 у условия). Побайтовое совпадение с
// экспортом из игры таких потерь не прощает.
test('пересборка чужого кода совпадает с ним побайтово', () => {
  assert.equal(encodeFilter(decodeFilter(code)), code);
});

// Второй эталон — экспорт прямо из игры, сделанный владельцем 2026-09-21.
// Он покрывает то, чего нет в первом: безымянное правило (игра тогда вовсе
// не пишет поле имени) и условие HAS_OPTIONAL_AFFIXES.
const fromGame = readFileSync(
  new URL('./fixtures/game-export-crit-chance.txt', import.meta.url), 'utf8').trim();

test('экспорт из игры пересобирается побайтово', () => {
  assert.equal(encodeFilter(decodeFilter(fromGame)), fromGame);
});

test('безымянное правило и условие на аффикс разобраны верно', () => {
  const f = decodeFilter(fromGame);
  assert.equal(f.rules.length, 1);
  assert.equal(f.rules[0].name, '');
  const c = f.rules[0].conditions[0];
  assert.equal(c.type, COND.HAS_OPTIONAL_AFFIXES);
  assert.deepEqual(c.params, [1829582]);
  assert.equal(c.value1, 1);
});

test('кодирует правило, собранное с нуля', () => {
  const filter = {
    name: 'Проверка',
    meta3: 3,
    meta4: 3,
    rules: [{
      name: 'кольца билда',
      visibility: VISIBILITY.RECOLOR,
      color: 0xffff8c1a,
      enabled: true,
      conditions: [
        { type: COND.ITEM_RARITY_MATCH, params: [], value1: RARITY.LEGENDARY, value2: 0, value3: 0 },
        { type: COND.HAS_REQUIRED_AFFIXES, params: [2620563, 1234567], value1: 2, value2: 0, value3: 0 },
      ],
    }],
  };
  assert.deepEqual(decodeFilter(encodeFilter(filter)), filter);
});
