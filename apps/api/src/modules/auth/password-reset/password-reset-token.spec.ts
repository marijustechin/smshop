import { describe, expect, it } from 'vitest';
import { generatePasswordResetToken, hashPasswordResetToken } from './password-reset-token.js';

describe('password reset tokens', () => {
  it('generates distinct, URL-safe tokens', () => {
    const token = generatePasswordResetToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generatePasswordResetToken()).not.toBe(token);
  });

  it('hashes deterministically and never returns the raw token', () => {
    const token = generatePasswordResetToken();
    const hash = hashPasswordResetToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPasswordResetToken(token)).toBe(hash);
    expect(hash).not.toBe(token);
  });
});
