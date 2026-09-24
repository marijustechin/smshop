import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApiError } from '@/shared/api/client';
import { DashboardSummary } from './dashboard-summary';
import type { AdminDashboardSummary, AuthedRequest } from '../model/types';

function summary(overrides: Partial<AdminDashboardSummary> = {}): AdminDashboardSummary {
  return {
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
    ...overrides,
  };
}

describe('DashboardSummary', () => {
  it('shows a loading state before data arrives', () => {
    const request = (() => new Promise(() => {})) as unknown as AuthedRequest;
    render(<DashboardSummary request={request} />);

    expect(screen.getByText('Kraunama…')).toBeInTheDocument();
    expect(screen.queryByText('Naudotojai iš viso')).toBeNull();
  });

  it('renders the summary cards and recent users from real data', async () => {
    const request = vi.fn().mockResolvedValue(summary()) as unknown as AuthedRequest;
    render(<DashboardSummary request={request} />);

    expect(await screen.findByText('Naudotojai iš viso')).toBeInTheDocument();
    expect(screen.getByText('Patvirtinti el. paštai')).toBeInTheDocument();
    expect(screen.getByText('Administratoriai')).toBeInTheDocument();
    expect(screen.getByText('Redaktoriai')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('member@example.com')).toBeInTheDocument();
    expect(screen.getByText('Pirkėjas')).toBeInTheDocument();
    expect(screen.getByText('Patvirtintas')).toBeInTheDocument();

    expect(request).toHaveBeenCalledWith('/api/admin/dashboard/summary');
  });

  it('links to user management from both actions', async () => {
    const request = vi.fn().mockResolvedValue(summary()) as unknown as AuthedRequest;
    render(<DashboardSummary request={request} />);

    await screen.findByText('Naudotojai iš viso');
    const links = screen.getAllByRole('link', { name: 'Tvarkyti naudotojus' });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/administravimas/naudotojai');
    }
  });

  it('shows an empty state when there are no users', async () => {
    const request = vi.fn().mockResolvedValue(
      summary({
        totalUsers: 0,
        verifiedUsers: 0,
        roleCounts: { user: 0, editor: 0, admin: 0 },
        recentUsers: [],
      }),
    ) as unknown as AuthedRequest;
    render(<DashboardSummary request={request} />);

    expect(await screen.findByText('Naudotojų nerasta.')).toBeInTheDocument();
  });

  it('maps a failure to a clear error with retry', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(
        new ApiError(403, 'Forbidden', 'INSUFFICIENT_ROLE'),
      ) as unknown as AuthedRequest;
    render(<DashboardSummary request={request} />);

    expect(await screen.findByText('Neturite teisės atlikti šio veiksmo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bandyti dar kartą' })).toBeInTheDocument();
  });
});
