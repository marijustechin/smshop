'use client';

import * as React from 'react';
import Script from 'next/script';

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
    },
  ): string;
  reset(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Public site key; by design not a secret. Empty disables the widget. */
export function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
}

/**
 * Renders the Cloudflare Turnstile widget when a public site key is configured.
 * Emits the challenge token (or `null` on expiry/error) so forms can gate
 * submission. Remounting (changing `key`) acquires a fresh token. When no site
 * key is configured the component renders nothing, so local dev without keys
 * and CI (which stubs the backend verifier) work normally.
 */
export function TurnstileWidget({
  onTokenChange,
}: {
  onTokenChange: (token: string | null) => void;
}) {
  const siteKey = getTurnstileSiteKey();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!siteKey) {
      return;
    }

    let cancelled = false;
    const tryRender = () => {
      if (cancelled || widgetRef.current || !window.turnstile || !containerRef.current) {
        return false;
      }
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token) => onTokenChange(token),
        'expired-callback': () => onTokenChange(null),
        'error-callback': () => onTokenChange(null),
      });
      return true;
    };

    if (!tryRender()) {
      const interval = window.setInterval(() => {
        if (tryRender()) {
          window.clearInterval(interval);
        }
      }, 100);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [siteKey, onTokenChange]);

  if (!siteKey) {
    return null;
  }

  return (
    <>
      <Script src={TURNSTILE_SCRIPT_SRC} strategy="afterInteractive" />
      <div ref={containerRef} data-testid="turnstile-widget" />
    </>
  );
}

export interface TurnstileGate {
  token: string | null;
  setToken: (token: string | null) => void;
  /** Clears the token and remounts the widget to acquire a fresh challenge. */
  reset: () => void;
  /** True when a site key is configured and a token is therefore required. */
  needsChallenge: boolean;
  canSubmit: boolean;
  /** Remount key for the widget. */
  nonce: number;
}

/** Shared form-level Turnstile state: token, reset, and submit gating. */
export function useTurnstileGate(): TurnstileGate {
  const [token, setToken] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const needsChallenge = getTurnstileSiteKey().length > 0;

  const reset = React.useCallback(() => {
    setToken(null);
    setNonce((value) => value + 1);
  }, []);

  return {
    token,
    setToken,
    reset,
    needsChallenge,
    canSubmit: !needsChallenge || token !== null,
    nonce,
  };
}
