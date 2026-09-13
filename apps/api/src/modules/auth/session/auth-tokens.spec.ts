import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  parseDurationMs,
  REFRESH_TOKEN_BYTES,
} from './auth-tokens.js';

describe('refresh tokens', () => {
  it('generates a URL-safe token with adequate entropy', () => {
    const token = generateRefreshToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(REFRESH_TOKEN_BYTES).toBeGreaterThanOrEqual(32);
  });

  it('generates distinct tokens', () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it('hashes deterministically to a 64-char hex digest and never stores the raw token', () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(token)).toBe(hash);
    expect(hash).not.toBe(token);
    expect(hash).not.toContain(token);
  });
});

describe('parseDurationMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['1h', 3_600_000],
    ['7d', 604_800_000],
  ])('parses %s', (input, expected) => {
    expect(parseDurationMs(input)).toBe(expected);
  });

  it('rejects malformed durations', () => {
    expect(() => parseDurationMs('15')).toThrow(/Invalid duration/);
    expect(() => parseDurationMs('abc')).toThrow(/Invalid duration/);
  });
});
