import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { Argon2PasswordHasher } from '../../src/modules/auth/password/argon2-password-hasher.js';
import {
  type TurnstileOutcome,
  type TurnstileVerifier,
} from '../../src/modules/auth/security/turnstile/turnstile-verifier.js';
import { InMemoryRateLimiter } from '../../src/modules/auth/security/rate-limit/rate-limiter.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

const PASSWORD = 'correct horse battery staple';
const EMAIL = 'hardening@example.com';
const hasher = new Argon2PasswordHasher();

let turnstileEnabled = false;
let turnstileOutcome: TurnstileOutcome = 'ok';
const turnstileVerifier: TurnstileVerifier = {
  isEnabled: () => turnstileEnabled,
  verify: async () => turnstileOutcome,
};
const rateLimiter = new InMemoryRateLimiter();

describe('Auth security hardening (real PostgreSQL, stubbed Turnstile)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sendMail = vi.fn();

  beforeAll(async () => {
    prisma = createTestPrismaClient() as unknown as PrismaService;
    ({ app } = await createAuthTestApp(prisma, sendMail, {
      turnstileVerifier,
      rateLimiter,
    }));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    turnstileEnabled = false;
    turnstileOutcome = 'ok';
    rateLimiter.reset();
    sendMail.mockReset();
    sendMail.mockResolvedValue(undefined);
    await truncateAll(prisma);
  });

  const post = (path: string, body: object) => request(app.getHttpServer()).post(path).send(body);

  async function seedVerifiedUser(): Promise<void> {
    const user = await prisma.user.create({
      data: { email: EMAIL, emailNormalized: EMAIL, emailVerifiedAt: new Date() },
    });
    await prisma.authAccount.create({
      data: {
        userId: user.id,
        provider: 'CREDENTIALS',
        providerAccountId: EMAIL,
        passwordHash: await hasher.hash(PASSWORD),
      },
    });
  }

  describe('Turnstile enforcement', () => {
    it('is a no-op when Turnstile is disabled (missing token does not block register)', async () => {
      const res = await post('/api/auth/register', { email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(201);
    });

    it('rejects register with a missing challenge before creating the user', async () => {
      turnstileEnabled = true;
      turnstileOutcome = 'missing';

      const res = await post('/api/auth/register', { email: EMAIL, password: PASSWORD });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TURNSTILE_REQUIRED');
      await expect(prisma.user.count()).resolves.toBe(0);
    });

    it('rejects register with a failed challenge', async () => {
      turnstileEnabled = true;
      turnstileOutcome = 'failed';

      const res = await post('/api/auth/register', {
        email: EMAIL,
        password: PASSWORD,
        turnstileToken: 'bad',
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TURNSTILE_FAILED');
      await expect(prisma.user.count()).resolves.toBe(0);
    });

    it('accepts register with a valid challenge', async () => {
      turnstileEnabled = true;
      turnstileOutcome = 'ok';

      const res = await post('/api/auth/register', {
        email: EMAIL,
        password: PASSWORD,
        turnstileToken: 'good',
      });

      expect(res.status).toBe(201);
      await expect(prisma.user.count()).resolves.toBe(1);
    });

    it('rejects login before password verification when the challenge fails', async () => {
      await seedVerifiedUser();
      turnstileEnabled = true;
      turnstileOutcome = 'failed';

      const res = await post('/api/auth/login', {
        email: EMAIL,
        password: PASSWORD,
        turnstileToken: 'bad',
      });

      // A failed challenge short-circuits before credential checks, so even a
      // correct password yields 403 rather than 200/401, and no session exists.
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TURNSTILE_FAILED');
      await expect(prisma.authSession.count()).resolves.toBe(0);
    });

    it('accepts login with a valid challenge', async () => {
      await seedVerifiedUser();
      turnstileEnabled = true;
      turnstileOutcome = 'ok';

      const res = await post('/api/auth/login', {
        email: EMAIL,
        password: PASSWORD,
        turnstileToken: 'good',
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('rejects forgot-password with a failed challenge (not a 202)', async () => {
      await seedVerifiedUser();
      turnstileEnabled = true;
      turnstileOutcome = 'failed';

      const res = await post('/api/auth/forgot-password', { email: EMAIL, turnstileToken: 'bad' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TURNSTILE_FAILED');
    });

    it('rejects resend-verification with a failed challenge', async () => {
      turnstileEnabled = true;
      turnstileOutcome = 'failed';

      const res = await post('/api/auth/resend-verification', {
        email: EMAIL,
        turnstileToken: 'bad',
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TURNSTILE_FAILED');
    });

    it('fails closed when the provider is unavailable', async () => {
      turnstileEnabled = true;
      turnstileOutcome = 'unavailable';

      const res = await post('/api/auth/login', {
        email: EMAIL,
        password: PASSWORD,
        turnstileToken: 'token',
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TURNSTILE_FAILED');
    });
  });

  describe('enumeration protection survives hardening', () => {
    it('keeps unknown email and wrong password indistinguishable', async () => {
      await seedVerifiedUser();

      const unknown = await post('/api/auth/login', {
        email: 'nobody@example.com',
        password: PASSWORD,
      });
      const wrong = await post('/api/auth/login', { email: EMAIL, password: 'wrong-password' });

      expect(unknown.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(unknown.body).toEqual(wrong.body);
    });

    it('keeps forgot-password generic for known and unknown accounts', async () => {
      await seedVerifiedUser();

      const known = await post('/api/auth/forgot-password', { email: EMAIL });
      const unknown = await post('/api/auth/forgot-password', { email: 'nobody@example.com' });

      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(known.body).toEqual(unknown.body);
    });

    it('keeps resend-verification generic for known and unknown accounts', async () => {
      const known = await post('/api/auth/resend-verification', { email: EMAIL });
      const unknown = await post('/api/auth/resend-verification', { email: 'nobody@example.com' });

      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(known.body).toEqual(unknown.body);
    });
  });

  describe('rate limiting', () => {
    it('allows legitimate logins then returns 429 with Retry-After', async () => {
      await seedVerifiedUser();

      for (let i = 0; i < 5; i += 1) {
        const res = await post('/api/auth/login', { email: EMAIL, password: 'wrong-password' });
        expect(res.status).toBe(401);
      }

      const limited = await post('/api/auth/login', { email: EMAIL, password: 'wrong-password' });
      expect(limited.status).toBe(429);
      expect(limited.body.code).toBe('RATE_LIMITED');
      expect(limited.headers['retry-after']).toBeDefined();
      expect(JSON.stringify(limited.body)).not.toContain('Argon2');
    });

    it('applies separate policies per endpoint', async () => {
      await seedVerifiedUser();

      for (let i = 0; i < 6; i += 1) {
        await post('/api/auth/login', { email: EMAIL, password: 'wrong-password' });
      }
      // login is now limited, but register (different policy) still works.
      const register = await post('/api/auth/register', {
        email: 'other@example.com',
        password: PASSWORD,
      });
      expect(register.status).toBe(201);
    });

    it('rate limits before the Turnstile check', async () => {
      turnstileEnabled = true;
      turnstileOutcome = 'failed';

      for (let i = 0; i < 5; i += 1) {
        const res = await post('/api/auth/login', { email: EMAIL, password: 'x' });
        expect(res.status).toBe(403);
      }
      const limited = await post('/api/auth/login', { email: EMAIL, password: 'x' });
      expect(limited.status).toBe(429);
    });
  });
});
