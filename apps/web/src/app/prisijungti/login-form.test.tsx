import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';
import { ApiError } from '@/lib/api/client';

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

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/auth/api', () => ({
  googleStartUrl: () => 'http://localhost:3001/api/auth/google',
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

import { resendVerification } from '@/lib/auth/api';

const resend = vi.mocked(resendVerification);

beforeEach(() => {
  vi.clearAllMocks();
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

  it('renders the Google button targeting the backend OAuth start route', () => {
    render(<LoginForm />);
    const link = screen.getByRole('link', { name: 'Prisijungti su Google' });
    expect(link).toHaveAttribute('href', 'http://localhost:3001/api/auth/google');
  });

  it('handles oauth=success by bootstrapping and redirecting', async () => {
    searchParams.set('oauth', 'success');
    authState.bootstrap.mockResolvedValue(undefined);
    render(<LoginForm />);

    await waitFor(() => expect(authState.bootstrap).toHaveBeenCalled());
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/paskyra'));
  });

  it('explains account-link-required without claiming a link', () => {
    searchParams.set('oauth', 'account-link-required');
    render(<LoginForm />);

    expect(screen.getByText(/jau naudojamas paskyroje/i)).toBeInTheDocument();
    expect(screen.getByText(/bus galima susieti vėliau/i)).toBeInTheDocument();
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
});
