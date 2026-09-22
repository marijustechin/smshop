import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';
import { ApiError } from '@/shared/api/client';

const { replace, searchParams, authState } = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
  authState: {
    login: vi.fn(),
    bootstrap: vi.fn(),
    status: 'unauthenticated' as const,
    user: null,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock('../model/auth-context', () => ({
  useAuth: () => authState,
}));

vi.mock('../api/auth-api', () => ({
  getAuthCapabilities: vi.fn(),
  googleStartUrl: () => 'http://localhost:3100/api/auth/google',
  resendVerification: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
}));

import { getAuthCapabilities, resendVerification } from '../api/auth-api';

const resend = vi.mocked(resendVerification);
const getCapabilities = vi.mocked(getAuthCapabilities);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // Turnstile globals/injected script are document-wide; reset per test.
  delete (window as { turnstile?: unknown }).turnstile;
  document.querySelectorAll('script[data-smshop-turnstile]').forEach((s) => s.remove());
  // Unresolved by default so tests without the Google action don't trigger a
  // post-render capability state update; Google tests resolve it explicitly.
  getCapabilities.mockReturnValue(new Promise(() => {}));
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
  authState.status = 'unauthenticated';
});

async function submitLogin(email = 'a@example.com', password = 'password') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('El. paštas'), email);
  await user.type(screen.getByLabelText('Slaptažodis'), password);
  await user.click(screen.getByRole('button', { name: 'Prisijungti' }));
}

describe('LoginForm', () => {
  it('logs in and redirects to /paskyra on success', async () => {
    authState.login.mockResolvedValue(undefined);
    render(<LoginForm />);

    await submitLogin();

    await waitFor(() =>
      expect(authState.login).toHaveBeenCalledWith('a@example.com', 'password', null),
    );
    expect(replace).toHaveBeenCalledWith('/paskyra');
  });

  it('shows an invalid-credentials message', async () => {
    authState.login.mockRejectedValue(new ApiError(401, 'Invalid'));
    render(<LoginForm />);

    await submitLogin();

    expect(await screen.findByText('Neteisingas el. paštas arba slaptažodis.')).toBeInTheDocument();
  });

  it('shows the unverified state and resends verification', async () => {
    authState.login.mockRejectedValue(new ApiError(403, 'not verified', 'EMAIL_NOT_VERIFIED'));
    resend.mockResolvedValue({ message: 'ok' });
    render(<LoginForm />);

    await submitLogin();
    expect(
      await screen.findByText('Jūsų el. pašto adresas dar nepatvirtintas.'),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Siųsti patvirtinimo laišką dar kartą' }));
    await waitFor(() => expect(resend).toHaveBeenCalledWith('a@example.com', null));
  });

  it('honors a safe returnTo', async () => {
    searchParams.set('returnTo', '/paskyra');
    authState.login.mockResolvedValue(undefined);
    render(<LoginForm />);

    await submitLogin();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/paskyra'));
  });

  it('rejects an unsafe returnTo and falls back to /paskyra', async () => {
    searchParams.set('returnTo', 'https://evil.example.com');
    authState.login.mockResolvedValue(undefined);
    render(<LoginForm />);

    await submitLogin();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/paskyra'));
  });

  it('renders the Google button targeting the backend OAuth start route when available', async () => {
    getCapabilities.mockResolvedValue({ google: true });
    render(<LoginForm />);
    const link = await screen.findByRole('link', { name: 'Prisijungti su Google' });
    expect(link).toHaveAttribute('href', 'http://localhost:3100/api/auth/google');
  });

  it('does not offer Google when the backend reports it unavailable', async () => {
    getCapabilities.mockResolvedValue({ google: false });
    render(<LoginForm />);

    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Prisijungti su Google' })).not.toBeInTheDocument();
  });

  it('handles oauth=success by bootstrapping and redirecting', async () => {
    searchParams.set('oauth', 'success');
    authState.bootstrap.mockResolvedValue(undefined);
    render(<LoginForm />);

    await waitFor(() => expect(authState.bootstrap).toHaveBeenCalled());
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/paskyra'));
  });

  it('shows a neutral message for oauth=failed', () => {
    searchParams.set('oauth', 'failed');
    render(<LoginForm />);

    expect(screen.getByText(/Prisijungti su Google nepavyko/i)).toBeInTheDocument();
  });

  it('maps rate limiting (429) to a Lithuanian message', async () => {
    authState.login.mockRejectedValue(new ApiError(429, 'Too many requests', 'RATE_LIMITED'));
    render(<LoginForm />);

    await submitLogin();

    expect(
      await screen.findByText('Per daug bandymų. Prašome šiek tiek palaukti ir bandyti dar kartą.'),
    ).toBeInTheDocument();
  });

  it('maps a Turnstile challenge failure to a Lithuanian message', async () => {
    authState.login.mockRejectedValue(new ApiError(403, 'failed', 'TURNSTILE_FAILED'));
    render(<LoginForm />);

    await submitLogin();

    expect(
      await screen.findByText('Nepavyko patvirtinti, kad nesate robotas. Bandykite dar kartą.'),
    ).toBeInTheDocument();
  });

  it('becomes usable when Turnstile initializes on a client-side mount', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    authState.login.mockResolvedValue(undefined);

    render(<LoginForm />);

    // Mounted without the global (as after client-side navigation): the script
    // is injected by the component rather than relying on next/script.
    const script = document.querySelector<HTMLScriptElement>('script[data-smshop-turnstile]');
    expect(script).not.toBeNull();

    (window as { turnstile?: unknown }).turnstile = {
      render: (_el: HTMLElement, options: { callback?: (token: string) => void }) => {
        options.callback?.('tok-nav');
        return 'w1';
      },
      reset: vi.fn(),
      remove: vi.fn(),
    };
    act(() => script!.dispatchEvent(new Event('load')));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Prisijungti' })).toBeEnabled());

    await submitLogin();
    await waitFor(() =>
      expect(authState.login).toHaveBeenCalledWith('a@example.com', 'password', 'tok-nav'),
    );
  });
});
