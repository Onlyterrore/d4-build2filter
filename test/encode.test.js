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
