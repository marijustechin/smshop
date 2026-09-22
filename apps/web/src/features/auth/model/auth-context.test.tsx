import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth-context';
import { ApiError } from '@/shared/api/client';
import * as api from '../api/auth-api';

vi.mock('../api/auth-api', () => ({
  refresh: vi.fn(),
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  googleStartUrl: vi.fn(),
}));

const mocked = vi.mocked(api);
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const user = { id: 'u1', email: 'a@example.com', emailVerified: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthProvider', () => {
  it('starts as unknown then becomes unauthenticated when refresh fails', async () => {
    mocked.refresh.mockRejectedValue(new ApiError(401, 'no session'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe('unknown');

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('bootstraps an authenticated session from the refresh cookie', async () => {
    mocked.refresh.mockResolvedValue({ accessToken: 'access-1' });
    mocked.fetchMe.mockResolvedValue(user);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual(user);
    expect(mocked.fetchMe).toHaveBeenCalledWith('access-1');
  });

  it('treats a network bootstrap failure as a recoverable error, not logged out', async () => {
    mocked.refresh.mockRejectedValue(new ApiError(0, 'network_error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('treats a 5xx bootstrap failure as a recoverable error', async () => {
    mocked.refresh.mockRejectedValue(new ApiError(503, 'Service Unavailable'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('treats a transient /me failure after a valid refresh as a recoverable error', async () => {
    mocked.refresh.mockResolvedValue({ accessToken: 'access-x' });
    mocked.fetchMe.mockRejectedValue(new ApiError(0, 'network_error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('can recover into authenticated state on retry', async () => {
    mocked.refresh.mockRejectedValueOnce(new ApiError(0, 'network_error'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('error'));

    mocked.refresh.mockResolvedValue({ accessToken: 'access-retry' });
    mocked.fetchMe.mockResolvedValue(user);
    await act(async () => {
      await result.current.bootstrap();
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual(user);
  });

  it('login establishes auth state from the response', async () => {
    mocked.refresh.mockRejectedValue(new ApiError(401, 'no session'));
    mocked.login.mockResolvedValue({ accessToken: 'access-2', user });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      await result.current.login('a@example.com', 'password');
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual(user);
  });

  it('logout clears auth state', async () => {
    mocked.refresh.mockResolvedValue({ accessToken: 'access-3' });
    mocked.fetchMe.mockResolvedValue(user);
    mocked.logout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });

  it('coordinates concurrent refreshes into a single request', async () => {
    mocked.refresh.mockRejectedValue(new ApiError(401, 'no session'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    mocked.refresh.mockClear();
    mocked.refresh.mockResolvedValue({ accessToken: 'access-4' });

    let first: Promise<string | null> | undefined;
    let second: Promise<string | null> | undefined;
    await act(async () => {
      first = result.current.refreshAccessToken();
      second = result.current.refreshAccessToken();
      await Promise.all([first, second]);
    });

    expect(mocked.refresh).toHaveBeenCalledTimes(1);
    await expect(first).resolves.toBe('access-4');
    await expect(second).resolves.toBe('access-4');
  });
});
