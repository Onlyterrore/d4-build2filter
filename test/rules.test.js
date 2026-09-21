import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFilter } from '../src/rules.js';
import { VISIBILITY, COND, RARITY } from '../src/constants.js';

const profile = {
  name: 'Проверочный билд',
  slots: [
    { slot: 'Ring 1', itemType: 'ring', affixes: ['Critical Strike Chance', 'Willpower'] },
    { slot: 'Ring 2', itemType: 'ring', affixes: ['Critical Strike Chance', 'Willpower'] },
    { slot: 'Helm', itemType: 'helm', affixes: ['Maximum Life', 'Неизвестное Свойство'] },
  ],
};

const affixLookup = name => ({
  'Critical Strike Chance': { id: 111, source: 'game-export' },
  'Willpower': { id: 222, source: 'community-s13' },
  'Maximum Life': { id: 333, source: 'game-export' },
}[name] ?? null);

const typeLookup = name => ({ ring: { id: 900, source: 'game-export' } }[name] ?? null);

const typeGroups = {
  allExceptTalismans: { ids: [1, 2, 3] },
  talismans: { ids: [4, 5] },
};

const opts = { affixLookup, typeLookup, typeGroups, tier: 'light', threshold: 2 };

test('непереведённое выходит наружу, а не пропадает', () => {
  const r = buildFilter(profile, opts);
  assert.deepEqual(r.untranslated.affixes, ['Неизвестное Свойство']);
  assert.deepEqual(r.untranslated.types, ['helm']);
});

test('одинаковые кольца склеены в одно правило', () => {
  const r = buildFilter(profile, opts);
  const ringRules = r.filter.rules.filter(x => x.name.includes('Ring'));
  assert.equal(ringRules.length, 1);
  assert.equal(ringRules[0].name, 'Проверочный билд · Ring 1, Ring 2');
});

test('у слота с неподтверждённым типом условие о типе выброшено', () => {
  const r = buildFilter(profile, opts);
  const helm = r.filter.rules.find(x => x.name.includes('Helm'));
  assert.equal(helm.conditions.some(c => c.type === COND.ITEM_TYPE_MATCH), false);
  assert.equal(helm.conditions.find(c => c.type === COND.HAS_OPTIONAL_AFFIXES).params.length, 1);
});

test('порог совпадения попадает в правило и не превышает числа свойств', () => {
  const r = buildFilter(profile, opts);
  const ring = r.filter.rules.find(x => x.name.includes('Ring'));
  assert.equal(ring.conditions.find(c => c.type === COND.HAS_OPTIONAL_AFFIXES).value1, 2);
  const helm = r.filter.rules.find(x => x.name.includes('Helm'));
  assert.equal(helm.conditions.find(c => c.type === COND.HAS_OPTIONAL_AFFIXES).value1, 1);
});

test('прятки есть и ни в одном нет условия про аффиксы', () => {
  const r = buildFilter(profile, opts);
  const hides = r.filter.rules.filter(x => x.visibility === VISIBILITY.HIDE_ALL);
  assert.ok(hides.length >= 2, `правил пряток ${hides.length}`);
  for (const h of hides) {
    assert.equal(h.conditions.some(c =>
      c.type === COND.HAS_REQUIRED_AFFIXES || c.type === COND.HAS_OPTIONAL_AFFIXES), false);
    assert.ok(h.conditions.some(c => c.type === COND.ITEM_TYPE_MATCH),
      'прятки обязаны ограничивать тип вещи, иначе заденут талисманы');
  }
});

test('строгий уровень прячет больше мягкого', () => {
  const light = buildFilter(profile, { ...opts, tier: 'light' });
  const strict = buildFilter(profile, { ...opts, tier: 'strict' });
  const count = r => r.filter.rules.filter(x => x.visibility === VISIBILITY.HIDE_ALL).length;
  assert.ok(count(strict) > count(light));
});

test('база на месте: мифики, древние уникумы, кодекс через value3', () => {
  const r = buildFilter(profile, opts);
  const codex = r.filter.rules.find(x =>
    x.conditions.some(c => c.type === COND.CODEX_UPGRADE_CHECK));
  assert.equal(codex.conditions[0].value3, 1);
  assert.ok(r.filter.rules.some(x => x.visibility === VISIBILITY.SHOW));
  assert.ok(r.filter.rules.some(x =>
    x.conditions.some(c => c.type === COND.ITEM_RARITY_MATCH
      && c.value1 === (RARITY.UNIQUE | RARITY.MYTHIC))));
});
