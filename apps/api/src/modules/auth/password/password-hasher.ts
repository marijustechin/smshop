/**
 * Password hashing boundary. The Auth domain depends on this interface, not on
 * a specific hashing library, so the algorithm/implementation can change (and
 * hashing parameters can be upgraded) without touching callers.
 */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(passwordHash: string, plainPassword: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
