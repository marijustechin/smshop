import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifyEmailClient } from './verify-email-client';
import { ApiError } from '@/lib/api/client';
import * as api from '@/lib/auth/api';

const { searchParams } = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

vi.mock('@/lib/auth/api', () => ({
  verifyEmail: vi.fn(),
}));

const verifyEmail = vi.mocked(api.verifyEmail);

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
});

describe('VerifyEmailClient', () => {
  it('verifies a valid token and shows success', async () => {
    searchParams.set('token', 'valid-token');
    verifyEmail.mockResolvedValue({ verified: true });

    render(<VerifyEmailClient />);

    expect(await screen.findByText(/El\. pašto adresas patvirtintas/i)).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledWith('valid-token');
  });

  it('shows a missing-token state', async () => {
    render(<VerifyEmailClient />);
    expect(await screen.findByText(/Trūksta patvirtinimo nuorodos/i)).toBeInTheDocument();
  });

  it.each([
    [400, 'bad-token', /Nuoroda netinkama/i],
    [410, 'expired-token', /galiojimo laikas baigėsi/i],
    [409, 'used-token', /jau buvo panaudota/i],
  ])('maps status %i to its message', async (status, token, pattern) => {
    searchParams.set('token', token as string);
    verifyEmail.mockRejectedValue(new ApiError(status as number, 'err'));

    render(<VerifyEmailClient />);

    expect(await screen.findByText(pattern)).toBeInTheDocument();
  });

  it('does not consume the same token twice across re-renders', async () => {
    searchParams.set('token', 'dedupe-token');
    verifyEmail.mockResolvedValue({ verified: true });

    const { rerender } = render(<VerifyEmailClient />);
    await screen.findByText(/El\. pašto adresas patvirtintas/i);
    rerender(<VerifyEmailClient />);
    rerender(<VerifyEmailClient />);

    expect(verifyEmail).toHaveBeenCalledTimes(1);
  });
});
