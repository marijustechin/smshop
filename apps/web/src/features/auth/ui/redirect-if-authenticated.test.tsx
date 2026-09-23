import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RedirectIfAuthenticated } from './redirect-if-authenticated';

const hoisted = vi.hoisted(() => ({
  replace: vi.fn(),
  status: 'unknown' as 'unknown' | 'authenticated' | 'unauthenticated' | 'error',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: hoisted.replace, push: vi.fn() }),
}));

vi.mock('../model/auth-context', () => ({
  useAuth: () => ({ status: hoisted.status }),
}));

beforeEach(() => {
  hoisted.replace.mockReset();
  hoisted.status = 'unknown';
});

describe('RedirectIfAuthenticated', () => {
  it('renders a loading placeholder (no form) while the session is unknown', () => {
    render(
      <RedirectIfAuthenticated>
        <div>FORM</div>
      </RedirectIfAuthenticated>,
    );

    expect(screen.getByText('Kraunama…')).toBeInTheDocument();
    expect(screen.queryByText('FORM')).toBeNull();
    expect(hoisted.replace).not.toHaveBeenCalled();
  });

  it('renders the children for guests without redirecting', () => {
    hoisted.status = 'unauthenticated';

    render(
      <RedirectIfAuthenticated>
        <div>FORM</div>
      </RedirectIfAuthenticated>,
    );

    expect(screen.getByText('FORM')).toBeInTheDocument();
    expect(hoisted.replace).not.toHaveBeenCalled();
  });

  it('renders the children on a transient session error without redirecting', () => {
    hoisted.status = 'error';

    render(
      <RedirectIfAuthenticated>
        <div>FORM</div>
      </RedirectIfAuthenticated>,
    );

    expect(screen.getByText('FORM')).toBeInTheDocument();
    expect(hoisted.replace).not.toHaveBeenCalled();
  });

  it('redirects an authenticated user to the account page and hides the form', async () => {
    hoisted.status = 'authenticated';

    render(
      <RedirectIfAuthenticated>
        <div>FORM</div>
      </RedirectIfAuthenticated>,
    );

    await waitFor(() => expect(hoisted.replace).toHaveBeenCalledWith('/paskyra'));
    expect(screen.queryByText('FORM')).toBeNull();
  });
});
