import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { getTurnstileSiteKey, TurnstileWidget, useTurnstileGate } from './turnstile';

vi.mock('next/script', () => ({ default: () => null }));

const SITE_KEY = '1x00000000000000000000AA';

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as { turnstile?: unknown }).turnstile;
});

describe('Turnstile configuration', () => {
  it('reports no site key when unset', () => {
    expect(getTurnstileSiteKey()).toBe('');
  });

  it('reads the public site key when configured', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', SITE_KEY);
    expect(getTurnstileSiteKey()).toBe(SITE_KEY);
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
});
