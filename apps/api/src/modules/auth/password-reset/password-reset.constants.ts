/**
 * Password-reset baseline. Kept as named constants so the TTL can be moved to
 * configuration cleanly later without touching business logic.
 */
export const PASSWORD_RESET_TTL_HOURS = 1;

/** Public frontend route that consumes the reset token. */
export const PASSWORD_RESET_ROUTE = '/atkurti-slaptazodi';
