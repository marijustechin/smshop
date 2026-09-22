import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GoogleAuthButton } from './google-auth-button';

vi.mock('@/features/auth/api/auth-api', () => ({
  getAuthCapabilities: vi.fn(),
  googleStartUrl: () => 'http://localhost:3100/api/auth/google',
}));

import { getAuthCapabilities } from '@/features/auth/api/auth-api';

const getCapabilities = vi.mocked(getAuthCapabilities);

const LABEL = 'Prisijungti su Google';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GoogleAuthButton', () => {
  it('renders nothing while the capability is unknown', () => {
    getCapabilities.mockReturnValue(new Promise(() => {}));
    render(<GoogleAuthButton label={LABEL} />);

    expect(screen.queryByRole('link', { name: 'Prisijungti su Google' })).not.toBeInTheDocument();
  });

  it('renders the existing OAuth start route when Google is available', async () => {
    getCapabilities.mockResolvedValue({ google: true });
    render(<GoogleAuthButton label={LABEL} />);

    const link = await screen.findByRole('link', { name: 'Prisijungti su Google' });
    expect(link).toHaveAttribute('href', 'http://localhost:3100/api/auth/google');
    expect(screen.getByText('arba')).toBeInTheDocument();
  });

  it('hides the action when Google is unavailable', async () => {
    getCapabilities.mockResolvedValue({ google: false });
    render(<GoogleAuthButton label={LABEL} />);

    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Prisijungti su Google' })).not.toBeInTheDocument();
    expect(screen.queryByText('arba')).not.toBeInTheDocument();
  });

  it('fails closed when the capability cannot be determined', async () => {
    getCapabilities.mockRejectedValue(new Error('network error'));
    render(<GoogleAuthButton label={LABEL} />);

    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Prisijungti su Google' })).not.toBeInTheDocument();
  });
});
