import { describe, expect, it } from 'vitest';
import { GOOGLE_SCOPES } from './openid-client-google.provider.js';

describe('Google OIDC provider configuration', () => {
  it('requests only the authentication scopes', () => {
    expect(GOOGLE_SCOPES).toBe('openid email profile');
    expect(GOOGLE_SCOPES.split(' ').sort()).toEqual(['email', 'openid', 'profile']);
  });
});
