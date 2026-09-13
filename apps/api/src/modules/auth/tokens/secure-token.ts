import { createHash, randomBytes } from 'node:crypto';

/**
 * Shared primitive for single-use, high-entropy URL tokens (email verification,
 * password reset). These are random secrets, not human passwords, so a
 * deterministic SHA-256 hash is appropriate: incoming raw token → hash →
 * database lookup. Raw tokens are never persisted.
 */
export const SECURE_TOKEN_BYTES = 32;

/** Builds a URL-safe, high-entropy raw token. */
export function generateSecureToken(bytes: number = SECURE_TOKEN_BYTES): string {
  return randomBytes(bytes).toString('base64url');
}

/** Deterministic SHA-256 hash stored in the database. */
export function hashSecureToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
