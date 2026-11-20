import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  hashCredential,
  isStrongCredential,
  pinLookup,
  protectLegacyPassword,
  verifyCredential,
} from './security.js';

test('new credentials use salted scrypt and verify only the matching secret', async () => {
  const encoded = await hashCredential('123456');
  assert.ok(isStrongCredential(encoded));
  assert.notEqual(encoded, await hashCredential('123456'));
  assert.equal(await verifyCredential('123456', encoded), true);
  assert.equal(await verifyCredential('654321', encoded), false);
});

test('legacy plaintext and SHA-256 credentials can be protected and verified', async () => {
  const legacyPassword = 'old-password';
  const legacyHash = crypto.createHash('sha256').update(legacyPassword).digest('hex');
  const protectedPlain = await protectLegacyPassword(legacyPassword);
  const protectedHash = await protectLegacyPassword(legacyHash);

  assert.equal(await verifyCredential(legacyPassword, protectedPlain), true);
  assert.equal(await verifyCredential(legacyPassword, protectedHash), true);
  assert.equal(await verifyCredential('wrong-password', protectedHash), false);
  assert.equal(protectedHash.includes(legacyHash), false);
});

test('PIN lookup is stable, fixed-size, and distinct for different PINs', () => {
  const first = pinLookup('1234');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(pinLookup('1234'), first);
  assert.notEqual(pinLookup('4321'), first);
  assert.notEqual(first, '1234');
});
