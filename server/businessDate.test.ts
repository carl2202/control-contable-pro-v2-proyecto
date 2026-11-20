import assert from 'node:assert/strict';
import test from 'node:test';
import { getBusinessDate } from './businessDate.js';

test('business date follows El Salvador time instead of UTC', () => {
  assert.equal(getBusinessDate(new Date('2026-02-20T03:00:00.000Z')), '2026-02-19');
});
