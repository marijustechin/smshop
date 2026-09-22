'use client';

import * as React from 'react';

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SCRIPT_ATTR = 'data-smshop-turnstile';
const TURNSTILE_RETRY_MS = 1000;
const TURNSTILE_MAX_ATTEMPTS = 10;

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
  remove?(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Loads the Cloudflare Turnstile script, at most once per document, and — unlike
 * `next/script` — allows a later mount to retry after a failed load.
 *
 * `next/script` keeps a module-level `ScriptCache`/`LoadCache`: once a load
 * rejects, a later mount marks the script as loaded and never retries it for the
 * rest of the document. A single transient failure (network blip or content
 * blocker) then makes every subsequent client-side navigation to a Turnstile
 * page render no widget — leaving the form disabled until a full refresh. Owning
 * the loader here makes initialization reliable on both the initial page load
 * and client-side route transitions; a failed tag is removed so the next attempt
 * starts clean.
 */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined' || window.turnstile) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[${TURNSTILE_SCRIPT_ATTR}]`);
    if (script?.dataset.loaded === 'true') {
      // A previous tag reported load but the API is absent: treat it as failed.
      script.remove();
      script = null;
    }
    if (!script) {
      script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.setAttribute(TURNSTILE_SCRIPT_ATTR, 'true');
      document.head.appendChild(script);
    }

    const element = script;
    element.addEventListener(
      'load',
      () => {
        element.dataset.loaded = 'true';
        resolve();
      },
      { once: true },
    );
    element.addEventListener(
      'error',
      () => {
        element.remove();
        reject(new Error('turnstile_script_failed'));
      },
      { once: true },
    );
  });
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
    let attempts = 0;
    let retryTimer: number | undefined;

    const renderWidget = (): boolean => {
      if (cancelled || widgetRef.current || !window.turnstile || !containerRef.current) {
        return false;
      }
      try {
        widgetRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => onTokenChange(token),
          'expired-callback': () => onTokenChange(null),
          'error-callback': () => onTokenChange(null),
        });
        return true;
      } catch {
        return false;
      }
    };

    const attempt = () => {
      if (cancelled || widgetRef.current) {
        return;
      }
      if (window.turnstile) {
        renderWidget();
        return;
      }
      loadTurnstileScript().then(
        () => {
          if (!cancelled) {
            renderWidget();
          }
        },
        () => {
          attempts += 1;
          if (!cancelled && attempts < TURNSTILE_MAX_ATTEMPTS) {
            retryTimer = window.setTimeout(attempt, TURNSTILE_RETRY_MS);
          }
        },
      );
    };

    attempt();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
      }
      if (widgetRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetRef.current);
        } catch {
          // The widget id may already be gone; teardown must not throw.
        }
      }
      widgetRef.current = null;
    };
  }, [siteKey, onTokenChange]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} data-testid="turnstile-widget" />;
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

export interface TurnstileGateOptions {
  /**
   * Called when a valid token becomes available (never on expiry/clear). Lets a
   * form clear a stale Turnstile-specific error without touching unrelated
   * errors and without auto-submitting. The callback is kept in a ref so
   * `setToken` stays referentially stable for `TurnstileWidget`.
   */
  onTokenAvailable?: () => void;
}

/** Shared form-level Turnstile state: token, reset, and submit gating. */
export function useTurnstileGate(options: TurnstileGateOptions = {}): TurnstileGate {
  const [token, setTokenState] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const needsChallenge = getTurnstileSiteKey().length > 0;

  const onTokenAvailableRef = React.useRef(options.onTokenAvailable);
  React.useEffect(() => {
    onTokenAvailableRef.current = options.onTokenAvailable;
  });

  const setToken = React.useCallback((value: string | null) => {
    setTokenState(value);
    if (value) {
      onTokenAvailableRef.current?.();
    }
  }, []);

  const reset = React.useCallback(() => {
    setTokenState(null);
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
