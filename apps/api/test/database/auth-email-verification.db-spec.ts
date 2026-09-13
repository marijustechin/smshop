import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';
import {
  generateVerificationToken,
  hashVerificationToken,
} from '../../src/modules/auth/email-verification/verification-token.js';
import { EMAIL_VERIFICATION_TTL_HOURS } from '../../src/modules/auth/email-verification/email-verification.constants.js';

const PASSWORD = 'correct horse battery staple';
const EMAIL = 'verify@example.com';

interface SentMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function rawTokenFrom(message: SentMessage): string {
  return new URL(message.text.match(/http\S+/)![0]).searchParams.get('token') as string;
}

describe('Email verification (real PostgreSQL)', () => {
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

  async function registerAndGetToken(email = EMAIL): Promise<string> {
    const res = await post('/api/auth/register', { email, password: PASSWORD });
    expect(res.status).toBe(201);
    return rawTokenFrom(sendMail.mock.calls.at(-1)![0] as SentMessage);
  }

  describe('success', () => {
    it('verifies the user atomically and consumes the token', async () => {
      const token = await registerAndGetToken();

      const res = await post('/api/auth/verify-email', { token });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ verified: true });

      const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: EMAIL } });
      expect(user.emailVerifiedAt).not.toBeNull();

      const record = await prisma.emailVerificationToken.findFirstOrThrow({
        where: { tokenHash: hashVerificationToken(token) },
      });
      expect(record.consumedAt).not.toBeNull();
    });

    it('invalidates any other active tokens for the user', async () => {
      const token = await registerAndGetToken();
      const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: EMAIL } });

      const extraRaw = generateVerificationToken();
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashVerificationToken(extraRaw),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await post('/api/auth/verify-email', { token });

      const active = await prisma.emailVerificationToken.count({
        where: { userId: user.id, consumedAt: null },
      });
      expect(active).toBe(0);
    });
  });

  describe('rejections', () => {
    it('rejects an unknown token with 400', async () => {
      const res = await post('/api/auth/verify-email', { token: 'not-a-real-token' });
      expect(res.status).toBe(400);
    });

    it('rejects an expired token with 410', async () => {
      const token = await registerAndGetToken();
      await prisma.emailVerificationToken.updateMany({
        where: { tokenHash: hashVerificationToken(token) },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const res = await post('/api/auth/verify-email', { token });
      expect(res.status).toBe(410);
    });

    it('rejects an already-consumed token with 409', async () => {
      const token = await registerAndGetToken();
      expect((await post('/api/auth/verify-email', { token })).status).toBe(200);

      const res = await post('/api/auth/verify-email', { token });
      expect(res.status).toBe(409);
    });

    it('rejects a missing token field with 400', async () => {
      const res = await post('/api/auth/verify-email', {});
      expect(res.status).toBe(400);
    });
  });

  describe('resend', () => {
    it('issues a new token, invalidates the old one, and sends one email', async () => {
      const firstToken = await registerAndGetToken();
      sendMail.mockClear();

      const res = await post('/api/auth/resend-verification', { email: EMAIL });

      expect(res.status).toBe(202);
      expect(sendMail).toHaveBeenCalledTimes(1);

      const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: EMAIL } });
      const active = await prisma.emailVerificationToken.findMany({
        where: { userId: user.id, consumedAt: null },
      });
      expect(active).toHaveLength(1);

      // Old token no longer works; new one does.
      expect((await post('/api/auth/verify-email', { token: firstToken })).status).toBe(409);
      const newToken = rawTokenFrom(sendMail.mock.calls.at(-1)![0] as SentMessage);
      expect(newToken).not.toBe(firstToken);
      expect((await post('/api/auth/verify-email', { token: newToken })).status).toBe(200);
    });

    it('does not reveal unknown accounts and sends nothing', async () => {
      const res = await post('/api/auth/resend-verification', { email: 'nobody@example.com' });

      expect(res.status).toBe(202);
      expect(res.body).toEqual({
        message: 'If an eligible account exists, a verification email will be sent.',
      });
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('does not issue a token for an already-verified account', async () => {
      const token = await registerAndGetToken();
      await post('/api/auth/verify-email', { token });
      sendMail.mockClear();

      const res = await post('/api/auth/resend-verification', { email: EMAIL });

      expect(res.status).toBe(202);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('does not send for a Google-only account but returns the same response', async () => {
      await prisma.user.create({
        data: {
          email: 'google@example.com',
          emailNormalized: 'google@example.com',
          accounts: {
            create: {
              provider: 'GOOGLE',
              providerAccountId: 'google-sub-123',
            },
          },
        },
      });

      const res = await post('/api/auth/resend-verification', { email: 'google@example.com' });

      expect(res.status).toBe(202);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('rejects a malformed email with 400', async () => {
      const res = await post('/api/auth/resend-verification', { email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('returns an identical response for unknown, unverified, and verified accounts', async () => {
      const unverified = await post('/api/auth/resend-verification', {
        email: 'unknown@example.com',
      });

      await registerAndGetToken('second@example.com');
      const knownUnverified = await post('/api/auth/resend-verification', {
        email: 'second@example.com',
      });

      const token = await registerAndGetToken('third@example.com');
      await post('/api/auth/verify-email', { token });
      const knownVerified = await post('/api/auth/resend-verification', {
        email: 'third@example.com',
      });

      expect(knownUnverified.status).toBe(unverified.status);
      expect(knownVerified.status).toBe(unverified.status);
      expect(knownUnverified.body).toEqual(unverified.body);
      expect(knownVerified.body).toEqual(unverified.body);
    });

    it('keeps the generic response and still rotates tokens when resend mail fails', async () => {
      const firstToken = await registerAndGetToken();
      sendMail.mockRejectedValueOnce(new Error('smtp down'));

      const res = await post('/api/auth/resend-verification', { email: EMAIL });
      expect(res.status).toBe(202);
      expect(res.body).toEqual({
        message: 'If an eligible account exists, a verification email will be sent.',
      });

      // Token rotation still occurred (old token consumed); the user can retry.
      const consumed = await prisma.emailVerificationToken.findFirst({
        where: { tokenHash: hashVerificationToken(firstToken) },
      });
      expect(consumed?.consumedAt).not.toBeNull();
    });
  });

  describe('token expiry baseline', () => {
    it('uses the documented TTL', async () => {
      await registerAndGetToken();
      const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: EMAIL } });
      const token = await prisma.emailVerificationToken.findFirstOrThrow({
        where: { userId: user.id },
      });

      const expectedMs = EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000;
      const delta = token.expiresAt.getTime() - token.createdAt.getTime();
      expect(Math.abs(delta - expectedMs)).toBeLessThan(5_000);
    });
  });
});
