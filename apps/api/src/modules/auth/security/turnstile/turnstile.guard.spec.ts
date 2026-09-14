import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { TurnstileGuard } from './turnstile.guard.js';
import type { TurnstileOutcome, TurnstileVerifier } from './turnstile-verifier.js';
import { TurnstileFailedException, TurnstileRequiredException } from './turnstile.exceptions.js';

function context(token?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '203.0.113.9',
        body: token === undefined ? {} : { turnstileToken: token },
      }),
      getResponse: () => ({ header: vi.fn() }),
    }),
  } as unknown as ExecutionContext;
}

function verifier(enabled: boolean, outcome: TurnstileOutcome): TurnstileVerifier {
  return { isEnabled: () => enabled, verify: async () => outcome };
}

describe('TurnstileGuard', () => {
  it('is a no-op when Turnstile is disabled', async () => {
    const guard = new TurnstileGuard(verifier(false, 'failed'));
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('allows a valid challenge', async () => {
    const guard = new TurnstileGuard(verifier(true, 'ok'));
    await expect(guard.canActivate(context('token'))).resolves.toBe(true);
  });

  it('throws TURNSTILE_REQUIRED when the token is missing', async () => {
    const guard = new TurnstileGuard(verifier(true, 'missing'));
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(TurnstileRequiredException);
  });

  it('throws TURNSTILE_FAILED when the challenge fails', async () => {
    const guard = new TurnstileGuard(verifier(true, 'failed'));
    await expect(guard.canActivate(context('bad'))).rejects.toBeInstanceOf(
      TurnstileFailedException,
    );
  });

  it('fails closed when the provider is unavailable', async () => {
    const guard = new TurnstileGuard(verifier(true, 'unavailable'));
    await expect(guard.canActivate(context('token'))).rejects.toBeInstanceOf(
      TurnstileFailedException,
    );
  });
});
