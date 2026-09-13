import {
  generateSecureToken,
  hashSecureToken,
  SECURE_TOKEN_BYTES,
} from '../tokens/secure-token.js';

/**
 * Verification tokens reuse the shared secure-token primitive. Kept as a named
 * domain module so verification callers stay decoupled from the primitive.
 */
export const VERIFICATION_TOKEN_BYTES = SECURE_TOKEN_BYTES;

export function generateVerificationToken(): string {
  return generateSecureToken();
}

export function hashVerificationToken(rawToken: string): string {
  return hashSecureToken(rawToken);
}
