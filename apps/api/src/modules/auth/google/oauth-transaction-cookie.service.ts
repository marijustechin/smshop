import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  decodeOAuthTransaction,
  deriveOAuthTransactionKey,
  encodeOAuthTransaction,
  OAUTH_TXN_TTL_SECONDS,
  type OAuthTransaction,
} from './oauth-transaction.js';

export const OAUTH_TXN_COOKIE_NAME = 'smshop_oauth_txn';
export const OAUTH_TXN_COOKIE_PATH = '/api/auth/google';

/**
 * Stores the short-lived OAuth transaction (state, PKCE verifier, nonce) in an
 * httpOnly cookie scoped to the Google endpoints. The payload is HMAC-SHA256
 * signed (key derived from the application secret), so it is tamper-evident:
 * HttpOnly/Secure/SameSite limit exposure but are not integrity mechanisms, so
 * the callback rejects any modified or expired payload before using it. The
 * cookie is cleared on callback, making the transaction single-use.
 */
@Injectable()
export class OAuthTransactionCookieService {
  private readonly secure: boolean;
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.secure = config.get<string>('NODE_ENV') === 'production';
    this.key = deriveOAuthTransactionKey(config.getOrThrow<string>('JWT_ACCESS_SECRET'));
  }

  private options() {
    return {
      httpOnly: true as const,
      secure: this.secure,
      sameSite: 'lax' as const,
      path: OAUTH_TXN_COOKIE_PATH,
      maxAge: OAUTH_TXN_TTL_SECONDS,
    };
  }

  set(reply: FastifyReply, transaction: OAuthTransaction): void {
    reply.setCookie(
      OAUTH_TXN_COOKIE_NAME,
      encodeOAuthTransaction(transaction, this.key),
      this.options(),
    );
  }

  read(request: FastifyRequest): OAuthTransaction | null {
    return decodeOAuthTransaction(request.cookies[OAUTH_TXN_COOKIE_NAME], this.key);
  }

  clear(reply: FastifyReply): void {
    reply.clearCookie(OAUTH_TXN_COOKIE_NAME, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: OAUTH_TXN_COOKIE_PATH,
    });
  }
}
