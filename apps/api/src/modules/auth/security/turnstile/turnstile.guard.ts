import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { TURNSTILE_VERIFIER, type TurnstileVerifier } from './turnstile-verifier.js';
import { TurnstileFailedException, TurnstileRequiredException } from './turnstile.exceptions.js';

/**
 * Enforces Turnstile on the endpoints it is applied to. Runs as a guard, i.e.
 * before request pipes and long before any business logic, so a failed bot check
 * never reaches Argon2 hashing, token generation, database writes, or mail.
 * When Turnstile is not configured it is a no-op.
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(@Inject(TURNSTILE_VERIFIER) private readonly verifier: TurnstileVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.verifier.isEnabled()) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = (request.body as { turnstileToken?: string } | undefined)?.turnstileToken;
    const outcome = await this.verifier.verify(token, request.ip);

    if (outcome === 'ok') {
      return true;
    }
    if (outcome === 'missing') {
      throw new TurnstileRequiredException();
    }
    throw new TurnstileFailedException();
  }
}
