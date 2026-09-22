process.env.DATABASE_URL ??= 'postgresql://smshop:smshop@localhost:5432/smshop';
process.env.WEB_ORIGIN ??= 'http://localhost:3101';
process.env.JWT_ACCESS_SECRET ??= 'test-only-jwt-access-secret-value-32-chars';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.AUTH_SESSION_TTL ??= '7d';

// Test-only, non-secret Google config: the test harness replaces the OIDC
// provider with a stub (no network), but the app config must be complete so the
// callback can build its URL. Values are placeholders and never contact Google.
process.env.GOOGLE_CLIENT_ID ??= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL ??= 'http://localhost:3100/api/auth/google/callback';
