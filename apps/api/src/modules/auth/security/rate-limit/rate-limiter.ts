export interface RateLimitPolicy {
  /** Maximum allowed requests within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Provider-neutral rate limiter boundary. The in-memory implementation is
 * suitable for the single-instance deployment; a shared store would be required
 * only if the API is scaled horizontally (documented follow-up).
 */
export interface RateLimiter {
  consume(key: string, policy: RateLimitPolicy): RateLimitDecision;
}

export const RATE_LIMITER = Symbol('RATE_LIMITER');

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window in-memory limiter. The clock is injectable so tests are
 * deterministic without wall-clock waits.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  consume(key: string, policy: RateLimitPolicy): RateLimitDecision {
    const current = this.now();
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + policy.windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;
    const allowed = bucket.count <= policy.limit;
    return {
      allowed,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)),
    };
  }

  /** Clears all buckets (used by tests). */
  reset(): void {
    this.buckets.clear();
  }
}
