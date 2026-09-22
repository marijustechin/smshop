/**
 * Authenticated user identity as exposed by the API. This is the frontend's
 * user-domain model; it deliberately contains no auth-flow/request types.
 */
export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  /** Whether a Google identity is explicitly linked to this account. */
  googleLinked?: boolean;
}
