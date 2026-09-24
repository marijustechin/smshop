import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminArea } from './admin-area';
import { AdminDashboardView } from './admin-dashboard-view';
import { AdminUsersView } from './admin-users-view';

const hoisted = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  pathname: '/administravimas/naudotojai' as string,
  state: {
    status: 'unknown' as 'unknown' | 'authenticated' | 'unauthenticated' | 'error',
    user: null as {
      id: string;
      email: string;
      emailVerified: boolean;
      role: 'user' | 'editor' | 'admin';
    } | null,
    bootstrap: vi.fn(),
    authedRequest: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: hoisted.replace, push: hoisted.push }),
  usePathname: () => hoisted.pathname,
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => hoisted.state,
}));

function setViewport(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function signIn(role: 'user' | 'editor' | 'admin' = 'admin') {
  hoisted.state.status = 'authenticated';
  hoisted.state.user = {
    id: 'a1',
    email: 'admin@example.com',
    emailVerified: true,
    role,
  };
}

beforeEach(() => {
  hoisted.state.status = 'unknown';
  hoisted.state.user = null;
  hoisted.replace.mockReset();
  hoisted.push.mockReset();
  hoisted.state.bootstrap.mockReset();
  hoisted.state.authedRequest.mockReset();
  hoisted.pathname = '/administravimas/naudotojai';
  setViewport(true);
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
    signIn('user');
    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    expect(screen.getByText('Neturite prieigos')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN CONTENT')).toBeNull();
  });

  it('does not render the public storefront header inside the admin shell', () => {
    signIn('admin');
    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    expect(screen.getByText('ADMIN CONTENT')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Atidaryti meniu' })).toBeNull();
  });
});

describe('AdminArea shell (desktop)', () => {
  it('renders the sidebar identity, navigation, active state, and page title', () => {
    signIn('admin');
    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    expect(screen.getByText('ADMIN CONTENT')).toBeInTheDocument();
    // Sidebar identity.
    expect(screen.getByText('Administratorius')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Šokolado meistrai' }).getAttribute('src')).toContain(
      'sokolado-meistrai-logo-creme',
    );
    // Navigation with active state.
    expect(screen.getByRole('link', { name: 'Suvestinė' })).toHaveAttribute(
      'href',
      '/administravimas',
    );
    const usersLink = screen.getByRole('link', { name: 'Naudotojai' });
    expect(usersLink).toHaveAttribute('href', '/administravimas/naudotojai');
    expect(usersLink).toHaveAttribute('aria-current', 'page');
    expect(within(usersLink).getByTestId('admin-nav-active-accent')).toBeInTheDocument();
    // Storefront link and page title in the top bar.
    expect(screen.getByRole('link', { name: 'Į parduotuvę' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('heading', { name: 'Naudotojai' })).toBeInTheDocument();
  });

  it('marks the dashboard route active with the Suvestinė title', () => {
    signIn('admin');
    hoisted.pathname = '/administravimas';
    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    expect(screen.getByRole('heading', { name: 'Suvestinė' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Suvestinė' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Naudotojai' })).not.toHaveAttribute('aria-current');
  });
});

describe('AdminArea shell (narrow screens)', () => {
  it('keeps navigation behind a temporary overlay that opens and closes', async () => {
    setViewport(false);
    signIn('admin');
    const user = userEvent.setup();
    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    // No persistent sidebar; navigation is reachable through the toggle.
    expect(screen.queryByRole('link', { name: 'Suvestinė' })).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Atidaryti administravimo meniu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    const dialog = screen.getByRole('dialog', { name: 'Administravimo meniu' });
    expect(within(dialog).getByRole('link', { name: 'Suvestinė' })).toHaveAttribute(
      'href',
      '/administravimas',
    );
    expect(within(dialog).getByRole('link', { name: 'Naudotojai' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the temporary navigation when the overlay is clicked', async () => {
    setViewport(false);
    signIn('admin');
    const user = userEvent.setup();
    render(
      <AdminArea>
        <div>ADMIN CONTENT</div>
      </AdminArea>,
    );

    await user.click(screen.getByRole('button', { name: 'Atidaryti administravimo meniu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('admin-nav-overlay'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Admin child views within the shell', () => {
  it('loads users through the authenticated request function', async () => {
    signIn('admin');
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

  it('loads the dashboard summary through the authenticated request function', async () => {
    signIn('admin');
    hoisted.state.authedRequest.mockResolvedValue({
      totalUsers: 4,
      verifiedUsers: 3,
      roleCounts: { user: 2, editor: 1, admin: 1 },
      recentUsers: [
        {
          id: 'u1',
          email: 'member@example.com',
          emailVerified: true,
          role: 'user',
          createdAt: '2026-02-01T10:00:00.000Z',
          lastLoginAt: null,
        },
      ],
    });

    render(<AdminDashboardView />);

    expect(await screen.findByText('Naudotojai iš viso')).toBeInTheDocument();
    expect(hoisted.state.authedRequest).toHaveBeenCalledWith('/api/admin/dashboard/summary');
  });
});
