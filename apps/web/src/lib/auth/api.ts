import { apiRequest } from '@/shared/api/client';
import { apiUrl } from '@/shared/config/api';
import type {
  AuthCapabilities,
  AuthUser,
  LoginResponse,
  RefreshResponse,
  RegisterResponse,
} from './types';

/** Typed wrappers around the backend auth endpoints. */

/** Adds the optional Turnstile token to a protected request body. */
function withTurnstile<T extends object>(body: T, turnstileToken?: string | null): T {
  return turnstileToken ? { ...body, turnstileToken } : body;
}

export function login(
  email: string,
  password: string,
  turnstileToken?: string | null,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: withTurnstile({ email, password }, turnstileToken),
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

export function register(
  email: string,
  password: string,
  turnstileToken?: string | null,
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: withTurnstile({ email, password }, turnstileToken),
  });
}

export function verifyEmail(token: string): Promise<{ verified: true }> {
  return apiRequest<{ verified: true }>('/api/auth/verify-email', {
    method: 'POST',
    body: { token },
  });
}

export function resendVerification(
  email: string,
  turnstileToken?: string | null,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/auth/resend-verification', {
    method: 'POST',
    body: withTurnstile({ email }, turnstileToken),
  });
}

export function forgotPassword(
  email: string,
  turnstileToken?: string | null,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: withTurnstile({ email }, turnstileToken),
  });
}

export function resetPassword(token: string, password: string): Promise<{ passwordReset: true }> {
  return apiRequest<{ passwordReset: true }>('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
}

/** Non-secret auth capabilities the frontend may rely on. */
export function getAuthCapabilities(): Promise<AuthCapabilities> {
  return apiRequest<AuthCapabilities>('/api/auth/capabilities');
}

/** Browser-navigation URL that starts the backend Google OAuth flow. */
export function googleStartUrl(): string {
  return apiUrl('/api/auth/google');
}
