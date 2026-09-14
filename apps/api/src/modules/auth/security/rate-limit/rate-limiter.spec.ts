import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter } from './rate-limiter.js';

describe('InMemoryRateLimiter', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    const now = 1_000;
    const limiter = new InMemoryRateLimiter(() => now);
    const policy = { limit: 3, windowMs: 60_000 };

    expect(limiter.consume('k', policy).allowed).toBe(true);
    expect(limiter.consume('k', policy).allowed).toBe(true);
    expect(limiter.consume('k', policy).allowed).toBe(true);
    const blocked = limiter.consume('k', policy);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets the window after it elapses', () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter(() => now);
    const policy = { limit: 1, windowMs: 60_000 };

    expect(limiter.consume('k', policy).allowed).toBe(true);
    expect(limiter.consume('k', policy).allowed).toBe(false);

    now += 60_001;
    expect(limiter.consume('k', policy).allowed).toBe(true);
  });

  it('keeps independent buckets per key', () => {
    const limiter = new InMemoryRateLimiter(() => 0);
    const policy = { limit: 1, windowMs: 60_000 };

    expect(limiter.consume('login:1.1.1.1', policy).allowed).toBe(true);
    expect(limiter.consume('login:1.1.1.1', policy).allowed).toBe(false);
    expect(limiter.consume('login:2.2.2.2', policy).allowed).toBe(true);
    expect(limiter.consume('register:1.1.1.1', policy).allowed).toBe(true);
  });

  it('reports a retry delay derived from the window', () => {
    const now = 0;
    const limiter = new InMemoryRateLimiter(() => now);
    const decision = limiter.consume('k', { limit: 0, windowMs: 30_000 });
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(30);
  });

  it('clears all buckets on reset', () => {
    const limiter = new InMemoryRateLimiter(() => 0);
    limiter.consume('k', { limit: 0, windowMs: 60_000 });
    limiter.reset();
    expect(limiter.consume('k', { limit: 1, windowMs: 60_000 }).allowed).toBe(true);
  });
});
