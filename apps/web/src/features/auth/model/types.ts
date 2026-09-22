export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  /** Whether a Google identity is explicitly linked to this account. */
  googleLinked?: boolean;
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
 * Non-secret auth capabilities reported by the backend. The frontend uses this
 * to avoid advertising an action the deployed backend cannot perform. It only
 * covers optional/provider-backed actions; email verification and password
 * recovery are permanent product capabilities and are always shown.
 */
export interface AuthCapabilities {
  google: boolean;
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
