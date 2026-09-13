import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from './register-form';
import { ApiError } from '@/lib/api/client';
import * as api from '@/lib/auth/api';

vi.mock('@/lib/auth/api', () => ({
  register: vi.fn(),
  resendVerification: vi.fn(),
}));

const mocked = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
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
    await waitFor(() => expect(mocked.resendVerification).toHaveBeenCalledWith('new@example.com'));
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
});
