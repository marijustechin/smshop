import { describe, expect, it } from 'vitest';
import { mapAuthError, AUTH_MESSAGES } from './messages';
import { ApiError } from '@/shared/api/client';

describe('auth error mapping (hardening)', () => {
  it('maps 429 to the rate-limit message', () => {
    expect(mapAuthError(new ApiError(429, 'Too many requests', 'RATE_LIMITED'))).toBe(
      AUTH_MESSAGES.rateLimited,
    );
  });

  it('maps a missing challenge to the Turnstile message', () => {
    expect(mapAuthError(new ApiError(403, 'required', 'TURNSTILE_REQUIRED'))).toBe(
      AUTH_MESSAGES.turnstile,
    );
  });

  it('maps a failed challenge to the Turnstile message', () => {
    expect(mapAuthError(new ApiError(403, 'failed', 'TURNSTILE_FAILED'))).toBe(
      AUTH_MESSAGES.turnstile,
    );
  });

  it('does not leak backend/provider detail for unknown errors', () => {
    expect(mapAuthError(new ApiError(500, 'ECONNRESET cloudflare'))).toBe(AUTH_MESSAGES.generic);
  });
});
