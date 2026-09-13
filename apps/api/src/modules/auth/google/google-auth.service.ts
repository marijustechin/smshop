import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthSessionService } from '../session/auth-session.service.js';
import { RefreshCookieService } from '../session/refresh-cookie.service.js';
import { GoogleAccountService } from './google-account.service.js';
import { GOOGLE_OIDC_PROVIDER, type GoogleOidcProvider } from './google-oidc.provider.js';
import { OAuthTransactionCookieService } from './oauth-transaction-cookie.service.js';
import { generateTransactionSecret } from './oauth-transaction.js';
import { calculatePKCECodeChallenge } from 'openid-client';

export type GoogleCallbackOutcome =
  { status: 'success' } | { status: 'link_required' } | { status: 'failed' };

@Injectable()
export class GoogleAuthService {
  constructor(
    @Inject(GOOGLE_OIDC_PROVIDER) private readonly provider: GoogleOidcProvider,
    private readonly accounts: GoogleAccountService,
    private readonly sessions: AuthSessionService,
    private readonly refreshCookie: RefreshCookieService,
    private readonly transactionCookie: OAuthTransactionCookieService,
  ) {}

  isEnabled(): boolean {
    return this.provider.isEnabled();
  }

  /**
   * Begins the Google flow: generates state/nonce/PKCE verifier, stores the
   * transaction in the httpOnly cookie, and returns the Google authorization
   * URL. Returns `null` when Google is disabled.
   */
  async start(reply: FastifyReply): Promise<string | null> {
    if (!this.provider.isEnabled()) {
      return null;
    }

    const state = generateTransactionSecret();
    const nonce = generateTransactionSecret();
    const codeVerifier = generateTransactionSecret();
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

    const url = await this.provider.createAuthorizationUrl({ state, nonce, codeChallenge });
    this.transactionCookie.set(reply, { state, codeVerifier, nonce });
    return url;
  }

  clearTransaction(reply: FastifyReply): void {
    this.transactionCookie.clear(reply);
  }

  /**
   * Completes the Google flow. Validates the transaction, exchanges the code,
   * resolves the identity, and on success issues the shared A-005 session and
   * refresh cookie. The transaction cookie is cleared on every outcome so a
   * callback cannot be replayed.
   */
  async handleCallback(
    request: FastifyRequest,
    reply: FastifyReply,
    callbackUrl: string,
    queryState: string | undefined,
  ): Promise<GoogleCallbackOutcome> {
    const transaction = this.transactionCookie.read(request);
    this.transactionCookie.clear(reply);

    if (!this.provider.isEnabled()) {
      return { status: 'failed' };
    }
    if (!transaction || !queryState || transaction.state !== queryState) {
      return { status: 'failed' };
    }

    let identity;
    try {
      identity = await this.provider.exchangeCode({
        callbackUrl,
        codeVerifier: transaction.codeVerifier,
        state: transaction.state,
        nonce: transaction.nonce,
      });
    } catch {
      return { status: 'failed' };
    }

    const resolution = await this.accounts.resolveIdentity(identity);
    if (resolution.status === 'link_required') {
      return { status: 'link_required' };
    }
    if (resolution.status === 'invalid') {
      return { status: 'failed' };
    }

    const { refreshToken } = await this.sessions.createSession(resolution.userId);
    this.refreshCookie.set(reply, refreshToken);
    return { status: 'success' };
  }
}
