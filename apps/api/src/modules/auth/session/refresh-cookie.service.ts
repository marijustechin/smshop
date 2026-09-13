import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import { parseDurationMs } from './auth-tokens.js';

export const REFRESH_COOKIE_NAME = 'smshop_refresh_token';

/** Cookie is only sent to the auth endpoints that consume it. */
export const REFRESH_COOKIE_PATH = '/api/auth';

/**
 * Sets/clears the refresh-token cookie. The raw refresh token lives only in this
 * httpOnly cookie; it is never returned in a response body.
 */
@Injectable()
export class RefreshCookieService {
  private readonly secure: boolean;
  private readonly maxAgeSeconds: number;

  constructor(config: ConfigService) {
    this.secure = config.get<string>('NODE_ENV') === 'production';
    this.maxAgeSeconds = Math.floor(
      parseDurationMs(config.get<string>('AUTH_SESSION_TTL', '7d')) / 1000,
    );
  }

  options(): {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax';
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: this.maxAgeSeconds,
    };
  }

  set(reply: FastifyReply, rawToken: string): void {
    reply.setCookie(REFRESH_COOKIE_NAME, rawToken, this.options());
  }

  clear(reply: FastifyReply): void {
    reply.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
  }
}
