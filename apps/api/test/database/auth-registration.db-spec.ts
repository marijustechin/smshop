import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma.service.js';
import { Argon2PasswordHasher } from '../../src/auth/password/argon2-password-hasher.js';
import { AuthService } from '../../src/auth/auth.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';

const PASSWORD = 'correct horse battery staple';
const EMAIL = 'customer@example.com';

describe('Credentials registration (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = createTestPrismaClient() as unknown as PrismaService;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api', {
      exclude: [{ path: 'health/ready', method: RequestMethod.GET }],
    });
    await app.init();
    await (app.getHttpAdapter().getInstance() as { ready: () => Promise<void> }).ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
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
      });
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('passwordHash');

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

    it('normalizes the stored email while preserving the original casing', async () => {
      const res = await register({ email: '  Customer@Example.COM  ', password: PASSWORD });

      expect(res.status).toBe(201);
      const user = await prisma.user.findUniqueOrThrow({
        where: { emailNormalized: 'customer@example.com' },
      });
      expect(user.email).toBe('Customer@Example.COM');
      expect(user.emailNormalized).toBe('customer@example.com');
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

      const service = new AuthService(failingPrisma, new Argon2PasswordHasher());

      await expect(service.register({ email: EMAIL, password: PASSWORD })).rejects.toThrow();
      await expect(prisma.user.count()).resolves.toBe(0);
      await expect(prisma.authAccount.count()).resolves.toBe(0);
    });
  });
});
