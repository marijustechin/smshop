import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient, Role as PrismaRole } from '@smshop/db';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { AuthSessionService } from '../../src/modules/auth/session/auth-session.service.js';
import { AdminUsersService } from '../../src/modules/admin/admin-users.service.js';
import { InitialAdminBootstrapService } from '../../src/modules/admin/bootstrap/initial-admin-bootstrap.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

const PASSWORD = 'correct horse battery staple';

const SAFE_ITEM_KEYS = ['createdAt', 'email', 'emailVerified', 'id', 'lastLoginAt', 'role'];

describe('Admin user management (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let sessions: AuthSessionService;
  let adminUsers: AdminUsersService;
  const sendMail = vi.fn();

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    ({ app } = await createAuthTestApp(prisma as unknown as PrismaService, sendMail));
    sessions = app.get(AuthSessionService);
    adminUsers = app.get(AdminUsersService);
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

  async function createUser(options: { email: string; role?: PrismaRole; verified?: boolean }) {
    return prisma.user.create({
      data: {
        email: options.email,
        emailNormalized: options.email.toLowerCase(),
        role: options.role ?? PrismaRole.USER,
        emailVerifiedAt: options.verified ? new Date() : null,
      },
    });
  }

  async function tokenFor(userId: string): Promise<string> {
    const { accessToken } = await sessions.createSession(userId);
    return accessToken;
  }

  function getUsers(token: string | null, query = '') {
    const req = request(app.getHttpServer()).get(`/api/admin/users${query}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }

  function patchRole(token: string, id: string, role: string) {
    return request(app.getHttpServer())
      .patch(`/api/admin/users/${id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role });
  }

  function deleteUser(token: string, id: string) {
    return request(app.getHttpServer())
      .delete(`/api/admin/users/${id}`)
      .set('Authorization', `Bearer ${token}`);
  }

  describe('role default and migration behaviour', () => {
    it('defaults a newly created user to the user role', async () => {
      const user = await prisma.user.create({
        data: { email: 'a@example.com', emailNormalized: 'a@example.com' },
      });
      expect(user.role).toBe('USER');
    });

    it('has a database-level USER default for existing/backfilled rows', async () => {
      const [row] = await prisma.$queryRawUnsafe<Array<{ column_default: string | null }>>(
        `SELECT column_default FROM information_schema.columns
         WHERE table_name = 'users' AND column_name = 'role'`,
      );
      expect(row.column_default).toContain('USER');
    });

    it('supports the editor and admin roles', async () => {
      const editor = await createUser({ email: 'editor@example.com', role: PrismaRole.EDITOR });
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });
      expect(editor.role).toBe('EDITOR');
      expect(admin.role).toBe('ADMIN');
    });
  });

  describe('GET /api/admin/users', () => {
    it('lets an admin list users with only safe fields and pagination', async () => {
      const admin = await createUser({
        email: 'admin@example.com',
        role: PrismaRole.ADMIN,
        verified: true,
      });
      await createUser({ email: 'one@example.com' });
      await createUser({ email: 'two@example.com' });
      const token = await tokenFor(admin.id);

      const res = await getUsers(token, '?page=1&pageSize=2');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
      expect(res.body.items).toHaveLength(2);
      expect(Object.keys(res.body.items[0]).sort()).toEqual(SAFE_ITEM_KEYS);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain('refreshToken');
      expect(JSON.stringify(res.body)).not.toContain('tokenHash');
    });

    it('rejects an unauthenticated request', async () => {
      const res = await getUsers(null);
      expect(res.status).toBe(401);
    });

    it('forbids a normal user and an editor (403)', async () => {
      const user = await createUser({ email: 'user@example.com' });
      const editor = await createUser({ email: 'editor@example.com', role: PrismaRole.EDITOR });

      expect((await getUsers(await tokenFor(user.id))).status).toBe(403);
      expect((await getUsers(await tokenFor(editor.id))).status).toBe(403);
    });
  });

  describe('PATCH /api/admin/users/:id/role', () => {
    it('lets an admin change another user role', async () => {
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });
      const target = await createUser({ email: 'target@example.com' });
      const token = await tokenFor(admin.id);

      const res = await patchRole(token, target.id, 'editor');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: target.id, role: 'editor' });
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(stored.role).toBe('EDITOR');
    });

    it('rejects an invalid role with 400', async () => {
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });
      const target = await createUser({ email: 'target@example.com' });
      const token = await tokenFor(admin.id);

      const res = await patchRole(token, target.id, 'superuser');
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown user', async () => {
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });
      const token = await tokenFor(admin.id);

      const res = await patchRole(token, '00000000-0000-7000-8000-000000000000', 'editor');
      expect(res.status).toBe(404);
    });

    it('blocks changing your own role', async () => {
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });
      const token = await tokenFor(admin.id);

      const res = await patchRole(token, admin.id, 'user');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CANNOT_CHANGE_OWN_ROLE');
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
      expect(stored.role).toBe('ADMIN');
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('lets an admin delete a test user and frees the email for re-registration', async () => {
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });
      const target = await createUser({
        email: 'target@example.com',
        verified: true,
      });
      await prisma.authAccount.create({
        data: {
          userId: target.id,
          provider: 'CREDENTIALS',
          providerAccountId: 'target@example.com',
          passwordHash: 'hash',
        },
      });
      await prisma.authSession.create({
        data: {
          userId: target.id,
          refreshTokenHash: 'session-hash',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      const token = await tokenFor(admin.id);

      const res = await deleteUser(token, target.id);
      expect(res.status).toBe(204);
      await expect(prisma.user.findUnique({ where: { id: target.id } })).resolves.toBeNull();
      // Cascade removed the related auth records.
      await expect(prisma.authAccount.count({ where: { userId: target.id } })).resolves.toBe(0);
      await expect(prisma.authSession.count({ where: { userId: target.id } })).resolves.toBe(0);

      const register = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'target@example.com', password: PASSWORD });
      expect(register.status).toBe(201);
      expect(register.body.id).not.toBe(target.id);
    });

    it('returns 404 for an unknown user', async () => {
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });
      const token = await tokenFor(admin.id);

      const res = await deleteUser(token, '00000000-0000-7000-8000-000000000000');
      expect(res.status).toBe(404);
    });

    it('blocks deleting yourself', async () => {
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });
      const token = await tokenFor(admin.id);

      const res = await deleteUser(token, admin.id);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CANNOT_DELETE_SELF');
      await expect(prisma.user.findUnique({ where: { id: admin.id } })).resolves.not.toBeNull();
    });

    it('forbids a normal user and an editor (403)', async () => {
      const user = await createUser({ email: 'user@example.com' });
      const editor = await createUser({ email: 'editor@example.com', role: PrismaRole.EDITOR });
      const target = await createUser({ email: 'target@example.com' });

      expect((await deleteUser(await tokenFor(user.id), target.id)).status).toBe(403);
      expect((await deleteUser(await tokenFor(editor.id), target.id)).status).toBe(403);
    });
  });

  describe('last administrator safeguards', () => {
    // Self-protection blocks these paths at the HTTP layer; the invariant is
    // exercised directly on the service so the safeguard is verified even when
    // the acting account is not the target.
    it('refuses to demote the last administrator', async () => {
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });

      await expect(
        adminUsers.changeRole('00000000-0000-7000-8000-0000000000aa', admin.id, 'user'),
      ).rejects.toMatchObject({ status: 409, response: { code: 'LAST_ADMIN' } });
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
      expect(stored.role).toBe('ADMIN');
    });

    it('refuses to delete the last administrator', async () => {
      const admin = await createUser({ email: 'admin@example.com', role: PrismaRole.ADMIN });

      await expect(
        adminUsers.deleteUser('00000000-0000-7000-8000-0000000000aa', admin.id),
      ).rejects.toMatchObject({ status: 409, response: { code: 'LAST_ADMIN' } });
      await expect(prisma.user.findUnique({ where: { id: admin.id } })).resolves.not.toBeNull();
    });

    it('allows demoting an administrator when another administrator remains', async () => {
      const first = await createUser({ email: 'first@example.com', role: PrismaRole.ADMIN });
      const second = await createUser({ email: 'second@example.com', role: PrismaRole.ADMIN });

      const summary = await adminUsers.changeRole(first.id, second.id, 'editor');
      expect(summary.role).toBe('editor');
    });
  });

  describe('initial administrator bootstrap', () => {
    function bootstrapFor(email: string | undefined): InitialAdminBootstrapService {
      const config = {
        get: (key: string) => (key === 'AUTH_INITIAL_ADMIN_EMAIL' ? email : undefined),
      } as unknown as ConfigService;
      return new InitialAdminBootstrapService(prisma as unknown as PrismaService, config);
    }

    it('does nothing when the variable is unset', async () => {
      const user = await createUser({ email: 'admin@example.com', verified: true });
      await bootstrapFor(undefined).run();
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.role).toBe('USER');
    });

    it('promotes an existing verified user with an exact (case-insensitive) match', async () => {
      const user = await createUser({ email: 'Admin@Example.com', verified: true });
      await bootstrapFor('  admin@example.com  ').run();
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.role).toBe('ADMIN');
    });

    it('never promotes an unverified user', async () => {
      const user = await createUser({ email: 'admin@example.com', verified: false });
      await bootstrapFor('admin@example.com').run();
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.role).toBe('USER');
    });

    it('never creates a user when no matching account exists', async () => {
      await bootstrapFor('missing@example.com').run();
      await expect(prisma.user.count()).resolves.toBe(0);
    });

    it('is idempotent', async () => {
      const user = await createUser({ email: 'admin@example.com', verified: true });
      await bootstrapFor('admin@example.com').run();
      await bootstrapFor('admin@example.com').run();
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.role).toBe('ADMIN');
      await expect(prisma.user.count()).resolves.toBe(1);
    });
  });
});
