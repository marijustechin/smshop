import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { Response } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@smshop/db';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { Argon2PasswordHasher } from '../../src/modules/auth/password/argon2-password-hasher.js';
import { hashRefreshToken, parseDurationMs } from '../../src/modules/auth/session/auth-tokens.js';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
} from '../../src/modules/auth/session/refresh-cookie.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

const PASSWORD = 'correct horse battery staple';
const EMAIL = 'login@example.com';
const hasher = new Argon2PasswordHasher();

function setCookieHeader(res: Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

function cookieValue(res: Response, name: string): string | undefined {
  const cookie = setCookieHeader(res, name);
  if (!cookie) {
    return undefined;
  }
  return decodeURIComponent(cookie.split(';')[0].slice(name.length + 1));
}

describe('Auth session lifecycle (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const sendMail = vi.fn();

  beforeAll(async () => {
    prisma = createTestPrismaClient() as unknown as PrismaService;
    ({ app } = await createAuthTestApp(prisma, sendMail));
    jwt = app.get(JwtService);
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

  async function seedUser(
    email: string,
    options: { verified?: boolean; provider?: 'CREDENTIALS' | 'GOOGLE' } = {},
  ): Promise<User> {
    const { verified = true, provider = 'CREDENTIALS' } = options;
    const emailNormalized = email.toLowerCase();
    const user = await prisma.user.create({
      data: {
        email,
        emailNormalized,
        emailVerifiedAt: verified ? new Date() : null,
      },
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

  const login = (body: object) => request(app.getHttpServer()).post('/api/auth/login').send(body);
  const refresh = (cookie?: string) => {
    const req = request(app.getHttpServer()).post('/api/auth/refresh');
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const logout = (cookie?: string) => {
    const req = request(app.getHttpServer()).post('/api/auth/logout');
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const me = (token?: string) => {
    const req = request(app.getHttpServer()).get('/api/auth/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  describe('login', () => {
    it('logs in a verified credentials user and sets a hardened refresh cookie', async () => {
      await seedUser(EMAIL);

      const res = await login({ email: EMAIL, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toEqual({
        id: expect.any(String),
        email: EMAIL,
        emailVerified: true,
        googleLinked: false,
      });
      expect(res.body).not.toHaveProperty('refreshToken');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      const cookie = setCookieHeader(res, REFRESH_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain(`Path=${REFRESH_COOKIE_PATH}`);
      expect(cookie).toContain('Max-Age=');
      expect(cookie).not.toContain('Secure'); // test/development (non-production)

      const raw = cookieValue(res, REFRESH_COOKIE_NAME) as string;
      const sessions = await prisma.authSession.findMany();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].refreshTokenHash).toBe(hashRefreshToken(raw));
      expect(sessions[0].refreshTokenHash).not.toBe(raw);
      expect(sessions[0].revokedAt).toBeNull();
      expect(sessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects unknown email and wrong password with the same generic 401', async () => {
      await seedUser(EMAIL);

      const unknown = await login({ email: 'nobody@example.com', password: PASSWORD });
      const wrong = await login({ email: EMAIL, password: 'wrong-password-value' });

      expect(unknown.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(unknown.body).toEqual(wrong.body);
      expect(JSON.stringify(unknown.body)).not.toMatch(/passwordHash|prisma/i);
      await expect(prisma.authSession.count()).resolves.toBe(0);
    });

    it('rejects an unverified account distinctly without issuing a session', async () => {
      await seedUser(EMAIL, { verified: false });

      const res = await login({ email: EMAIL, password: PASSWORD });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
      expect(res.headers['set-cookie']).toBeUndefined();
      await expect(prisma.authSession.count()).resolves.toBe(0);
    });

    it('rejects a Google-only account generically', async () => {
      await seedUser('google@example.com', { provider: 'GOOGLE' });

      const res = await login({ email: 'google@example.com', password: PASSWORD });

      expect(res.status).toBe(401);
      await expect(prisma.authSession.count()).resolves.toBe(0);
    });

    it('rejects a malformed login payload with 400', async () => {
      const res = await login({ email: 'not-an-email', password: PASSWORD });
      expect(res.status).toBe(400);
    });
  });

  describe('single active session', () => {
    it('revokes the previous session when logging in again', async () => {
      await seedUser(EMAIL);
      const first = await login({ email: EMAIL, password: PASSWORD });
      const firstCookie = `${REFRESH_COOKIE_NAME}=${cookieValue(first, REFRESH_COOKIE_NAME)}`;

      const second = await login({ email: EMAIL, password: PASSWORD });
      const secondCookie = `${REFRESH_COOKIE_NAME}=${cookieValue(second, REFRESH_COOKIE_NAME)}`;

      const active = await prisma.authSession.count({ where: { revokedAt: null } });
      expect(active).toBe(1);

      expect((await refresh(firstCookie)).status).toBe(401);
      expect((await refresh(secondCookie)).status).toBe(200);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      await seedUser(EMAIL);
      const loginRes = await login({ email: EMAIL, password: PASSWORD });
      const oldValue = cookieValue(loginRes, REFRESH_COOKIE_NAME) as string;
      const oldCookie = `${REFRESH_COOKIE_NAME}=${oldValue}`;

      const res = await refresh(oldCookie);

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      const newValue = cookieValue(res, REFRESH_COOKIE_NAME) as string;
      expect(newValue).not.toBe(oldValue);

      const session = await prisma.authSession.findFirstOrThrow();
      expect(session.refreshTokenHash).toBe(hashRefreshToken(newValue));
      expect(session.lastUsedAt).not.toBeNull();

      // Old token is no longer accepted.
      expect((await refresh(oldCookie)).status).toBe(401);
      // New token works.
      expect((await refresh(`${REFRESH_COOKIE_NAME}=${newValue}`)).status).toBe(200);
    });

    it('rejects an expired session', async () => {
      await seedUser(EMAIL);
      const loginRes = await login({ email: EMAIL, password: PASSWORD });
      const cookie = `${REFRESH_COOKIE_NAME}=${cookieValue(loginRes, REFRESH_COOKIE_NAME)}`;

      await prisma.authSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      expect((await refresh(cookie)).status).toBe(401);
    });

    it('rejects a malformed or missing refresh cookie safely', async () => {
      expect((await refresh()).status).toBe(401);
      expect((await refresh(`${REFRESH_COOKIE_NAME}=not-a-real-token`)).status).toBe(401);
    });
  });

  describe('logout', () => {
    it('revokes the session, clears the cookie, and is idempotent', async () => {
      await seedUser(EMAIL);
      const loginRes = await login({ email: EMAIL, password: PASSWORD });
      const cookie = `${REFRESH_COOKIE_NAME}=${cookieValue(loginRes, REFRESH_COOKIE_NAME)}`;

      const first = await logout(cookie);
      expect(first.status).toBe(204);
      const cleared = setCookieHeader(first, REFRESH_COOKIE_NAME);
      expect(cleared).toBeDefined();
      expect(cleared).toContain('HttpOnly');
      expect(cleared).toContain(`${REFRESH_COOKIE_NAME}=;`);

      await expect(prisma.authSession.count({ where: { revokedAt: null } })).resolves.toBe(0);
      expect((await refresh(cookie)).status).toBe(401);

      // Repeated and missing-cookie logout remain safe.
      expect((await logout(cookie)).status).toBe(204);
      expect((await logout()).status).toBe(204);
    });
  });

  describe('/api/auth/me', () => {
    it('returns safe identity with a valid access token', async () => {
      await seedUser(EMAIL);
      const loginRes = await login({ email: EMAIL, password: PASSWORD });

      const res = await me(loginRes.body.accessToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: expect.any(String),
        email: EMAIL,
        emailVerified: true,
        googleLinked: false,
      });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('includes only minimal claims in the access token', async () => {
      await seedUser(EMAIL);
      const loginRes = await login({ email: EMAIL, password: PASSWORD });

      const payload = jwt.decode(loginRes.body.accessToken) as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sid', 'sub']);
      expect(payload.sub).toEqual(expect.any(String));
      expect(payload.sid).toEqual(expect.any(String));
    });

    it('rejects missing, malformed, tampered, and expired tokens', async () => {
      await seedUser(EMAIL);
      const loginRes = await login({ email: EMAIL, password: PASSWORD });
      const token = loginRes.body.accessToken as string;
      const payload = jwt.decode(token) as { sub: string; sid: string };

      expect((await me()).status).toBe(401);
      expect((await me('not-a-jwt')).status).toBe(401);
      expect((await me(`${token}tampered`)).status).toBe(401);

      const expired = jwt.sign({ sub: payload.sub, sid: payload.sid }, { expiresIn: '-1s' });
      expect((await me(expired)).status).toBe(401);

      const wrongSecret = jwt.sign(
        { sub: payload.sub, sid: payload.sid },
        { secret: 'a-completely-different-secret-value-32' },
      );
      expect((await me(wrongSecret)).status).toBe(401);
    });
  });

  describe('session TTL configuration', () => {
    it('uses the configured refresh TTL for session expiry', async () => {
      await seedUser(EMAIL);
      await login({ email: EMAIL, password: PASSWORD });

      const session = await prisma.authSession.findFirstOrThrow();
      const ttlMs = parseDurationMs(process.env.AUTH_SESSION_TTL ?? '7d');
      const delta = session.expiresAt.getTime() - session.createdAt.getTime();
      expect(Math.abs(delta - ttlMs)).toBeLessThan(5_000);
    });
  });
});
