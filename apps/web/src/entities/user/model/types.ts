/**
 * Account roles as exposed by the API (lowercase wire values). `editor` is
 * reserved for future editorial capabilities and grants no administration
 * access. The backend is always the authority; the client uses this only for UX.
 */
export const USER_ROLES = ['user', 'editor', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Authenticated user identity as exposed by the API. This is the frontend's
 * user-domain model; it deliberately contains no auth-flow/request types.
 */
export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  /** Whether a Google identity is explicitly linked to this account. */
  googleLinked?: boolean;
}
