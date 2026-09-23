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

  it('requires confirmation before deleting a user', async () => {
    requestMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE') {
        return undefined;
      }
      return paged([makeUser()]);
    });
    const user = userEvent.setup();

    render(<UsersManager request={request} currentUserId="admin-1" />);
    const tableView = await table();
    await tableView.findByText('a@example.com');

    await user.click(tableView.getByRole('button', { name: 'Šalinti' }));
    const deleteCall = () =>
      requestMock.mock.calls.find(([, options]) => options?.method === 'DELETE');
    expect(deleteCall()).toBeUndefined();
    expect(tableView.getByText('Tikrai šalinti?')).toBeInTheDocument();

    await user.click(tableView.getByRole('button', { name: 'Taip, šalinti' }));
    await waitFor(() => expect(deleteCall()).toBeDefined());
    expect(deleteCall()?.[0]).toBe('/api/admin/users/u-1');
    expect(await screen.findByText(/Naudotojas pašalintas/)).toBeInTheDocument();
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
