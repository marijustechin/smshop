import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@smshop/db';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { Argon2PasswordHasher } from '../../src/modules/auth/password/argon2-password-hasher.js';
import { hashPasswordResetToken } from '../../src/modules/auth/password-reset/password-reset-token.js';
import { PASSWORD_RESET_TTL_HOURS } from '../../src/modules/auth/password-reset/password-reset.constants.js';
import { REFRESH_COOKIE_NAME } from '../../src/modules/auth/session/refresh-cookie.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a brand new passphrase value';
const EMAIL = 'reset@example.com';
const hasher = new Argon2PasswordHasher();

interface SentMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function rawTokenFrom(message: SentMessage): string {
  return new URL(message.text.match(/http\S+/)![0]).searchParams.get('token') as string;
}

function cookieValue(res: request.Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies.find((c) => c.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split(';')[0].slice(name.length + 1)) : undefined;
}

describe('Password recovery (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sendMail = vi.fn();

  beforeAll(async () => {
    prisma = createTestPrismaClient() as unknown as PrismaService;
    ({ app } = await createAuthTestApp(prisma, sendMail));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    sendMail.mockReset();
    sendMail.mockResolvedValue(undefined);
    await truncateAll(prisma);
  });

  const post = (path: string, body: object) => request(app.getHttpServer()).post(path).send(body);

  async function seedUser(
    email = EMAIL,
    options: { verified?: boolean; provider?: 'CREDENTIALS' | 'GOOGLE' } = {},
  ): Promise<User> {
    const { verified = true, provider = 'CREDENTIALS' } = options;
    const emailNormalized = email.toLowerCase();
    const user = await prisma.user.create({
      data: { email, emailNormalized, emailVerifiedAt: verified ? new Date() : null },
    });
    await prisma.authAccount.create({
      data: {
        userId: user.id,
        provider,
        providerAccountId: provider === 'CREDENTIALS' ? emailNormalized : `google-sub-${user.id}`,
        passwordHash: provider === 'CREDENTIALS' ? await hasher.hash(PASSWORD) : null,
      },
    });
    return user;
  }

  const GENERIC_MESSAGE =
    'If an eligible account exists, password reset instructions will be sent.';

  describe('forgot-password', () => {
    it('issues one hashed reset token and emails an eligible verified credentials account', async () => {
      await seedUser();

      const res = await post('/api/auth/forgot-password', { email: EMAIL });

      expect(res.status).toBe(202);
      expect(res.body).toEqual({ message: GENERIC_MESSAGE });
      expect(sendMail).toHaveBeenCalledTimes(1);
      const message = sendMail.mock.calls[0][0] as SentMessage;
      expect(message.to).toBe(EMAIL);
      expect(message.subject).toBe('Slaptažodžio atkūrimas');
      expect(message.text).toContain('/atkurti-slaptazodi?token=');

      const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: EMAIL } });
      const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].consumedAt).toBeNull();
      expect(tokens[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(tokens[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(tokens[0].tokenHash).not.toBe(rawTokenFrom(message));
    });

    it('uses the documented 1-hour TTL', async () => {
      await seedUser();
      await post('/api/auth/forgot-password', { email: EMAIL });

      const token = await prisma.passwordResetToken.findFirstOrThrow();
      const delta = token.expiresAt.getTime() - token.createdAt.getTime();
      expect(Math.abs(delta - PASSWORD_RESET_TTL_HOURS * 3_600_000)).toBeLessThan(5_000);
    });

    it('remains enumeration-safe for unknown, Google-only, and unverified accounts', async () => {
      await seedUser('google@example.com', { provider: 'GOOGLE' });
      await seedUser('unverified@example.com', { verified: false });

      const unknown = await post('/api/auth/forgot-password', { email: 'nobody@example.com' });
      const google = await post('/api/auth/forgot-password', { email: 'google@example.com' });
      const unverified = await post('/api/auth/forgot-password', {
        email: 'unverified@example.com',
      });

      for (const res of [unknown, google, unverified]) {
        expect(res.status).toBe(202);
        expect(res.body).toEqual({ message: GENERIC_MESSAGE });
      }
      expect(sendMail).not.toHaveBeenCalled();
      await expect(prisma.passwordResetToken.count()).resolves.toBe(0);
    });

    it('rotates the previous token on a repeat request', async () => {
      await seedUser();
      await post('/api/auth/forgot-password', { email: EMAIL });
      const firstToken = rawTokenFrom(sendMail.mock.calls.at(-1)![0] as SentMessage);
      sendMail.mockClear();

      const res = await post('/api/auth/forgot-password', { email: EMAIL });
      expect(res.status).toBe(202);
      expect(sendMail).toHaveBeenCalledTimes(1);

      const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: EMAIL } });
      const active = await prisma.passwordResetToken.count({
        where: { userId: user.id, consumedAt: null },
      });
      expect(active).toBe(1);

      // Old token is now consumed and cannot reset.
      const oldFirst = await prisma.passwordResetToken.findFirstOrThrow({
        where: { tokenHash: hashPasswordResetToken(firstToken) },
      });
      expect(oldFirst.consumedAt).not.toBeNull();
      expect(
        (await post('/api/auth/reset-password', { token: firstToken, password: NEW_PASSWORD }))
          .status,
      ).toBe(409);
    });

    it('keeps the generic response when mail delivery fails and still rotates tokens', async () => {
      await seedUser();
      const first = await post('/api/auth/forgot-password', { email: EMAIL });
      const firstToken = rawTokenFrom(sendMail.mock.calls.at(-1)![0] as SentMessage);
      sendMail.mockRejectedValueOnce(new Error('smtp down'));

      const res = await post('/api/auth/forgot-password', { email: EMAIL });

      expect(res.status).toBe(first.status);
      expect(res.body).toEqual(first.body);
      const oldRecord = await prisma.passwordResetToken.findFirstOrThrow({
        where: { tokenHash: hashPasswordResetToken(firstToken) },
      });
      expect(oldRecord.consumedAt).not.toBeNull();
    });

    it('rejects a malformed email with 400', async () => {
      expect((await post('/api/auth/forgot-password', { email: 'nope' })).status).toBe(400);
    });
  });

  describe('reset-password', () => {
    async function issueToken(): Promise<string> {
      await post('/api/auth/forgot-password', { email: EMAIL });
      return rawTokenFrom(sendMail.mock.calls.at(-1)![0] as SentMessage);
    }

    it('resets the password, consumes the token, and rejects replay', async () => {
      await seedUser();
      const token = await issueToken();
      const before = await prisma.authAccount.findFirstOrThrow({
        where: { provider: 'CREDENTIALS' },
      });

      const res = await post('/api/auth/reset-password', { token, password: NEW_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ passwordReset: true });

      const after = await prisma.authAccount.findFirstOrThrow({
        where: { provider: 'CREDENTIALS' },
      });
      expect(after.passwordHash).not.toBe(before.passwordHash);
      expect(after.passwordHash).not.toBe(NEW_PASSWORD);
      await expect(hasher.verify(after.passwordHash as string, NEW_PASSWORD)).resolves.toBe(true);
      await expect(hasher.verify(after.passwordHash as string, PASSWORD)).resolves.toBe(false);

      const record = await prisma.passwordResetToken.findFirstOrThrow({
        where: { tokenHash: hashPasswordResetToken(token) },
      });
      expect(record.consumedAt).not.toBeNull();

      // Replay rejected.
      expect((await post('/api/auth/reset-password', { token, password: PASSWORD })).status).toBe(
        409,
      );
    });

    it('allows login only with the new password after reset', async () => {
      await seedUser();
      const token = await issueToken();
      await post('/api/auth/reset-password', { token, password: NEW_PASSWORD });

      expect((await post('/api/auth/login', { email: EMAIL, password: PASSWORD })).status).toBe(
        401,
      );
      expect((await post('/api/auth/login', { email: EMAIL, password: NEW_PASSWORD })).status).toBe(
        200,
      );
    });

    it('rejects an unknown token with 400 and an expired token with 410', async () => {
      await seedUser();
      const token = await issueToken();

      expect(
        (await post('/api/auth/reset-password', { token: 'unknown-token', password: NEW_PASSWORD }))
          .status,
      ).toBe(400);

      await prisma.passwordResetToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(
        (await post('/api/auth/reset-password', { token, password: NEW_PASSWORD })).status,
      ).toBe(410);
    });

    it('rejects a previously rotated token', async () => {
      await seedUser();
      const firstToken = await issueToken();
      sendMail.mockClear();
      await post('/api/auth/forgot-password', { email: EMAIL });
      const secondToken = rawTokenFrom(sendMail.mock.calls.at(-1)![0] as SentMessage);

      expect(
        (await post('/api/auth/reset-password', { token: firstToken, password: NEW_PASSWORD }))
          .status,
      ).toBe(409);
      expect(
        (await post('/api/auth/reset-password', { token: secondToken, password: NEW_PASSWORD }))
          .status,
      ).toBe(200);
    });

    it('enforces the password policy (too short / too long / unknown field)', async () => {
      await seedUser();
      const token = await issueToken();

      expect((await post('/api/auth/reset-password', { token, password: 'short' })).status).toBe(
        400,
      );
      expect(
        (await post('/api/auth/reset-password', { token, password: 'a'.repeat(129) })).status,
      ).toBe(400);
      expect(
        (await post('/api/auth/reset-password', { token, password: NEW_PASSWORD, extra: 1 }))
          .status,
      ).toBe(400);
    });
  });

  describe('session revocation after reset', () => {
    it('revokes all active sessions so old refresh tokens and old passwords fail', async () => {
      await seedUser();
      const loginRes = await post('/api/auth/login', { email: EMAIL, password: PASSWORD });
      expect(loginRes.status).toBe(200);
      const oldCookieValue = cookieValue(loginRes, REFRESH_COOKIE_NAME) as string;
      const oldCookie = `${REFRESH_COOKIE_NAME}=${oldCookieValue}`;

      await expect(prisma.authSession.count({ where: { revokedAt: null } })).resolves.toBe(1);

      await post('/api/auth/forgot-password', { email: EMAIL });
      const token = rawTokenFrom(sendMail.mock.calls.at(-1)![0] as SentMessage);
      const reset = await post('/api/auth/reset-password', { token, password: NEW_PASSWORD });
      expect(reset.status).toBe(200);

      await expect(prisma.authSession.count({ where: { revokedAt: null } })).resolves.toBe(0);
      expect(
        (await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', oldCookie))
          .status,
      ).toBe(401);
      expect((await post('/api/auth/login', { email: EMAIL, password: PASSWORD })).status).toBe(
        401,
      );
      expect((await post('/api/auth/login', { email: EMAIL, password: NEW_PASSWORD })).status).toBe(
        200,
      );
    });
  });
});
