import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudflareTurnstileVerifier } from './turnstile/cloudflare-turnstile-verifier.js';
import { TURNSTILE_VERIFIER } from './turnstile/turnstile-verifier.js';
import { TurnstileGuard } from './turnstile/turnstile.guard.js';
import { InMemoryRateLimiter } from './rate-limit/rate-limiter.js';
import { RATE_LIMITER } from './rate-limit/rate-limiter.js';
import { RateLimitGuard } from './rate-limit/rate-limit.guard.js';

/**
 * Abuse-prevention boundaries for the public auth endpoints: Cloudflare
 * Turnstile verification and endpoint-specific rate limiting. Both are
 * provider-neutral and stub-able so tests never contact Cloudflare.
 */
@Module({
  providers: [
    {
      provide: TURNSTILE_VERIFIER,
      useFactory: (config: ConfigService) => new CloudflareTurnstileVerifier(config),
      inject: [ConfigService],
    },
    {
      provide: RATE_LIMITER,
      useFactory: () => new InMemoryRateLimiter(),
    },
    TurnstileGuard,
    RateLimitGuard,
  ],
  exports: [TURNSTILE_VERIFIER, RATE_LIMITER, TurnstileGuard, RateLimitGuard],
})
export class SecurityModule {}
