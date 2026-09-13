import { describe, expect, it } from 'vitest';
import { mapAuthError, isEmailNotVerified, AUTH_MESSAGES } from './messages';
import { ApiError } from '@/lib/api/client';

describe('auth error mapping', () => {
  it('maps a network error (status 0) to the network message', () => {
    expect(mapAuthError(new ApiError(0, 'network_error'))).toBe(AUTH_MESSAGES.network);
  });

  it('maps 401 to invalid credentials', () => {
    expect(mapAuthError(new ApiError(401, 'Invalid email or password'))).toBe(
      AUTH_MESSAGES.invalidCredentials,
    );
  });

  it('maps 409 to duplicate email', () => {
    expect(mapAuthError(new ApiError(409, 'Email already in use'))).toBe(
      AUTH_MESSAGES.duplicateEmail,
    );
  });

  it('maps 410 to expired token', () => {
    expect(mapAuthError(new ApiError(410, 'expired'))).toBe(AUTH_MESSAGES.expiredToken);
  });

  it('detects the unverified-account error', () => {
    const error = new ApiError(403, 'not verified', 'EMAIL_NOT_VERIFIED');
    expect(isEmailNotVerified(error)).toBe(true);
    expect(isEmailNotVerified(new ApiError(403, 'other', 'OTHER'))).toBe(false);
    expect(isEmailNotVerified(new ApiError(401, 'x'))).toBe(false);
  });

  it('never exposes backend internals in the generic mapping', () => {
    expect(mapAuthError(new Error('SMTP 550: something leaked'))).toBe(AUTH_MESSAGES.generic);
  });
});
