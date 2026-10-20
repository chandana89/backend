import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const PREFIX = 'scrypt$';
const KEY_LENGTH = 64;

/** Hashes a password as `scrypt$<salt>$<hash>` (both base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `${PREFIX}${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** True if `stored` is a hash from `hashPassword` rather than a legacy plain-text password. */
export function isHashed(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

/**
 * Checks `password` against a stored value. Legacy plain-text values are still accepted
 * (compared in constant time) so existing users can sign in and be upgraded to a hash.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isHashed(stored)) return safeEqual(Buffer.from(password), Buffer.from(stored));

  const [salt, hash] = stored.slice(PREFIX.length).split('$');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
  return safeEqual(actual, expected);
}

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}
