import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVarint, writeVarint, bytesToB64, b64ToBytes } from '../src/wire.js';

test('varint туда и обратно', () => {
  for (const n of [0, 1, 127, 128, 300, 850, 2620563]) {
    const bytes = new Uint8Array(writeVarint(n));
    const [value, pos] = readVarint(bytes, 0);
    assert.equal(value, n);
    assert.equal(pos, bytes.length);
  }
});

test('base64 туда и обратно', () => {
  const src = new Uint8Array([0, 1, 250, 128, 64, 255]);
  assert.deepEqual(b64ToBytes(bytesToB64(src)), src);
});
