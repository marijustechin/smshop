import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PublicLayout from './layout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ status: 'unauthenticated', user: null, logout: vi.fn() }),
}));

describe('PublicLayout', () => {
  it('renders the shared public header once around the page content', () => {
    render(
      <PublicLayout>
        <div>PAGE CONTENT</div>
      </PublicLayout>,
    );

    expect(screen.getByText('PAGE CONTENT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atidaryti meniu' })).toBeInTheDocument();
    // The brand logo is provided by the shared header, exactly once.
    expect(screen.getAllByRole('img', { name: 'Šokolado meistrai' })).toHaveLength(1);
  });
});
