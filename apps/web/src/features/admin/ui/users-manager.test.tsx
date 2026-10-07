import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/shared/api/client';
import { UsersManager } from './users-manager';
import type { AdminUser, AuthedRequest, PaginatedUsers } from '../model/types';

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u-1',
    email: 'a@example.com',
    emailVerified: true,
    role: 'user',
    createdAt: '2026-01-02T10:00:00.000Z',
    lastLoginAt: null,
    ...overrides,
  };
}

function paged(items: AdminUser[]): PaginatedUsers {
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 };
}

const requestMock = vi.fn();
const request = requestMock as unknown as AuthedRequest;

async function table() {
  return within(await screen.findByTestId('users-table'));
}

beforeEach(() => {
  requestMock.mockReset();
});

describe('UsersManager', () => {
  it('lists users returned by the API with safe fields', async () => {
    requestMock.mockResolvedValue(
      paged([makeUser(), makeUser({ id: 'u-2', email: 'b@example.com', role: 'editor' })]),
    );

    render(<UsersManager request={request} currentUserId="admin-1" />);

    expect(await screen.findAllByText('a@example.com')).not.toHaveLength(0);
    expect(await screen.findAllByText('b@example.com')).not.toHaveLength(0);
    expect((await table()).getAllByText('Redaktorius').length).toBeGreaterThan(0);
    expect((await table()).getAllByText('Pirkėjas').length).toBeGreaterThan(0);
  });

  it('shows Lithuanian role labels while keeping the technical role values', async () => {
    requestMock.mockResolvedValue(paged([makeUser()]));

    render(<UsersManager request={request} currentUserId="admin-1" />);
    const tableView = await table();
    const select = await tableView.findByLabelText('Vaidmuo naudotojui a@example.com');
    const options = within(select).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      'Pirkėjas',
      'Redaktorius',
      'Administratorius',
    ]);
    expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual([
      'user',
      'editor',
      'admin',
    ]);
  });

  it('uses an accessible destructive delete icon instead of a textual action', async () => {
    requestMock.mockResolvedValue(paged([makeUser()]));

    render(<UsersManager request={request} currentUserId="admin-1" />);
    const tableView = await table();
    const deleteButton = tableView.getByRole('button', { name: 'Pašalinti naudotoją' });

    expect(deleteButton.querySelector('svg')).not.toBeNull();
    expect(tableView.queryByRole('button', { name: 'Šalinti' })).toBeNull();
  });

  it('changes another user role through the API', async () => {
    requestMock.mockImplementation(
      async (path: string, options?: { method?: string; body?: unknown }) => {
        if (options?.method === 'PATCH') {
          return makeUser({ role: 'editor' });
        }
        return paged([makeUser()]);
      },
    );
    const user = userEvent.setup();

    render(<UsersManager request={request} currentUserId="admin-1" />);
    const tableView = await table();
    const select = await tableView.findByLabelText('Vaidmuo naudotojui a@example.com');

    await user.selectOptions(select, 'editor');
    await user.click(tableView.getByRole('button', { name: 'Išsaugoti' }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith('/api/admin/users/u-1/role', {
        method: 'PATCH',
        body: { role: 'editor' },
      }),
    );
    expect(await screen.findByText(/Vaidmuo atnaujintas/)).toBeInTheDocument();
  });

  it('opens a dialog, then deletes on confirmation and refreshes the list', async () => {
    let deleted = false;
    requestMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE') {
        deleted = true;
        return undefined;
      }
      return deleted ? paged([]) : paged([makeUser()]);
    });
    const user = userEvent.setup();

    render(<UsersManager request={request} currentUserId="admin-1" />);
    const tableView = await table();
    await tableView.findByText('a@example.com');

    await user.click(tableView.getByRole('button', { name: 'Pašalinti naudotoją' }));

    const dialog = screen.getByRole('alertdialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Pašalinti naudotoją?' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Bus pašalintas naudotojas a@example\.com\./),
    ).toBeInTheDocument();
    // The row itself does not expand into an inline confirmation.
    expect(screen.queryByText('Tikrai šalinti?')).toBeNull();

    const deleteCall = () =>
      requestMock.mock.calls.find(([, options]) => options?.method === 'DELETE');
    expect(deleteCall()).toBeUndefined();

    await user.click(within(dialog).getByRole('button', { name: 'Pašalinti' }));
    await waitFor(() => expect(deleteCall()).toBeDefined());
    expect(deleteCall()?.[0]).toBe('/api/admin/users/u-1');

    // Success: dialog closes, list refreshes immediately, notice shown, no error.
    expect(await screen.findByText(/Naudotojas pašalintas/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('a@example.com')).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByText('Įvyko netikėta klaida. Bandykite dar kartą.')).toBeNull();
  });

  it('does not delete when the confirmation dialog is cancelled', async () => {
    requestMock.mockResolvedValue(paged([makeUser()]));
    const user = userEvent.setup();

    render(<UsersManager request={request} currentUserId="admin-1" />);
    const tableView = await table();
    await user.click(await tableView.findByRole('button', { name: 'Pašalinti naudotoją' }));

    await user.click(screen.getByRole('button', { name: 'Atšaukti' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(
      requestMock.mock.calls.find(([, options]) => options?.method === 'DELETE'),
    ).toBeUndefined();
  });

  it('keeps the dialog open with an actionable error when deletion fails', async () => {
    requestMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE') {
        throw new ApiError(409, 'conflict', 'LAST_ADMIN');
      }
      return paged([makeUser()]);
    });
    const user = userEvent.setup();

    render(<UsersManager request={request} currentUserId="admin-1" />);
    const tableView = await table();
    await user.click(await tableView.findByRole('button', { name: 'Pašalinti naudotoją' }));
    await user.click(screen.getByRole('button', { name: 'Pašalinti' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(
        'Paskutinio administratoriaus pašalinti arba sumažinti teisių negalima.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Įvyko netikėta klaida. Bandykite dar kartą.')).toBeNull();
  });

  it('shows an empty state when there are no users', async () => {
    requestMock.mockResolvedValue(paged([]));

    render(<UsersManager request={request} currentUserId="admin-1" />);

    expect(await screen.findByText('Naudotojų nerasta.')).toBeInTheDocument();
  });

  it('maps an authorization failure to a clear message', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden', 'INSUFFICIENT_ROLE'));

    render(<UsersManager request={request} currentUserId="admin-1" />);

    expect(await screen.findByText('Neturite teisės atlikti šio veiksmo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bandyti dar kartą' })).toBeInTheDocument();
  });

  it('does not offer administration actions for the current admin row', async () => {
    requestMock.mockResolvedValue(
      paged([makeUser({ id: 'admin-1', email: 'admin@example.com', role: 'admin' })]),
    );

    render(<UsersManager request={request} currentUserId="admin-1" />);

    const tableView = await table();
    expect(await tableView.findByText('Tai jūsų paskyra — keisti negalima.')).toBeInTheDocument();
    expect(tableView.queryByLabelText('Vaidmuo naudotojui admin@example.com')).toBeNull();
  });
});
