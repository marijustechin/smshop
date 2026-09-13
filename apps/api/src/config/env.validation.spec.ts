import { describe, expect, it, vi } from 'vitest';
import { resolveSecretFiles, validateEnv } from './env.validation.js';

const validEnv = {
  DATABASE_URL: 'postgresql://smshop:smshop@localhost:5432/smshop',
};

describe('validateEnv', () => {
  it('accepts a minimal valid configuration and applies defaults', () => {
    const env = validateEnv(validEnv);

    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
  });

  it('accepts declared future Auth variables without requiring them', () => {
    const env = validateEnv({
      ...validEnv,
      WEB_ORIGIN: 'http://localhost:3000',
      API_ORIGIN: 'http://localhost:3001',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      GOOGLE_CLIENT_ID: 'client-id',
      SMTP_PORT: '2525',
    });

    expect(env.JWT_ACCESS_SECRET).toBe('a'.repeat(32));
    expect(env.SMTP_PORT).toBe(2525);
  });

  it('rejects a missing required variable', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-PostgreSQL DATABASE_URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost:3306/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a malformed numeric value', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'not-a-number' })).toThrow(/PORT/);
  });

  it('rejects a malformed origin', () => {
    expect(() => validateEnv({ ...validEnv, WEB_ORIGIN: 'not-a-url' })).toThrow(/WEB_ORIGIN/);
  });

  it('rejects a secret that is too short without exposing its value', () => {
    const secret = 'short-secret-value';

    try {
      validateEnv({ ...validEnv, JWT_ACCESS_SECRET: secret });
      throw new Error('expected validateEnv to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('JWT_ACCESS_SECRET');
      expect(message).not.toContain(secret);
    }
  });
});

describe('resolveSecretFiles', () => {
  it('reads a secret from a <NAME>_FILE path', () => {
    const readFile = vi.fn().mockReturnValue('file-secret-value\n');

    const resolved = resolveSecretFiles({ JWT_ACCESS_SECRET_FILE: '/run/secrets/jwt' }, readFile);

    expect(readFile).toHaveBeenCalledWith('/run/secrets/jwt');
    expect(resolved.JWT_ACCESS_SECRET).toBe('file-secret-value');
  });

  it('prefers a direct value over the file variant', () => {
    const readFile = vi.fn();

    const resolved = resolveSecretFiles(
      { JWT_ACCESS_SECRET: 'direct', JWT_ACCESS_SECRET_FILE: '/run/secrets/jwt' },
      readFile,
    );

    expect(readFile).not.toHaveBeenCalled();
    expect(resolved.JWT_ACCESS_SECRET).toBe('direct');
  });

  it('throws a clear error when the declared file cannot be read', () => {
    const readFile = vi.fn(() => {
      throw new Error('ENOENT');
    });

    expect(() => resolveSecretFiles({ SMTP_PASSWORD_FILE: '/missing' }, readFile)).toThrow(
      /SMTP_PASSWORD/,
    );
  });
});
