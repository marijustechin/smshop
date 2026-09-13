import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { Argon2PasswordHasher } from '../../src/modules/auth/password/argon2-password-hasher.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { EmailVerificationService } from '../../src/modules/auth/email-verification/email-verification.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

const PASSWORD = 'correct horse battery staple';
const EMAIL = 'customer@example.com';

describe('Credentials registration (real PostgreSQL)', () => {
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

  function register(body: object) {
    return request(app.getHttpServer()).post('/api/auth/register').send(body);
  }

  describe('successful registration', () => {
    it('creates a User and a CREDENTIALS AuthAccount atomically', async () => {
      const res = await register({ email: EMAIL, password: PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        email: EMAIL,
        emailVerified: false,
        verificationEmailSent: true,
      });
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('token');

      const user = await prisma.user.findUniqueOrThrow({
        where: { emailNormalized: EMAIL },
      });
      expect(user.email).toBe(EMAIL);
      expect(user.emailNormalized).toBe(EMAIL);
      expect(user.emailVerifiedAt).toBeNull();

      const account = await prisma.authAccount.findFirstOrThrow({ where: { userId: user.id } });
      expect(account.provider).toBe('CREDENTIALS');
      expect(account.providerAccountId).toBe(EMAIL);
      expect(account.passwordHash).toEqual(expect.any(String));
      expect(account.passwordHash).not.toBe(PASSWORD);

      const verifyHasher = new Argon2PasswordHasher();
      await expect(verifyHasher.verify(account.passwordHash as string, PASSWORD)).resolves.toBe(
        true,
      );
      await expect(verifyHasher.verify(account.passwordHash as string, 'wrong')).resolves.toBe(
        false,
      );
    });

    it('issues one hashed verification token that expires in the future', async () => {
      await register({ email: EMAIL, password: PASSWORD });

      const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: EMAIL } });
      const tokens = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });

      expect(tokens).toHaveLength(1);
      const token = tokens[0];
      expect(token.consumedAt).toBeNull();
      expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('sends the verification email through MailService after commit', async () => {
      await register({ email: EMAIL, password: PASSWORD });

      expect(sendMail).toHaveBeenCalledTimes(1);
      const message = sendMail.mock.calls[0][0] as {
        to: string;
        subject: string;
        text: string;
        html: string;
      };
      expect(message.to).toBe(EMAIL);
      expect(message.subject).toBe('Patvirtinkite savo el. pašto adresą');
      expect(message.text).toContain('/patvirtinti-el-pasta?token=');
      expect(message.html).toContain('/patvirtinti-el-pasta?token=');

      // The raw token in the email is not the persisted hash.
      const rawToken = new URL(message.text.match(/http\S+/)![0]).searchParams.get(
        'token',
      ) as string;
      const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: EMAIL } });
      const stored = await prisma.emailVerificationToken.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(stored.tokenHash).not.toBe(rawToken);
    });

    it('normalizes the stored email while preserving the original casing', async () => {
      const res = await register({ email: '  Customer@Example.COM  ', password: PASSWORD });

      expect(res.status).toBe(201);
      const user = await prisma.user.findUniqueOrThrow({
        where: { emailNormalized: 'customer@example.com' },
      });
      expect(user.email).toBe('Customer@Example.COM');
      expect(user.emailNormalized).toBe('customer@example.com');
    });

    it('keeps the account committed but reports non-delivery when mail fails', async () => {
      sendMail.mockRejectedValue(new Error('smtp down'));

      const res = await register({ email: EMAIL, password: PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body.verificationEmailSent).toBe(false);
      await expect(prisma.user.count({ where: { emailNormalized: EMAIL } })).resolves.toBe(1);
    });
  });

  describe('validation', () => {
    const invalidBodies: Array<[string, object]> = [
      ['invalid email', { email: 'not-an-email', password: PASSWORD }],
      ['missing email', { password: PASSWORD }],
      ['missing password', { email: EMAIL }],
      ['password below minimum', { email: EMAIL, password: 'short' }],
      ['password above maximum', { email: EMAIL, password: 'a'.repeat(129) }],
      ['unknown field', { email: EMAIL, password: PASSWORD, role: 'admin' }],
    ];

    it.each(invalidBodies)('rejects %s with 400', async (_label, body) => {
      const res = await register(body);
      expect(res.status).toBe(400);
      await expect(prisma.user.count()).resolves.toBe(0);
      await expect(prisma.authAccount.count()).resolves.toBe(0);
    });
  });

  describe('duplicate identity', () => {
    it('rejects the exact duplicate email with 409 and creates nothing extra', async () => {
      const first = await register({ email: EMAIL, password: PASSWORD });
      expect(first.status).toBe(201);

      const second = await register({ email: EMAIL, password: PASSWORD });
      expect(second.status).toBe(409);
      expect(JSON.stringify(second.body)).not.toContain('P2002');
      expect(JSON.stringify(second.body)).not.toContain('prisma');

      await expect(prisma.user.count()).resolves.toBe(1);
      await expect(prisma.authAccount.count()).resolves.toBe(1);
      await expect(prisma.emailVerificationToken.count()).resolves.toBe(1);
    });

    it('rejects a duplicate differing only by case and whitespace with 409', async () => {
      await register({ email: EMAIL, password: PASSWORD });

      const res = await register({ email: '  CUSTOMER@EXAMPLE.COM ', password: PASSWORD });

      expect(res.status).toBe(409);
      await expect(prisma.user.count()).resolves.toBe(1);
      await expect(prisma.authAccount.count()).resolves.toBe(1);
    });

    it('allows exactly one identity under concurrent registration (race)', async () => {
      const results = await Promise.all([
        register({ email: EMAIL, password: PASSWORD }),
        register({ email: EMAIL, password: PASSWORD }),
      ]);

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409]);
      await expect(prisma.user.count()).resolves.toBe(1);
      await expect(prisma.authAccount.count()).resolves.toBe(1);
      await expect(prisma.emailVerificationToken.count()).resolves.toBe(1);
    });
  });

  describe('transaction atomicity', () => {
    it('leaves no orphan User when credentials account creation fails', async () => {
      const transactionRunner = prisma as unknown as {
        $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
      };
      const failingPrisma = {
        $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
          transactionRunner.$transaction((realTx) => {
            const tx = {
              user: (realTx as { user: unknown }).user,
              authAccount: {
                create: () => Promise.reject(new Error('account create failed')),
              },
            };
            return fn(tx);
          }),
      } as unknown as PrismaService;

      const emailVerification = {} as EmailVerificationService;
      const service = new AuthService(failingPrisma, new Argon2PasswordHasher(), emailVerification);

      await expect(service.register({ email: EMAIL, password: PASSWORD })).rejects.toThrow();
      await expect(prisma.user.count()).resolves.toBe(0);
      await expect(prisma.authAccount.count()).resolves.toBe(0);
    });
  });
});
