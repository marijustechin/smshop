import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { RATE_LIMITER, type RateLimiter } from './rate-limiter.js';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator.js';
import { RateLimitExceededException } from './rate-limit.exceptions.js';

/**
 * Enforces an endpoint-specific fixed-window rate limit declared with
 * `@RateLimit(...)`. Applied only to the routes that opt in, so refresh/logout
 * and unrelated endpoints are unaffected. The client identity is Fastify's
 * `request.ip`; see docs/authentication.md for the proxy-trust assumption.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler());
    if (!policy) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const decision = this.limiter.consume(`${policy.name}:${request.ip}`, policy);
    if (decision.allowed) {
      return true;
    }

    const reply = context.switchToHttp().getResponse<FastifyReply>();
    reply.header('Retry-After', decision.retryAfterSeconds);
    throw new RateLimitExceededException(decision.retryAfterSeconds);
  }
}
