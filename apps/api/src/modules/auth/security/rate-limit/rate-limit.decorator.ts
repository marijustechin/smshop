import { SetMetadata } from '@nestjs/common';
import type { RateLimitPolicy } from './rate-limiter.js';

export const RATE_LIMIT_KEY = 'auth:rate-limit';

export interface RateLimitOptions extends RateLimitPolicy {
  /** Identifies the policy in the limiter bucket key. */
  name: string;
}

/** Applies an endpoint-specific rate-limit policy via `RateLimitGuard`. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
