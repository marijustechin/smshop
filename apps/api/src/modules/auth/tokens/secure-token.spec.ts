import { describe, expect, it } from 'vitest';
import { generateSecureToken, hashSecureToken, SECURE_TOKEN_BYTES } from './secure-token.js';

describe('secure tokens', () => {
  it('generates a URL-safe, high-entropy token', () => {
    const token = generateSecureToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(SECURE_TOKEN_BYTES).toBeGreaterThanOrEqual(32);
  });

  it('generates distinct tokens', () => {
    expect(generateSecureToken()).not.toBe(generateSecureToken());
  });

  it('hashes deterministically to a 64-char hex digest, never the raw token', () => {
    const token = generateSecureToken();
    const hash = hashSecureToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecureToken(token)).toBe(hash);
    expect(hash).not.toBe(token);
    expect(hash).not.toContain(token);
  });
});
