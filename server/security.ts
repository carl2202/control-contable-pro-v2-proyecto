import crypto from 'node:crypto';

const SCRYPT_PREFIX = 'scrypt$';
const LEGACY_SCRYPT_PREFIX = 'scrypt-legacy$';
const PIN_LOOKUP_SECRET = process.env.PIN_LOOKUP_SECRET
  || process.env.SESSION_SECRET
  || 'ccp-local-pin-lookup-key';

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

async function derive(value: string, salt: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(value, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashCredential(value: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await derive(value, salt);
  return `${SCRYPT_PREFIX}${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyCredential(value: string, stored: string): Promise<boolean> {
  if (stored.startsWith(SCRYPT_PREFIX)) {
    const [, saltHex, expected] = stored.split('$');
    if (!saltHex || !/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(expected || '')) {
      return false;
    }
    const actual = await derive(value, Buffer.from(saltHex, 'hex'));
    return safeEqual(actual.toString('hex'), expected);
  }

  if (stored.startsWith(LEGACY_SCRYPT_PREFIX)) {
    const [, kind, saltHex, expected] = stored.split('$');
    if ((kind !== 'plain' && kind !== 'sha256')
      || !/^[a-f0-9]{32}$/i.test(saltHex || '')
      || !/^[a-f0-9]{128}$/i.test(expected || '')) {
      return false;
    }
    const legacyValue = kind === 'sha256'
      ? crypto.createHash('sha256').update(value).digest('hex')
      : value;
    const actual = await derive(legacyValue, Buffer.from(saltHex, 'hex'));
    return safeEqual(actual.toString('hex'), expected);
  }

  const legacyHash = crypto.createHash('sha256').update(value).digest('hex');
  return safeEqual(stored, value) || safeEqual(stored.toLowerCase(), legacyHash);
}

export function isProtectedCredential(stored: string): boolean {
  return stored.startsWith(SCRYPT_PREFIX) || stored.startsWith(LEGACY_SCRYPT_PREFIX);
}

export function isStrongCredential(stored: string): boolean {
  return stored.startsWith(SCRYPT_PREFIX);
}

export function pinLookup(pin: string): string {
  return crypto.createHmac('sha256', PIN_LOOKUP_SECRET).update(pin).digest('hex');
}

export async function protectLegacyPassword(stored: string): Promise<string> {
  const isSha256 = /^[a-f0-9]{64}$/i.test(stored);
  const kind = isSha256 ? 'sha256' : 'plain';
  const value = isSha256 ? stored.toLowerCase() : stored;
  const salt = crypto.randomBytes(16);
  const derived = await derive(value, salt);
  return `${LEGACY_SCRYPT_PREFIX}${kind}$${salt.toString('hex')}$${derived.toString('hex')}`;
}
