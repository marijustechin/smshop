import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { getTurnstileSiteKey, TurnstileWidget, useTurnstileGate } from './turnstile';

vi.mock('next/script', () => ({ default: () => null }));

const SITE_KEY = '1x00000000000000000000AA';

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as { turnstile?: unknown }).turnstile;
  document.querySelectorAll('script[data-smshop-turnstile]').forEach((script) => script.remove());
});

describe('Turnstile configuration', () => {
  it('reports no site key when unset', () => {
    expect(getTurnstileSiteKey()).toBe('');
  });

  it('reads the public site key when configured', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', SITE_KEY);
    expect(getTurnstileSiteKey()).toBe(SITE_KEY);
  });

  // Guards against committing real credentials: local dev uses Cloudflare's
  // official always-pass TEST sitekey (public, test-only).
  it('ships the Cloudflare always-pass test sitekey in the committed example', () => {
    // Vitest runs with the package (apps/web) as cwd.
    const example = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
    expect(example).toMatch(/^NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA$/m);
  });
});

describe('useTurnstileGate', () => {
  it('allows submission and needs no challenge without a site key', () => {
    const { result } = renderHook(() => useTurnstileGate());
    expect(result.current.needsChallenge).toBe(false);
    expect(result.current.canSubmit).toBe(true);
  });

  it('blocks submission until a token is present when a site key is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', SITE_KEY);
    const { result } = renderHook(() => useTurnstileGate());

    expect(result.current.needsChallenge).toBe(true);
    expect(result.current.canSubmit).toBe(false);

    act(() => result.current.setToken('challenge-token'));
    expect(result.current.canSubmit).toBe(true);
  });

  it('reset clears the token and remounts the widget', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', SITE_KEY);
    const { result } = renderHook(() => useTurnstileGate());
    const nonce = result.current.nonce;

    act(() => result.current.setToken('challenge-token'));
    act(() => result.current.reset());

    expect(result.current.token).toBeNull();
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.nonce).toBe(nonce + 1);
  });

  it('invokes onTokenAvailable only when a token becomes available', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', SITE_KEY);
    const onTokenAvailable = vi.fn();
    const { result } = renderHook(() => useTurnstileGate({ onTokenAvailable }));

    expect(onTokenAvailable).not.toHaveBeenCalled();

    act(() => result.current.setToken('challenge-token'));
    expect(onTokenAvailable).toHaveBeenCalledTimes(1);

    // Expiry/clear must not trigger the callback (no clearing/enforcement change).
    act(() => result.current.setToken(null));
    expect(onTokenAvailable).toHaveBeenCalledTimes(1);

    act(() => result.current.reset());
    expect(onTokenAvailable).toHaveBeenCalledTimes(1);
  });
});

describe('TurnstileWidget', () => {
  it('renders nothing when no site key is configured', () => {
    const { container } = render(<TurnstileWidget onTokenChange={vi.fn()} />);
    expect(container.querySelector('[data-testid="turnstile-widget"]')).toBeNull();
  });

  it('renders the widget with the site key and emits the challenge token', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', SITE_KEY);
    const onTokenChange = vi.fn();
    const renderWidget = vi.fn((_el: HTMLElement, options: { callback?: (t: string) => void }) => {
      options.callback?.('emitted-token');
      return 'widget-1';
    });
    (window as { turnstile?: unknown }).turnstile = { render: renderWidget, reset: vi.fn() };

    render(<TurnstileWidget onTokenChange={onTokenChange} />);

    expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument();
    expect(renderWidget).toHaveBeenCalledTimes(1);
    expect(renderWidget.mock.calls[0][1]).toMatchObject({ sitekey: SITE_KEY });
    expect(onTokenChange).toHaveBeenCalledWith('emitted-token');
  });

  it('injects the Cloudflare script and renders once it loads (mount without the global)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', SITE_KEY);
    const renderWidget = vi.fn(() => 'w1');

    render(<TurnstileWidget onTokenChange={vi.fn()} />);

    const script = document.querySelector<HTMLScriptElement>('script[data-smshop-turnstile]');
    expect(script).not.toBeNull();
    expect(script?.src).toContain('challenges.cloudflare.com');

    (window as { turnstile?: unknown }).turnstile = {
      render: renderWidget,
      reset: vi.fn(),
      remove: vi.fn(),
    };
    act(() => script!.dispatchEvent(new Event('load')));

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
  });

  it('retries the script after a failed load on a later mount (client navigation)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', SITE_KEY);
    const first = render(<TurnstileWidget onTokenChange={vi.fn()} />);

    const failed = document.querySelector<HTMLScriptElement>('script[data-smshop-turnstile]');
    expect(failed).not.toBeNull();
    act(() => failed!.dispatchEvent(new Event('error')));
    // A failed tag is removed so the next attempt starts clean (no poisoned cache).
    expect(document.querySelector('script[data-smshop-turnstile]')).toBeNull();

    first.unmount();

    const renderWidget = vi.fn(() => 'w1');
    render(<TurnstileWidget onTokenChange={vi.fn()} />);
    const retried = document.querySelector<HTMLScriptElement>('script[data-smshop-turnstile]');
    expect(retried).not.toBeNull();
    expect(retried).not.toBe(failed);

    (window as { turnstile?: unknown }).turnstile = {
      render: renderWidget,
      reset: vi.fn(),
      remove: vi.fn(),
    };
    act(() => retried!.dispatchEvent(new Event('load')));

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
  });
});
