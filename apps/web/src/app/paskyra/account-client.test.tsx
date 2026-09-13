import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountClient } from './account-client';

const { replace, logout, bootstrap, state } = vi.hoisted(() => ({
  replace: vi.fn(),
  logout: vi.fn(),
  bootstrap: vi.fn(),
  state: {
    status: 'unknown' as 'unknown' | 'authenticated' | 'unauthenticated' | 'error',
    user: null as { id: string; email: string; emailVerified: boolean } | null,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ ...state, logout, bootstrap }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.status = 'unknown';
  state.user = null;
});

describe('AccountClient (protected /paskyra)', () => {
  it('shows loading while the session is unknown and does not redirect yet', () => {
    state.status = 'unknown';
    render(<AccountClient />);

    expect(screen.getByText('Kraunama…')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders safe user data when authenticated', () => {
    state.status = 'authenticated';
    state.user = { id: 'u1', email: 'a@example.com', emailVerified: true };
    render(<AccountClient />);

    expect(screen.getByText('a@example.com')).toBeInTheDocument();
    expect(screen.getByText('Patvirtintas')).toBeInTheDocument();
    // The access token is never rendered.
    expect(screen.queryByText(/accessToken|eyJ/)).toBeNull();
  });

  it('redirects to login with returnTo when confirmed unauthenticated', async () => {
    state.status = 'unauthenticated';
    render(<AccountClient />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/prisijungti?returnTo=/paskyra'));
  });

  it('does NOT redirect to login on a transient bootstrap failure', async () => {
    state.status = 'error';
    render(<AccountClient />);

    expect(screen.getByText(/Nepavyko patikrinti prisijungimo būsenos/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('offers a retry that re-runs bootstrap', async () => {
    state.status = 'error';
    bootstrap.mockResolvedValue(undefined);
    render(<AccountClient />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Bandyti dar kartą' }));

    await waitFor(() => expect(bootstrap).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });

  it('logs out and redirects to login', async () => {
    state.status = 'authenticated';
    state.user = { id: 'u1', email: 'a@example.com', emailVerified: false };
    logout.mockResolvedValue(undefined);
    render(<AccountClient />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Atsijungti' }));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/prisijungti'));
  });
});
