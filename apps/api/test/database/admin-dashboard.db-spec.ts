import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient, Role as PrismaRole } from '@smshop/db';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { AuthSessionService } from '../../src/modules/auth/session/auth-session.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

const SAFE_ITEM_KEYS = ['createdAt', 'email', 'emailVerified', 'id', 'lastLoginAt', 'role'];
const SUMMARY_KEYS = ['recentUsers', 'roleCounts', 'totalUsers', 'verifiedUsers'];

describe('Admin dashboard summary (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let sessions: AuthSessionService;
  const sendMail = vi.fn();

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    ({ app } = await createAuthTestApp(prisma as unknown as PrismaService, sendMail));
    sessions = app.get(AuthSessionService);
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

  let sequence = 0;

  async function createUser(options: {
    email: string;
    role?: PrismaRole;
    verified?: boolean;
    createdAt?: Date;
  }) {
    sequence += 1;
    return prisma.user.create({
      data: {
        email: options.email,
        emailNormalized: options.email.toLowerCase(),
        role: options.role ?? PrismaRole.USER,
        emailVerifiedAt: options.verified ? new Date() : null,
        createdAt: options.createdAt ?? new Date(Date.parse('2026-01-01T00:00:00.000Z') + sequence),
      },
    });
  }

  async function tokenFor(userId: string): Promise<string> {
    const { accessToken } = await sessions.createSession(userId);
    return accessToken;
  }

  function getSummary(token: string | null) {
    const req = request(app.getHttpServer()).get('/api/admin/dashboard/summary');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }

  it('returns counts by role, verified total, and recent users', async () => {
    const admin = await createUser({
      email: 'admin@example.com',
      role: PrismaRole.ADMIN,
      verified: true,
    });
    await createUser({ email: 'user-a@example.com', verified: true });
    await createUser({ email: 'user-b@example.com' });
    await createUser({ email: 'editor@example.com', role: PrismaRole.EDITOR, verified: true });
    const token = await tokenFor(admin.id);

    const res = await getSummary(token);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(SUMMARY_KEYS);
    expect(res.body.totalUsers).toBe(4);
    expect(res.body.verifiedUsers).toBe(3);
    expect(res.body.roleCounts).toEqual({ user: 2, editor: 1, admin: 1 });
  });

  it('returns the five most recent users, newest first, with only safe fields', async () => {
    const admin = await createUser({
      email: 'admin@example.com',
      role: PrismaRole.ADMIN,
      verified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    for (let index = 1; index <= 6; index += 1) {
      await createUser({
        email: `user-${index}@example.com`,
        createdAt: new Date(`2026-02-0${index}T00:00:00.000Z`),
      });
    }
    const token = await tokenFor(admin.id);

    const res = await getSummary(token);

    expect(res.status).toBe(200);
    expect(res.body.recentUsers).toHaveLength(5);
    expect(res.body.recentUsers.map((user: { email: string }) => user.email)).toEqual([
      'user-6@example.com',
      'user-5@example.com',
      'user-4@example.com',
      'user-3@example.com',
      'user-2@example.com',
    ]);
    for (const user of res.body.recentUsers) {
      expect(Object.keys(user).sort()).toEqual(SAFE_ITEM_KEYS);
    }
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('refreshToken');
    expect(JSON.stringify(res.body)).not.toContain('tokenHash');
  });

  it('reports zeros and an empty recent list for an empty database', async () => {
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        emailNormalized: 'admin@example.com',
        role: PrismaRole.ADMIN,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.user.deleteMany({ where: { id: { not: admin.id } } });
    const token = await tokenFor(admin.id);

    const res = await getSummary(token);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalUsers: 1,
      verifiedUsers: 1,
      roleCounts: { user: 0, editor: 0, admin: 1 },
    });
    expect(res.body.recentUsers).toHaveLength(1);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await getSummary(null);
    expect(res.status).toBe(401);
  });

  it('forbids a normal user and an editor (403)', async () => {
    const user = await createUser({ email: 'user@example.com' });
    const editor = await createUser({ email: 'editor@example.com', role: PrismaRole.EDITOR });

    expect((await getSummary(await tokenFor(user.id))).status).toBe(403);
    expect((await getSummary(await tokenFor(editor.id))).status).toBe(403);
  });
});
