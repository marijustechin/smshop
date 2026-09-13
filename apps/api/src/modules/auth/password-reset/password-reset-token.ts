import { generateSecureToken, hashSecureToken } from '../tokens/secure-token.js';

/** Password-reset tokens reuse the shared secure-token primitive. */
export function generatePasswordResetToken(): string {
  return generateSecureToken();
}

export function hashPasswordResetToken(rawToken: string): string {
  return hashSecureToken(rawToken);
}
