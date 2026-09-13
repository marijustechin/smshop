import { describe, expect, it } from 'vitest';
import {
  generateVerificationToken,
  hashVerificationToken,
  VERIFICATION_TOKEN_BYTES,
} from './verification-token.js';

describe('verification tokens', () => {
  it('generates a URL-safe token with adequate entropy', () => {
    const token = generateVerificationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // base64url of N bytes is ceil(N/3)*4 characters without padding.
    expect(token.length).toBeGreaterThanOrEqual(Math.ceil((VERIFICATION_TOKEN_BYTES * 4) / 3) - 2);
    expect(VERIFICATION_TOKEN_BYTES).toBeGreaterThanOrEqual(16);
  });

  it('generates distinct tokens', () => {
    expect(generateVerificationToken()).not.toBe(generateVerificationToken());
  });

  it('hashes deterministically to a 64-char hex digest', () => {
    const token = generateVerificationToken();
    const hash = hashVerificationToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashVerificationToken(token)).toBe(hash);
  });

  it('keeps the raw token out of the stored hash', () => {
    const token = generateVerificationToken();

    expect(hashVerificationToken(token)).not.toBe(token);
    expect(hashVerificationToken(token)).not.toContain(token);
  });

  it('hashes differing tokens differently', () => {
    expect(hashVerificationToken('a')).not.toBe(hashVerificationToken('b'));
  });
});
