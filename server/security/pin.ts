import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 32;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${scryptSync(pin, salt, KEYLEN).toString("base64url")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(pin, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(expected, actual);
}

/** Locks PIN attempts for a session after repeated failures. */
export class PinGuard {
  private failures = 0;
  private lockedUntil = 0;
  private readonly maxFailures: number;
  private readonly lockMs: number;

  constructor(maxFailures = 5, lockMs = 5 * 60 * 1000) {
    this.maxFailures = maxFailures;
    this.lockMs = lockMs;
  }

  isLocked(now: number): boolean {
    return now < this.lockedUntil;
  }

  fail(now: number) {
    this.failures++;
    if (this.failures >= this.maxFailures) {
      this.lockedUntil = now + this.lockMs;
      this.failures = 0;
    }
  }

  succeed() {
    this.failures = 0;
  }
}
