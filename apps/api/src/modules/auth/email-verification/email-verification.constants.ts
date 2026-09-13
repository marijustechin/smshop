/**
 * Email-verification baseline. Kept as named constants so the TTL can be moved
 * to configuration cleanly later without touching business logic.
 */
export const EMAIL_VERIFICATION_TTL_HOURS = 24;

/** Public frontend route that consumes the verification token. */
export const EMAIL_VERIFICATION_ROUTE = '/patvirtinti-el-pasta';
