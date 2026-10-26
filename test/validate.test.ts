import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHex, parseNumber } from '../ui/validate.js';

test('hex: 3 and 6 digits, with or without #, any case', () => {
  assert.equal(normalizeHex('f24'), '#ff2244');
  assert.equal(normalizeHex('#F24'), '#ff2244');
  assert.equal(normalizeHex(' #00AA88 '), '#00aa88');
  assert.equal(normalizeHex('00aa88cc'), '#00aa88'); // alpha dropped (alpha="false")
});

test('hex: rejects everything else', () => {
  for (const bad of ['', '#', '12345', 'zzz', '#ggg', '1234567', null, undefined]) assert.equal(normalizeHex(bad), null, String(bad));
});

test('numbers: empty/invalid → null, negatives and overflow clamped', () => {
  assert.equal(parseNumber('', 0, 10), null);
  assert.equal(parseNumber('abc', 0, 10), null);
  assert.equal(parseNumber('-8', 0, 100), 0);
  assert.equal(parseNumber('3,5', 0.5, 24), 3.5);
  assert.equal(parseNumber('999', 6, 96), 96);
  assert.equal(parseNumber(12, 0, 200), 12);
});
