import { describe, expect, it, vi } from 'vitest';
import { resolveSecretFiles, validateEnv } from './env.validation.js';

const validEnv = {
  DATABASE_URL: 'postgresql://smshop:smshop@localhost:5432/smshop',
  WEB_ORIGIN: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('accepts a minimal valid configuration and applies defaults', () => {
    const env = validateEnv(validEnv);

    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.AUTH_SESSION_TTL).toBe('7d');
  });

  it('accepts optional future Auth variables without requiring them', () => {
    const env = validateEnv({ ...validEnv, API_ORIGIN: 'http://localhost:3001' });

    expect(env.API_ORIGIN).toBe('http://localhost:3001');
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.SMTP_HOST).toBeUndefined();
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

describe('SMTP / mail configuration', () => {
  const completeSmtp = {
    ...validEnv,
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'smtp-user',
    SMTP_PASSWORD: 'super-secret-password',
    MAIL_FROM: 'Šokolado meistrai <noreply@example.com>',
  };

  it('accepts a complete SMTP configuration and parses SMTP_SECURE as boolean', () => {
    const env = validateEnv(completeSmtp);

    expect(env.SMTP_SECURE).toBe(true);
    expect(env.SMTP_PORT).toBe(465);
    expect(env.MAIL_FROM).toBe(completeSmtp.MAIL_FROM);
  });

  it('parses SMTP_SECURE="false" as boolean false, not truthy', () => {
    const env = validateEnv({ ...completeSmtp, SMTP_SECURE: 'false' });

    expect(env.SMTP_SECURE).toBe(false);
  });

  it('treats empty SMTP placeholders as unset (mail disabled, no error)', () => {
    const env = validateEnv({
      ...validEnv,
      SMTP_HOST: '',
      SMTP_PORT: '',
      SMTP_SECURE: '',
      SMTP_USER: '',
      SMTP_PASSWORD: '',
      MAIL_FROM: '',
    });

    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.SMTP_SECURE).toBeUndefined();
  });

  it('rejects partial SMTP configuration with the missing variable named', () => {
    const { SMTP_PASSWORD, ...withoutPassword } = completeSmtp;

    try {
      validateEnv(withoutPassword);
      throw new Error('expected validateEnv to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('SMTP_PASSWORD');
      expect(message).not.toContain(SMTP_PASSWORD);
    }
  });

  it('rejects an invalid SMTP_SECURE value', () => {
    expect(() => validateEnv({ ...completeSmtp, SMTP_SECURE: 'yes' })).toThrow(/SMTP_SECURE/);
  });

  it('rejects a malformed MAIL_FROM sender', () => {
    expect(() => validateEnv({ ...completeSmtp, MAIL_FROM: 'not an address' })).toThrow(
      /MAIL_FROM/,
    );
  });

  it('accepts a bare email MAIL_FROM', () => {
    const env = validateEnv({ ...completeSmtp, MAIL_FROM: 'noreply@example.com' });

    expect(env.MAIL_FROM).toBe('noreply@example.com');
  });
});

describe('Google OAuth configuration', () => {
  const completeGoogle = {
    ...validEnv,
    GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'client-secret-value',
    GOOGLE_CALLBACK_URL: 'http://localhost:3001/api/auth/google/callback',
  };

  it('accepts a complete Google configuration', () => {
    const env = validateEnv(completeGoogle);

    expect(env.GOOGLE_CLIENT_ID).toBe(completeGoogle.GOOGLE_CLIENT_ID);
    expect(env.GOOGLE_CALLBACK_URL).toBe(completeGoogle.GOOGLE_CALLBACK_URL);
  });

  it('treats Google as disabled when none of the variables are set', () => {
    const env = validateEnv({ ...validEnv, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });

    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
  });

  it('rejects partial Google configuration with the missing variable named', () => {
    const { GOOGLE_CLIENT_SECRET, ...withoutSecret } = completeGoogle;

    try {
      validateEnv(withoutSecret);
      throw new Error('expected validateEnv to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('GOOGLE_CLIENT_SECRET');
      expect(message).not.toContain(GOOGLE_CLIENT_SECRET);
    }
  });

  it('rejects a malformed GOOGLE_CALLBACK_URL', () => {
    expect(() => validateEnv({ ...completeGoogle, GOOGLE_CALLBACK_URL: 'not-a-url' })).toThrow(
      /GOOGLE_CALLBACK_URL/,
    );
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

describe('Turnstile configuration', () => {
  it('accepts an optional TURNSTILE_SECRET_KEY and treats empty as unset', () => {
    const withSecret = validateEnv({ ...validEnv, TURNSTILE_SECRET_KEY: 'turnstile-secret' });
    expect(withSecret.TURNSTILE_SECRET_KEY).toBe('turnstile-secret');

    const withoutSecret = validateEnv({ ...validEnv, TURNSTILE_SECRET_KEY: '' });
    expect(withoutSecret.TURNSTILE_SECRET_KEY).toBeUndefined();
  });

  it('does not expose the Turnstile secret in validation errors', () => {
    const secret = 'turnstile-secret-value-that-must-not-leak';

    try {
      validateEnv({ ...validEnv, TURNSTILE_SECRET_KEY: secret, PORT: 'not-a-number' });
      throw new Error('expected validateEnv to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(secret);
      expect(message).toContain('PORT');
    }
  });
});
