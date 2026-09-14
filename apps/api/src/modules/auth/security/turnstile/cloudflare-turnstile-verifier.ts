import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TurnstileOutcome, TurnstileVerifier } from './turnstile-verifier.js';

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface SiteverifyResponse {
  success?: boolean;
  'error-codes'?: string[];
}

/**
 * Cloudflare Turnstile implementation of the verification boundary. The
 * frontend widget result is never trusted: only a successful server-side
 * Siteverify response counts. A provider outage, timeout, non-2xx, or malformed
 * response yields `unavailable`, which callers treat as fail-closed. Secrets and
 * tokens are never logged.
 */
@Injectable()
export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  private readonly logger = new Logger(CloudflareTurnstileVerifier.name);
  private readonly secret?: string;
  private readonly fetchImpl: FetchLike;

  constructor(config: ConfigService, fetchImpl: FetchLike = fetch) {
    const secret = config.get<string>('TURNSTILE_SECRET_KEY');
    this.secret = secret && secret.length > 0 ? secret : undefined;
    this.fetchImpl = fetchImpl;
  }

  isEnabled(): boolean {
    return this.secret !== undefined;
  }

  async verify(token: string | undefined, remoteIp?: string): Promise<TurnstileOutcome> {
    if (!this.isEnabled()) {
      return 'ok';
    }
    if (!token) {
      return 'missing';
    }

    const body = new URLSearchParams({ secret: this.secret as string, response: token });
    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }

    try {
      const response = await this.fetchImpl(TURNSTILE_SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!response.ok) {
        return 'unavailable';
      }

      const payload = (await response.json()) as SiteverifyResponse;
      if (typeof payload.success !== 'boolean') {
        return 'unavailable';
      }
      return payload.success ? 'ok' : 'failed';
    } catch {
      // Network/timeout/parse failure: provider unavailable. Never log the token.
      this.logger.warn('Turnstile siteverify request failed');
      return 'unavailable';
    }
  }
}
