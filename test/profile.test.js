import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firestoreToProfile } from '../src/profile.js';

const doc = JSON.parse(
  readFileSync(new URL('./fixtures/build-blazing-scream.json', import.meta.url), 'utf8')
);

test('снимает шапку билда', () => {
  const p = firestoreToProfile(doc, '87dc0249-02db-4eb0-b9fc-c2acfb012fa6');
  assert.equal(p.schema, 1);
  assert.equal(p.class, 'Warlock');
  assert.equal(p.season, 15);
  assert.equal(p.name, 'Blazing Scream Warlock Leveling (S15)');
  assert.equal(p.buildId, '87dc0249-02db-4eb0-b9fc-c2acfb012fa6');
});

test('кольцо приходит без пустых мест и с типом вещи', () => {
  const p = firestoreToProfile(doc, 'x');
  const ring = p.slots.find(s => s.slot === 'Ring 1');
  assert.equal(ring.itemType, 'ring');
  assert.deepEqual(ring.affixes, [
    'Willpower', 'Maximum Life', 'Critical Strike Chance', 'Critical Strike Damage Multiplier',
  ]);
  assert.equal(ring.aspect, 'Aspect of Peril');
});

test('закалка снимается, хотя в фильтр не пойдёт', () => {
  const p = firestoreToProfile(doc, 'x');
  // Ring 2, а не Offhand: у Offhand в этом билде не заполнено ни одного
  // свойства, поэтому слот законно выброшен вместе со своей закалкой.
  const ring = p.slots.find(s => s.slot === 'Ring 2');
  assert.deepEqual(ring.tempering, ['Shadow Damage (Elemental Finesse: Night - Offensive)']);
});

test('слоты без свойств выброшены', () => {
  const p = firestoreToProfile(doc, 'x');
  assert.equal(p.slots.some(s => s.slot === 'Weapon'), false);
  assert.ok(p.slots.length >= 8, `слотов ${p.slots.length}`);
});
