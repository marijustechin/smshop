import {
  ClientSecretPost,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  type Configuration,
} from 'openid-client';
import type { GoogleOidcConfig } from './google.config.js';
import {
  type AuthorizationUrlInput,
  type ExchangeCodeInput,
  type GoogleIdentity,
  GoogleNotConfiguredError,
  type GoogleOidcProvider,
} from './google-oidc.provider.js';

const SCOPES = 'openid email profile';

/** Exposed for tests asserting the requested scope set. */
export const GOOGLE_SCOPES = SCOPES;

interface IdTokenClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
}

/**
 * Google OIDC implementation backed by `openid-client` (Authorization Code flow
 * with PKCE and nonce). Discovery is lazy and cached. Only `openid email
 * profile` is requested; Google tokens are used transiently for identity
 * verification and never persisted.
 */
export class OpenidClientGoogleProvider implements GoogleOidcProvider {
  private configuration?: Promise<Configuration>;

  constructor(private readonly config: GoogleOidcConfig | null) {}

  isEnabled(): boolean {
    return this.config !== null;
  }

  private async getConfiguration(): Promise<Configuration> {
    if (!this.config) {
      throw new GoogleNotConfiguredError();
    }
    this.configuration ??= discovery(
      new URL(this.config.issuer),
      this.config.clientId,
      undefined,
      ClientSecretPost(this.config.clientSecret),
    );
    return this.configuration;
  }

  async createAuthorizationUrl(input: AuthorizationUrlInput): Promise<string> {
    if (!this.config) {
      throw new GoogleNotConfiguredError();
    }
    const configuration = await this.getConfiguration();
    const url = buildAuthorizationUrl(configuration, {
      redirect_uri: this.config.callbackUrl,
      response_type: 'code',
      scope: SCOPES,
      state: input.state,
      nonce: input.nonce,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
    });
    return url.href;
  }

  async exchangeCode(input: ExchangeCodeInput): Promise<GoogleIdentity> {
    const configuration = await this.getConfiguration();
    const tokens = await authorizationCodeGrant(configuration, new URL(input.callbackUrl), {
      pkceCodeVerifier: input.codeVerifier,
      expectedState: input.state,
      expectedNonce: input.nonce,
    });

    const claims = tokens.claims() as IdTokenClaims | undefined;
    if (!claims?.sub) {
      throw new Error('Google ID token is missing the required `sub` claim');
    }

    return {
      sub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === true,
    };
  }
}

/** Returns PKCE code challenge for a verifier (re-exported for the flow). */
export async function pkceChallenge(verifier: string): Promise<string> {
  return calculatePKCECodeChallenge(verifier);
}
