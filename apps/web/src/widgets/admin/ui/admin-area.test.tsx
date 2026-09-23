import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminArea } from './admin-area';
import { AdminUsersView } from './admin-users-view';

const hoisted = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  state: {
    status: 'unknown' as 'unknown' | 'authenticated' | 'unauthenticated' | 'error',
    user: null as {
      id: string;
      email: string;
      emailVerified: boolean;
      role: 'user' | 'editor' | 'admin';
      googleLinked?: boolean;
    } | null,
    bootstrap: vi.fn(),
    authedRequest: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: hoisted.replace, push: hoisted.push }),
  usePathname: () => '/administravimas/naudotojai',
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => hoisted.state,
}));

beforeEach(() => {
  hoisted.state.status = 'unknown';
  hoisted.state.user = null;
  hoisted.replace.mockReset();
  hoisted.push.mockReset();
  hoisted.state.bootstrap.mockReset();
  hoisted.state.authedRequest.mockReset();
});

describe('AdminArea access handling', () => {
  it('shows a loading state while the session is unknown', () => {
    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    expect(screen.getByText('Kraunama…')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN CONTENT')).toBeNull();
  });

  it('redirects guests to login with a preserved returnTo', async () => {
    hoisted.state.status = 'unauthenticated';

    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    await waitFor(() =>
      expect(hoisted.replace).toHaveBeenCalledWith(
        '/prisijungti?returnTo=%2Fadministravimas%2Fnaudotojai',
      ),
    );
  });

  it('shows an access-denied state for an authenticated non-admin', () => {
    hoisted.state.status = 'authenticated';
    hoisted.state.user = { id: 'u1', email: 'user@example.com', emailVerified: true, role: 'user' };

    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    expect(screen.getByText('Neturite prieigos')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN CONTENT')).toBeNull();
  });

  it('renders the shell and content for an admin, with the active nav item', () => {
    hoisted.state.status = 'authenticated';
    hoisted.state.user = {
      id: 'a1',
      email: 'admin@example.com',
      emailVerified: true,
      role: 'admin',
    };

    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    expect(screen.getByText('ADMIN CONTENT')).toBeInTheDocument();
    const navLink = screen.getByRole('link', { name: 'Naudotojai' });
    expect(navLink).toHaveAttribute('aria-current', 'page');
  });
});

describe('AdminUsersView', () => {
  it('loads users through the authenticated request function', async () => {
    hoisted.state.status = 'authenticated';
    hoisted.state.user = {
      id: 'a1',
      email: 'admin@example.com',
      emailVerified: true,
      role: 'admin',
    };
    hoisted.state.authedRequest.mockResolvedValue({
      items: [
        {
          id: 'u1',
          email: 'member@example.com',
          emailVerified: true,
          role: 'user',
          createdAt: '2026-01-02T10:00:00.000Z',
          lastLoginAt: null,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    render(<AdminUsersView />);

    expect(await screen.findAllByText('member@example.com')).not.toHaveLength(0);
    expect(hoisted.state.authedRequest).toHaveBeenCalledWith('/api/admin/users?page=1&pageSize=20');
  });
});
