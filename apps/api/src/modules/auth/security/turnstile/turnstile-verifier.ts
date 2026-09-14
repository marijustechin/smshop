/**
 * Provider-neutral Cloudflare Turnstile boundary. Auth business code depends on
 * this interface, never on raw Cloudflare calls, so tests can stub it and no
 * automated test contacts Cloudflare.
 */
export type TurnstileOutcome = 'ok' | 'missing' | 'failed' | 'unavailable';

export interface TurnstileVerifier {
  /** Whether Turnstile is configured/enforced (secret present). */
  isEnabled(): boolean;
  /**
   * Verifies a challenge token. Returns `ok` when Turnstile is disabled or the
   * token is valid; `missing` when a token is required but absent; `failed` when
   * Cloudflare rejects it; `unavailable` on provider/network/malformed failure.
   */
  verify(token: string | undefined, remoteIp?: string): Promise<TurnstileOutcome>;
}

export const TURNSTILE_VERIFIER = Symbol('TURNSTILE_VERIFIER');
