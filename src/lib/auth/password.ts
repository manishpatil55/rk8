import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for the DEV seeded-admin fallback only — production logins
 * are OAuth and store no password. Uses Node's built-in scrypt (no native
 * dependency, no build step). Format: scrypt$<saltHex>$<hashHex>.
 */
const N = 16384; // CPU/memory cost
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
    N,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
