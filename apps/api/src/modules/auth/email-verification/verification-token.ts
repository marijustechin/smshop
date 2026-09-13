import { createHash, randomBytes } from 'node:crypto';

/**
 * Verification tokens are random secrets, not human passwords, so a
 * deterministic cryptographic hash (SHA-256) is appropriate: incoming raw token
 * → hash → database lookup. Argon2 is intentionally not used here.
 */
export const VERIFICATION_TOKEN_BYTES = 32;

/** Builds a URL-safe, high-entropy raw verification token. */
export function generateVerificationToken(): string {
  return randomBytes(VERIFICATION_TOKEN_BYTES).toString('base64url');
}

/** Deterministic hash stored in the database. Raw tokens are never persisted. */
export function hashVerificationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
