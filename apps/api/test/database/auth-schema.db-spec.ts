import type { PrismaClient } from '@smshop/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrismaClient, truncateAll } from './helpers.js';

const EMAIL = 'Customer@Example.COM';
const EMAIL_NORMALIZED = 'customer@example.com';

async function createUser(prisma: PrismaClient, email = EMAIL, emailNormalized = EMAIL_NORMALIZED) {
  return prisma.user.create({ data: { email, emailNormalized } });
}

async function expectUniqueViolation(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code: 'P2002' });
}

describe('Authentication schema invariants (real PostgreSQL)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  describe('User identity', () => {
    it('creates a user and defaults verification to unverified', async () => {
      const user = await createUser(prisma);

      expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(user.email).toBe(EMAIL);
      expect(user.emailNormalized).toBe(EMAIL_NORMALIZED);
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('enforces normalized email uniqueness regardless of stored case', async () => {
      await createUser(prisma, 'Customer@Example.COM', EMAIL_NORMALIZED);

      await expectUniqueViolation(createUser(prisma, 'customer@example.com', EMAIL_NORMALIZED));
    });

    it('allows distinct normalized emails', async () => {
      await createUser(prisma, 'a@example.com', 'a@example.com');
      await createUser(prisma, 'b@example.com', 'b@example.com');

      await expect(prisma.user.count()).resolves.toBe(2);
    });
  });

  describe('AuthAccount providers', () => {
    it('creates a credentials account with a password hash', async () => {
      const user = await createUser(prisma);
      const account = await prisma.authAccount.create({
        data: {
          userId: user.id,
          provider: 'CREDENTIALS',
          providerAccountId: EMAIL_NORMALIZED,
          passwordHash: 'hashed-value',
        },
      });

      expect(account.provider).toBe('CREDENTIALS');
      expect(account.passwordHash).toBe('hashed-value');
    });

    it('creates a Google account keyed by provider subject, not email', async () => {
      const user = await createUser(prisma);
      const account = await prisma.authAccount.create({
        data: {
          userId: user.id,
          provider: 'GOOGLE',
          providerAccountId: 'google-sub-1234567890',
        },
      });

      expect(account.provider).toBe('GOOGLE');
      expect(account.passwordHash).toBeNull();
    });

    it('rejects duplicate (provider, providerAccountId)', async () => {
      const first = await createUser(prisma, 'a@example.com', 'a@example.com');
      const second = await createUser(prisma, 'b@example.com', 'b@example.com');

      await prisma.authAccount.create({
        data: {
          userId: first.id,
          provider: 'GOOGLE',
          providerAccountId: 'shared-sub',
        },
      });

      await expectUniqueViolation(
        prisma.authAccount.create({
          data: {
            userId: second.id,
            provider: 'GOOGLE',
            providerAccountId: 'shared-sub',
          },
        }),
      );
    });

    it('rejects a second account for the same user and provider', async () => {
      const user = await createUser(prisma);

      await prisma.authAccount.create({
        data: {
          userId: user.id,
          provider: 'CREDENTIALS',
          providerAccountId: EMAIL_NORMALIZED,
          passwordHash: 'hash-1',
        },
      });

      await expectUniqueViolation(
        prisma.authAccount.create({
          data: {
            userId: user.id,
            provider: 'CREDENTIALS',
            providerAccountId: 'other@example.com',
            passwordHash: 'hash-2',
          },
        }),
      );
    });

    it('allows one user to hold credentials and Google accounts (linking ready)', async () => {
      const user = await createUser(prisma);

      await prisma.authAccount.create({
        data: {
          userId: user.id,
          provider: 'CREDENTIALS',
          providerAccountId: EMAIL_NORMALIZED,
          passwordHash: 'hashed-value',
        },
      });
      await prisma.authAccount.create({
        data: {
          userId: user.id,
          provider: 'GOOGLE',
          providerAccountId: 'google-sub-1234567890',
        },
      });

      await expect(prisma.authAccount.count({ where: { userId: user.id } })).resolves.toBe(2);
    });
  });

  describe('AuthSession', () => {
    it('stores a refresh token hash belonging to a user', async () => {
      const user = await createUser(prisma);
      const session = await prisma.authSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: 'refresh-hash-1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      expect(session.userId).toBe(user.id);
      expect(session.refreshTokenHash).toBe('refresh-hash-1');
      expect(session.revokedAt).toBeNull();
      expect(session.lastUsedAt).toBeNull();
    });

    it('rejects duplicate refresh token hashes', async () => {
      const user = await createUser(prisma);
      const data = {
        userId: user.id,
        refreshTokenHash: 'duplicate-hash',
        expiresAt: new Date(Date.now() + 60_000),
      };

      await prisma.authSession.create({ data });

      await expectUniqueViolation(prisma.authSession.create({ data }));
    });

    it('supports user-wide revocation and expiration queries', async () => {
      const user = await createUser(prisma);
      await prisma.authSession.createMany({
        data: [
          {
            userId: user.id,
            refreshTokenHash: 'h1',
            expiresAt: new Date(Date.now() + 60_000),
          },
          {
            userId: user.id,
            refreshTokenHash: 'h2',
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: new Date(),
          },
        ],
      });

      const active = await prisma.authSession.findMany({
        where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      });

      expect(active).toHaveLength(1);
    });
  });

  describe('EmailVerificationToken', () => {
    it('stores a hashed single-use token belonging to a user', async () => {
      const user = await createUser(prisma);
      const token = await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: 'verify-hash-1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      expect(token.userId).toBe(user.id);
      expect(token.consumedAt).toBeNull();
      await expect(
        prisma.emailVerificationToken.count({ where: { userId: user.id } }),
      ).resolves.toBe(1);
    });

    it('rejects duplicate token hashes', async () => {
      const user = await createUser(prisma);
      const data = {
        userId: user.id,
        tokenHash: 'verify-hash-dup',
        expiresAt: new Date(Date.now() + 60_000),
      };

      await prisma.emailVerificationToken.create({ data });

      await expectUniqueViolation(prisma.emailVerificationToken.create({ data }));
    });
  });

  describe('PasswordResetToken', () => {
    it('stores a hashed single-use token belonging to a user', async () => {
      const user = await createUser(prisma);
      const token = await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: 'reset-hash-1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      expect(token.userId).toBe(user.id);
      expect(token.consumedAt).toBeNull();
    });

    it('rejects duplicate token hashes', async () => {
      const user = await createUser(prisma);
      const data = {
        userId: user.id,
        tokenHash: 'reset-hash-dup',
        expiresAt: new Date(Date.now() + 60_000),
      };

      await prisma.passwordResetToken.create({ data });

      await expectUniqueViolation(prisma.passwordResetToken.create({ data }));
    });
  });

  describe('Referential behaviour', () => {
    it('cascades deletion of all authentication-owned child records', async () => {
      const user = await createUser(prisma);
      await prisma.authAccount.create({
        data: {
          userId: user.id,
          provider: 'CREDENTIALS',
          providerAccountId: EMAIL_NORMALIZED,
          passwordHash: 'hashed-value',
        },
      });
      await prisma.authSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: 'cascade-hash',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: 'cascade-verify',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: 'cascade-reset',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await prisma.user.delete({ where: { id: user.id } });

      await expect(prisma.authAccount.count()).resolves.toBe(0);
      await expect(prisma.authSession.count()).resolves.toBe(0);
      await expect(prisma.emailVerificationToken.count()).resolves.toBe(0);
      await expect(prisma.passwordResetToken.count()).resolves.toBe(0);
      await expect(prisma.user.count()).resolves.toBe(0);
    });
  });
});
