import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RegisterPage from './page';

const hoisted = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: hoisted.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/registracija',
}));

vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'u1', email: 'a@example.com', emailVerified: true, role: 'user' },
    login: vi.fn(),
    logout: vi.fn(),
    bootstrap: vi.fn(),
    refreshAccessToken: vi.fn(),
    authedRequest: vi.fn(),
  }),
}));

beforeEach(() => {
  hoisted.replace.mockReset();
});

describe('Registration page when authenticated', () => {
  it('redirects to the account page instead of showing the registration form', async () => {
    render(<RegisterPage />);

    await waitFor(() => expect(hoisted.replace).toHaveBeenCalledWith('/paskyra'));
    expect(screen.queryByRole('button', { name: 'Registruotis' })).toBeNull();
  });
});
