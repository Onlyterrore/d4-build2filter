import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBuildRef } from '../src/resolve.js';

const map = { 'blazing-scream-warlock-leveling': '87dc0249-02db-4eb0-b9fc-c2acfb012fa6' };

test('берёт идентификатор прямо из адреса', () => {
  const r = resolveBuildRef('https://d4builds.gg/builds/87dc0249-02db-4eb0-b9fc-c2acfb012fa6/', map);
  assert.deepEqual(r, { ok: true, id: '87dc0249-02db-4eb0-b9fc-c2acfb012fa6', via: 'url' });
});

test('находит короткий адрес в карте, хвост запроса не мешает', () => {
  const r = resolveBuildRef('https://d4builds.gg/builds/blazing-scream-warlock-leveling/?var=0', map);
  assert.deepEqual(r, { ok: true, id: '87dc0249-02db-4eb0-b9fc-c2acfb012fa6', via: 'map' });
});

test('неизвестный короткий адрес — понятная причина', () => {
  const r = resolveBuildRef('https://d4builds.gg/builds/something-new/', map);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'slug-not-in-map');
  assert.equal(r.slug, 'something-new');
});

test('чужой сайт отвергается', () => {
  assert.equal(resolveBuildRef('https://maxroll.gg/d4/build-guides/x', map).reason, 'not-d4builds');
});

test('мусор вместо ссылки отвергается', () => {
  assert.equal(resolveBuildRef('просто текст', map).reason, 'not-a-url');
});
