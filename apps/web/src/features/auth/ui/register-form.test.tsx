import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from './register-form';
import { ApiError } from '@/shared/api/client';
import * as api from '../api/auth-api';

vi.mock('../api/auth-api', () => ({
  getAuthCapabilities: vi.fn(),
  googleStartUrl: () => 'http://localhost:3100/api/auth/google',
  register: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock('next/script', () => ({ default: () => null }));

const mocked = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
  // Unresolved by default so tests without the Google action don't trigger a
  // post-render capability state update; Google tests resolve it explicitly.
  mocked.getAuthCapabilities.mockReturnValue(new Promise(() => {}));
});

async function fill(password = 'a-very-strong-passphrase', confirm = password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('El. paštas'), 'new@example.com');
  await user.type(screen.getByLabelText('Slaptažodis'), password);
  await user.type(screen.getByLabelText('Pakartokite slaptažodį'), confirm);
  await user.click(screen.getByRole('button', { name: 'Registruotis' }));
}

describe('RegisterForm', () => {
  it('shows the confirmation message when the verification email was sent', async () => {
    mocked.register.mockResolvedValue({
      id: 'u1',
      email: 'new@example.com',
      emailVerified: false,
      verificationEmailSent: true,
    });
    render(<RegisterForm />);

    await fill();

    expect(
      await screen.findByText(/Registracija sėkminga\. Patikrinkite savo el\. paštą/i),
    ).toBeInTheDocument();
  });

  it('offers resend when the verification email failed', async () => {
    mocked.register.mockResolvedValue({
      id: 'u1',
      email: 'new@example.com',
      emailVerified: false,
      verificationEmailSent: false,
    });
    mocked.resendVerification.mockResolvedValue({ message: 'ok' });
    render(<RegisterForm />);

    await fill();
    expect(await screen.findByText(/patvirtinimo laiško išsiųsti nepavyko/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Siųsti patvirtinimo laišką' }));
    await waitFor(() =>
      expect(mocked.resendVerification).toHaveBeenCalledWith('new@example.com', null),
    );
  });

  it('handles a duplicate email conflict', async () => {
    mocked.register.mockRejectedValue(new ApiError(409, 'Email already in use'));
    render(<RegisterForm />);

    await fill();

    expect(
      await screen.findByText('Paskyra su šiuo el. pašto adresu jau egzistuoja.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prisijungti' })).toHaveAttribute(
      'href',
      '/prisijungti',
    );
  });

  it('validates password confirmation client-side', async () => {
    render(<RegisterForm />);

    await fill('a-very-strong-passphrase', 'different-passphrase');

    expect(await screen.findByText('Slaptažodžiai nesutampa')).toBeInTheDocument();
    expect(mocked.register).not.toHaveBeenCalled();
  });

  it('includes the Turnstile token when a challenge is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    (window as { turnstile?: unknown }).turnstile = {
      render: (_el: HTMLElement, options: { callback?: (t: string) => void }) => {
        options.callback?.('tok-123');
        return 'w1';
      },
      reset: vi.fn(),
    };
    mocked.register.mockResolvedValue({
      id: 'u1',
      email: 'new@example.com',
      emailVerified: false,
      verificationEmailSent: true,
    });
    render(<RegisterForm />);

    await fill();

    await waitFor(() =>
      expect(mocked.register).toHaveBeenCalledWith(
        'new@example.com',
        'a-very-strong-passphrase',
        'tok-123',
      ),
    );
    vi.unstubAllEnvs();
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it('maps a failed Turnstile challenge to a Lithuanian message', async () => {
    mocked.register.mockRejectedValue(new ApiError(403, 'failed', 'TURNSTILE_FAILED'));
    render(<RegisterForm />);

    await fill();

    expect(
      await screen.findByText('Nepavyko patvirtinti, kad nesate robotas. Bandykite dar kartą.'),
    ).toBeInTheDocument();
  });

  it('clears the Turnstile error once a fresh token is produced', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    let options: { callback?: (token: string) => void } | undefined;
    (window as { turnstile?: unknown }).turnstile = {
      render: (_el: HTMLElement, widgetOptions: { callback?: (token: string) => void }) => {
        options = widgetOptions;
        return 'w1';
      },
      reset: vi.fn(),
    };
    const turnstileMessage = 'Nepavyko patvirtinti, kad nesate robotas. Bandykite dar kartą.';
    mocked.register.mockRejectedValue(new ApiError(403, 'failed', 'TURNSTILE_FAILED'));
    render(<RegisterForm />);

    // A first token enables the gated submit; the server then rejects it.
    act(() => options?.callback?.('tok-old'));
    await fill();
    expect(await screen.findByText(turnstileMessage)).toBeInTheDocument();

    // The widget succeeds again with a fresh token: the stale Turnstile error is cleared.
    act(() => options?.callback?.('tok-new'));
    await waitFor(() => expect(screen.queryByText(turnstileMessage)).not.toBeInTheDocument());

    vi.unstubAllEnvs();
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it('does not clear an unrelated error when a fresh token is produced', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    let options: { callback?: (token: string) => void } | undefined;
    (window as { turnstile?: unknown }).turnstile = {
      render: (_el: HTMLElement, widgetOptions: { callback?: (token: string) => void }) => {
        options = widgetOptions;
        return 'w1';
      },
      reset: vi.fn(),
    };
    const serverMessage = 'Įvyko netikėta klaida. Bandykite dar kartą vėliau.';
    mocked.register.mockRejectedValue(new ApiError(500, 'server error'));
    render(<RegisterForm />);

    act(() => options?.callback?.('tok-old'));
    await fill();
    expect(await screen.findByText(serverMessage)).toBeInTheDocument();

    act(() => options?.callback?.('tok-new'));
    expect(screen.getByText(serverMessage)).toBeInTheDocument();

    vi.unstubAllEnvs();
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it('resets the widget after a failed submit and requires a fresh token to retry', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    let options: { callback?: (token: string) => void } | undefined;
    const renderWidget = vi.fn(
      (_el: HTMLElement, widgetOptions: { callback?: (token: string) => void }) => {
        options = widgetOptions;
        return 'w1';
      },
    );
    (window as { turnstile?: unknown }).turnstile = { render: renderWidget, reset: vi.fn() };
    mocked.register.mockRejectedValue(new ApiError(429, 'limited', 'RATE_LIMITED'));
    render(<RegisterForm />);

    act(() => options?.callback?.('tok-1'));
    await fill();
    expect(
      await screen.findByText('Per daug bandymų. Prašome šiek tiek palaukti ir bandyti dar kartą.'),
    ).toBeInTheDocument();

    // The submitted token was consumed: the widget remounted and no token is held.
    expect(renderWidget.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Registruotis' })).toBeDisabled();

    // Retry requires a fresh token, then uses it.
    act(() => options?.callback?.('tok-2'));
    const retry = screen.getByRole('button', { name: 'Registruotis' });
    expect(retry).toBeEnabled();
    mocked.register.mockResolvedValue({
      id: 'u1',
      email: 'new@example.com',
      emailVerified: false,
      verificationEmailSent: true,
    });
    const user = userEvent.setup();
    await user.click(retry);
    await waitFor(() =>
      expect(mocked.register).toHaveBeenLastCalledWith(
        'new@example.com',
        'a-very-strong-passphrase',
        'tok-2',
      ),
    );

    vi.unstubAllEnvs();
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it('resets the token/widget after a Turnstile-specific failure', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    let options: { callback?: (token: string) => void } | undefined;
    const renderWidget = vi.fn(
      (_el: HTMLElement, widgetOptions: { callback?: (token: string) => void }) => {
        options = widgetOptions;
        return 'w1';
      },
    );
    (window as { turnstile?: unknown }).turnstile = { render: renderWidget, reset: vi.fn() };
    mocked.register.mockRejectedValue(new ApiError(403, 'failed', 'TURNSTILE_FAILED'));
    render(<RegisterForm />);

    act(() => options?.callback?.('tok-1'));
    await fill();
    expect(
      await screen.findByText('Nepavyko patvirtinti, kad nesate robotas. Bandykite dar kartą.'),
    ).toBeInTheDocument();
    expect(renderWidget.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Registruotis' })).toBeDisabled();

    vi.unstubAllEnvs();
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it('offers the Google entry point with the registration label when available', async () => {
    mocked.getAuthCapabilities.mockResolvedValue({ google: true });
    render(<RegisterForm />);

    const link = await screen.findByRole('link', { name: 'Registruotis su Google' });
    expect(link).toHaveAttribute('href', 'http://localhost:3100/api/auth/google');
  });

  it('does not offer Google when the backend reports it unavailable', async () => {
    mocked.getAuthCapabilities.mockResolvedValue({ google: false });
    render(<RegisterForm />);

    await waitFor(() => expect(mocked.getAuthCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Registruotis su Google' })).not.toBeInTheDocument();
  });
});
