import type { ConfigService } from '@nestjs/config';

export interface GoogleOidcConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  /** Optional issuer override; defaults to Google's accounts issuer. */
  issuer: string;
}

export const GOOGLE_OIDC_CONFIG = Symbol('GOOGLE_OIDC_CONFIG');

export const GOOGLE_ISSUER = 'https://accounts.google.com';

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return String(value);
}

/**
 * Reads Google OIDC settings. Returns `null` when Google is disabled (none of
 * the variables set); environment validation guarantees all-or-none.
 */
export function readGoogleOidcConfig(config: ConfigService): GoogleOidcConfig | null {
  const clientId = asString(config.get('GOOGLE_CLIENT_ID'));
  const clientSecret = asString(config.get('GOOGLE_CLIENT_SECRET'));
  const callbackUrl = asString(config.get('GOOGLE_CALLBACK_URL'));

  if (!clientId || !clientSecret || !callbackUrl) {
    return null;
  }

  return { clientId, clientSecret, callbackUrl, issuer: GOOGLE_ISSUER };
}
