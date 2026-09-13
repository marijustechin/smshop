process.env.DATABASE_URL ??= 'postgresql://smshop:smshop@localhost:5432/smshop';
process.env.WEB_ORIGIN ??= 'http://localhost:3000';
process.env.JWT_ACCESS_SECRET ??= 'test-only-jwt-access-secret-value-32-chars';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.AUTH_SESSION_TTL ??= '7d';
