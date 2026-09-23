import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteHeader } from '../index';

type Role = 'user' | 'editor' | 'admin';

const hoisted = vi.hoisted(() => ({
  pathname: '/' as string,
  replace: vi.fn(),
  state: {
    status: 'unauthenticated' as 'unknown' | 'authenticated' | 'unauthenticated' | 'error',
    user: null as {
      id: string;
      email: string;
      emailVerified: boolean;
      role: 'user' | 'editor' | 'admin';
    } | null,
    logout: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => hoisted.pathname,
  useRouter: () => ({ replace: hoisted.replace, push: vi.fn() }),
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

function signIn(role: Role) {
  hoisted.state.status = 'authenticated';
  hoisted.state.user = { id: 'u1', email: `${role}@example.com`, emailVerified: true, role };
}

async function openDrawer(user = userEvent.setup()) {
  await user.click(screen.getByRole('button', { name: 'Atidaryti meniu' }));
  return screen.getByRole('dialog');
}

async function openUserMenu(user = userEvent.setup()) {
  await user.click(screen.getByRole('button', { name: 'Paskyros meniu' }));
  return screen.getByRole('menu');
}

beforeEach(() => {
  hoisted.state.status = 'unauthenticated';
  hoisted.state.user = null;
  hoisted.state.logout.mockReset();
  hoisted.pathname = '/';
  hoisted.replace.mockReset();
  setViewport(false);
});

describe('SiteHeader branding and hamburger menu', () => {
  it('renders the chocolate logo in the light header', () => {
    render(<SiteHeader />);

    const logo = screen.getByRole('img', { name: 'Šokolado meistrai' });
    expect(logo.getAttribute('src') ?? '').toContain('sokolado-meistrai-logo-chocolate');
  });

  it('opens and closes the drawer with the hamburger and close controls', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const trigger = screen.getByRole('button', { name: 'Atidaryti meniu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Uždaryti meniu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the drawer on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const trigger = screen.getByRole('button', { name: 'Atidaryti meniu' });
    await user.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes the drawer when the overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole('button', { name: 'Atidaryti meniu' }));
    await screen.findByRole('dialog');

    await user.click(screen.getByTestId('site-menu-overlay'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus into the drawer on open and exposes modal semantics', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const trigger = screen.getByRole('button', { name: 'Atidaryti meniu' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-controls', 'site-menu');

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Uždaryti meniu' })).toHaveFocus(),
    );
  });

  it('locks body scrolling while the drawer is open', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole('button', { name: 'Atidaryti meniu' }));
    await screen.findByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByRole('button', { name: 'Uždaryti meniu' }));
    expect(document.body.style.overflow).toBe('');
  });
});

describe('SiteHeader drawer navigation', () => {
  it('shows guest links only for a guest', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const drawer = await openDrawer(user);
    const labels = within(drawer)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Pagrindinis', 'Prisijungti', 'Registruotis']);
    expect(within(drawer).queryByRole('button', { name: 'Atsijungti' })).toBeNull();
    expect(within(drawer).queryByRole('link', { name: 'Mano paskyra' })).toBeNull();
    expect(within(drawer).queryByRole('link', { name: 'Administravimas' })).toBeNull();
  });

  it('shows account links for an authenticated user and hides guest links', async () => {
    signIn('user');
    const user = userEvent.setup();
    render(<SiteHeader />);

    const drawer = await openDrawer(user);
    const labels = within(drawer)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Pagrindinis', 'Mano paskyra']);
    expect(within(drawer).queryByRole('link', { name: 'Prisijungti' })).toBeNull();
    expect(within(drawer).queryByRole('link', { name: 'Registruotis' })).toBeNull();
    expect(within(drawer).queryByRole('link', { name: 'Administravimas' })).toBeNull();
    expect(within(drawer).getByRole('button', { name: 'Atsijungti' })).toBeInTheDocument();
  });

  it('treats an editor like a normal user in the drawer', async () => {
    signIn('editor');
    const user = userEvent.setup();
    render(<SiteHeader />);

    const drawer = await openDrawer(user);
    expect(within(drawer).queryByRole('link', { name: 'Administravimas' })).toBeNull();
    expect(within(drawer).queryByRole('link', { name: 'Prisijungti' })).toBeNull();
  });

  it('shows the administration entry for an admin only', async () => {
    signIn('admin');
    const user = userEvent.setup();
    render(<SiteHeader />);

    const drawer = await openDrawer(user);
    const labels = within(drawer)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Pagrindinis', 'Administravimas', 'Mano paskyra']);
    expect(within(drawer).getByRole('link', { name: 'Administravimas' })).toHaveAttribute(
      'href',
      '/administravimas',
    );
  });

  it('marks the current route as active with aria-current and a structural accent', async () => {
    signIn('user');
    hoisted.pathname = '/paskyra';
    const user = userEvent.setup();
    render(<SiteHeader />);

    const drawer = await openDrawer(user);
    const active = within(drawer).getByRole('link', { name: 'Mano paskyra' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(within(active).getByTestId('drawer-active-accent')).toBeInTheDocument();

    const inactive = within(drawer).getByRole('link', { name: 'Pagrindinis' });
    expect(inactive).not.toHaveAttribute('aria-current');
    expect(within(inactive).queryByTestId('drawer-active-accent')).toBeNull();
  });

  it('marks a nested administration route as active', async () => {
    signIn('admin');
    hoisted.pathname = '/administravimas/naudotojai';
    const user = userEvent.setup();
    render(<SiteHeader />);

    const drawer = await openDrawer(user);
    expect(within(drawer).getByRole('link', { name: 'Administravimas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(drawer).getByRole('link', { name: 'Pagrindinis' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('closes the drawer when a navigation link is activated', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const drawer = await openDrawer(user);
    await user.click(within(drawer).getByRole('link', { name: 'Pagrindinis' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('logs out from the drawer and reflects the guest state afterwards', async () => {
    signIn('user');
    const user = userEvent.setup();
    const { rerender } = render(<SiteHeader />);

    const drawer = await openDrawer(user);
    await user.click(within(drawer).getByRole('button', { name: 'Atsijungti' }));

    expect(hoisted.state.logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(hoisted.replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    hoisted.state.status = 'unauthenticated';
    hoisted.state.user = null;
    rerender(<SiteHeader />);

    const guestDrawer = await openDrawer(user);
    expect(within(guestDrawer).getByRole('link', { name: 'Prisijungti' })).toBeInTheDocument();
    expect(within(guestDrawer).getByRole('link', { name: 'Registruotis' })).toBeInTheDocument();
    expect(within(guestDrawer).queryByRole('button', { name: 'Atsijungti' })).toBeNull();
  });
});

describe('SiteHeader actions', () => {
  it('shows a text login action for guests and no account dropdown', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Prisijungti' })).toHaveAttribute(
      'href',
      '/prisijungti',
    );
    expect(screen.queryByRole('button', { name: 'Paskyros meniu' })).toBeNull();
  });

  it('renders the direct administration action on desktop for an admin', () => {
    setViewport(true);
    signIn('admin');
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Administravimas' })).toHaveAttribute(
      'href',
      '/administravimas',
    );
  });

  it('does not render the textual administration action at mobile width', () => {
    setViewport(false);
    signIn('admin');
    render(<SiteHeader />);

    expect(screen.queryByRole('link', { name: 'Administravimas' })).toBeNull();
  });

  it('never renders the administration action for non-admins', () => {
    setViewport(true);
    signIn('user');
    render(<SiteHeader />);

    expect(screen.queryByRole('link', { name: 'Administravimas' })).toBeNull();
  });
});

describe('SiteHeader account dropdown', () => {
  it('shows only account items for a user and closes on item selection', async () => {
    setViewport(true);
    signIn('user');
    const user = userEvent.setup();
    render(<SiteHeader />);

    const menu = await openUserMenu(user);
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Mano paskyra', 'Atsijungti']);
    expect(within(menu).queryByRole('menuitem', { name: 'Administravimas' })).toBeNull();

    await user.click(within(menu).getByRole('menuitem', { name: 'Mano paskyra' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers the administration entry in the dropdown on mobile for an admin', async () => {
    setViewport(false);
    signIn('admin');
    const user = userEvent.setup();
    render(<SiteHeader />);

    const menu = await openUserMenu(user);
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Administravimas', 'Mano paskyra', 'Atsijungti']);
  });

  it('does not duplicate the administration entry in the dropdown on desktop', async () => {
    setViewport(true);
    signIn('admin');
    const user = userEvent.setup();
    render(<SiteHeader />);

    const menu = await openUserMenu(user);
    expect(within(menu).queryByRole('menuitem', { name: 'Administravimas' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Mano paskyra' })).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    setViewport(true);
    signIn('user');
    const user = userEvent.setup();
    render(<SiteHeader />);

    const trigger = screen.getByRole('button', { name: 'Paskyros meniu' });
    await openUserMenu(user);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes on an outside click', async () => {
    setViewport(true);
    signIn('user');
    const user = userEvent.setup();
    render(<SiteHeader />);
    await openUserMenu(user);

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('updates the header to the guest action after logout from the dropdown', async () => {
    setViewport(true);
    signIn('user');
    const user = userEvent.setup();
    const { rerender } = render(<SiteHeader />);

    const menu = await openUserMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Atsijungti' }));
    expect(hoisted.state.logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(hoisted.replace).toHaveBeenCalledWith('/'));

    hoisted.state.status = 'unauthenticated';
    hoisted.state.user = null;
    rerender(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Prisijungti' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Paskyros meniu' })).toBeNull();
  });
});
