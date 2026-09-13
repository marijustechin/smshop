/** Identity resolved from a validated Google OIDC ID token. */
export interface GoogleIdentity {
  /** Google OIDC subject — the canonical provider account identifier. */
  sub: string;
  email?: string;
  emailVerified: boolean;
}

export interface AuthorizationUrlInput {
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface ExchangeCodeInput {
  callbackUrl: string;
  codeVerifier: string;
  state: string;
  nonce: string;
}

/**
 * Provider-independent Google OIDC boundary. Auth depends on this interface,
 * never on a specific OIDC library, and tests supply a stub so no automated test
 * ever contacts Google.
 */
export interface GoogleOidcProvider {
  /** Whether Google authentication is configured/enabled. */
  isEnabled(): boolean;
  /** Builds the Google authorization URL the browser should be sent to. */
  createAuthorizationUrl(input: AuthorizationUrlInput): Promise<string>;
  /** Exchanges the authorization code and returns the validated identity. */
  exchangeCode(input: ExchangeCodeInput): Promise<GoogleIdentity>;
}

export const GOOGLE_OIDC_PROVIDER = Symbol('GOOGLE_OIDC_PROVIDER');

/** Thrown when the Google flow is used while Google is not configured. */
export class GoogleNotConfiguredError extends Error {
  constructor() {
    super('Google authentication is not configured');
    this.name = 'GoogleNotConfiguredError';
  }
}
