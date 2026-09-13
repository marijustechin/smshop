export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  verificationEmailSent: boolean;
}

export interface RefreshResponse {
  accessToken: string;
}

/**
 * `unknown`           — bootstrap has not completed yet.
 * `authenticated`     — a confirmed valid session.
 * `unauthenticated`   — the backend confirmed there is no valid session (401).
 * `error`             — bootstrap could not be completed due to a transient or
 *                       infrastructure failure; the session state is unknown and
 *                       must not be treated as logged out.
 */
export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated' | 'error';
