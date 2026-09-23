import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountClient } from './account-client';
import { getAuthCapabilities } from '@/features/auth/api/auth-api';

const { replace, logout, bootstrap, state } = vi.hoisted(() => ({
  replace: vi.fn(),
  logout: vi.fn(),
  bootstrap: vi.fn(),
  state: {
    status: 'unknown' as 'unknown' | 'authenticated' | 'unauthenticated' | 'error',
    user: null as {
      id: string;
      email: string;
      emailVerified: boolean;
      role?: 'user' | 'editor' | 'admin';
      googleLinked?: boolean;
    } | null,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({ ...state, logout, bootstrap }),
}));

vi.mock('@/features/auth/api/auth-api', () => ({
  getAuthCapabilities: vi.fn(),
}));

const getCapabilities = vi.mocked(getAuthCapabilities);

beforeEach(() => {
  vi.clearAllMocks();
  state.status = 'unknown';
  state.user = null;
  // Unresolved by default so tests that don't exercise Google avoid a
  // post-render capability state update; Google tests resolve it explicitly.
  getCapabilities.mockReturnValue(new Promise(() => {}));
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

  it('shows Google as connected when linked (read-only, no action)', async () => {
    state.status = 'authenticated';
    state.user = { id: 'u1', email: 'a@example.com', emailVerified: true, googleLinked: true };
    getCapabilities.mockResolvedValue({ google: true });

    render(<AccountClient />);

    expect(await screen.findByText('Susieta')).toBeInTheDocument();
    expect(screen.getByText('Google paskyra')).toBeInTheDocument();
    // Linking is automatic on Google login; no user action is offered.
    expect(screen.queryByRole('button', { name: /Susieti/i })).not.toBeInTheDocument();
  });

  it('shows Google as not connected when not linked', async () => {
    state.status = 'authenticated';
    state.user = { id: 'u1', email: 'a@example.com', emailVerified: true, googleLinked: false };
    getCapabilities.mockResolvedValue({ google: true });

    render(<AccountClient />);

    expect(await screen.findByText('Nesusieta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Susieti/i })).not.toBeInTheDocument();
  });

  it('hides the Google row when Google is unavailable', async () => {
    state.status = 'authenticated';
    state.user = { id: 'u1', email: 'a@example.com', emailVerified: true, googleLinked: false };
    getCapabilities.mockResolvedValue({ google: false });
    render(<AccountClient />);

    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    expect(screen.queryByText('Google paskyra')).not.toBeInTheDocument();
  });
});
