import { apiRequest } from '@/lib/api/client';
import { apiUrl } from '@/lib/api/config';
import type { AuthUser, LoginResponse, RefreshResponse, RegisterResponse } from './types';

/** Typed wrappers around the backend auth endpoints. */

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function refresh(): Promise<RefreshResponse> {
  return apiRequest<RefreshResponse>('/api/auth/refresh', { method: 'POST' });
}

export function logout(): Promise<void> {
  return apiRequest<void>('/api/auth/logout', { method: 'POST' });
}

export function fetchMe(accessToken: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/api/auth/me', { accessToken });
}

export function register(email: string, password: string): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: { email, password },
  });
}

export function verifyEmail(token: string): Promise<{ verified: true }> {
  return apiRequest<{ verified: true }>('/api/auth/verify-email', {
    method: 'POST',
    body: { token },
  });
}

export function resendVerification(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/auth/resend-verification', {
    method: 'POST',
    body: { email },
  });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export function resetPassword(token: string, password: string): Promise<{ passwordReset: true }> {
  return apiRequest<{ passwordReset: true }>('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
}

/** Browser-navigation URL that starts the backend Google OAuth flow. */
export function googleStartUrl(): string {
  return apiUrl('/api/auth/google');
}
