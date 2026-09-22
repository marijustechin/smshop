import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from './forgot-password-form';
import { ResetPasswordForm } from './reset-password-form';
import { ApiError } from '@/shared/api/client';
import * as api from '../api/auth-api';

const { searchParams } = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

vi.mock('../api/auth-api', () => ({
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

const forgotten = vi.mocked(api.forgotPassword);
const reset = vi.mocked(api.resetPassword);

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
});

describe('ForgotPasswordForm', () => {
  it('shows the generic enumeration-safe message for any valid email', async () => {
    forgotten.mockResolvedValue({ message: 'ok' });
    render(<ForgotPasswordForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('El. paštas'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: /Siųsti atkūrimo instrukcijas/i }));

    expect(
      await screen.findByText(/Jei paskyra su tokiu el\. pašto adresu egzistuoja/i),
    ).toBeInTheDocument();
  });
});

describe('ResetPasswordForm', () => {
  async function fill(password = 'a-very-strong-passphrase', confirm = password) {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Naujas slaptažodis'), password);
    await user.type(screen.getByLabelText('Pakartokite naują slaptažodį'), confirm);
    await user.click(screen.getByRole('button', { name: /Pakeisti slaptažodį/i }));
  }

  it('resets the password on success', async () => {
    searchParams.set('token', 'reset-token');
    reset.mockResolvedValue({ passwordReset: true });
    render(<ResetPasswordForm />);

    await fill();

    expect(await screen.findByText(/Slaptažodis pakeistas/i)).toBeInTheDocument();
    expect(reset).toHaveBeenCalledWith('reset-token', 'a-very-strong-passphrase');
  });

  it('shows a missing-token state', async () => {
    render(<ResetPasswordForm />);
    expect(await screen.findByText(/Trūksta atkūrimo nuorodos/i)).toBeInTheDocument();
  });

  it.each([
    [400, 'bad-reset', /Nuoroda netinkama/i],
    [410, 'expired-reset', /galiojimo laikas baigėsi/i],
    [409, 'used-reset', /jau buvo panaudota/i],
  ])('maps status %i to its message', async (status, token, pattern) => {
    searchParams.set('token', token as string);
    reset.mockRejectedValue(new ApiError(status as number, 'err'));
    render(<ResetPasswordForm />);

    await fill();

    expect(await screen.findByText(pattern)).toBeInTheDocument();
  });

  it('enforces the password policy client-side', async () => {
    searchParams.set('token', 'reset-token');
    render(<ResetPasswordForm />);

    await fill('short', 'short');

    expect(await screen.findByText('Slaptažodis turi būti bent 12 simbolių')).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it('validates confirmation mismatch', async () => {
    searchParams.set('token', 'reset-token');
    render(<ResetPasswordForm />);

    await fill('a-very-strong-passphrase', 'different-passphrase');

    expect(await screen.findByText('Slaptažodžiai nesutampa')).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });
});
