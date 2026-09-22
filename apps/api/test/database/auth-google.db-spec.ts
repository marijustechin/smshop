import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { REFRESH_COOKIE_NAME } from '../../src/modules/auth/session/refresh-cookie.service.js';
import { OAUTH_TXN_COOKIE_NAME } from '../../src/modules/auth/google/oauth-transaction-cookie.service.js';
import type {
  AuthorizationUrlInput,
  ExchangeCodeInput,
  GoogleIdentity,
  GoogleOidcProvider,
} from '../../src/modules/auth/google/google-oidc.provider.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

class StubGoogleProvider implements GoogleOidcProvider {
  enabled = true;
  throwOnExchange = false;
  identity: GoogleIdentity = {
    sub: 'google-sub-1',
    email: 'google@example.com',
    emailVerified: true,
  };
  lastAuthorizationInput?: AuthorizationUrlInput;
  private readonly usedCodes = new Set<string>();

  reset(): void {
    this.usedCodes.clear();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async createAuthorizationUrl(input: AuthorizationUrlInput): Promise<string> {
    this.lastAuthorizationInput = input;
    return `https://accounts.google.com/o/oauth2/v2/auth?state=${input.state}&nonce=${input.nonce}&code_challenge=${input.codeChallenge}`;
  }

  async exchangeCode(input: ExchangeCodeInput): Promise<GoogleIdentity> {
    if (this.throwOnExchange) {
      throw new Error('exchange failed');
    }
    // Model Google's single-use authorization code so callback replay fails.
    const code = new URL(input.callbackUrl).searchParams.get('code') ?? '';
    if (this.usedCodes.has(code)) {
      throw new Error('authorization code already used');
    }
    this.usedCodes.add(code);
    return this.identity;
  }
}

function setCookieHeader(res: request.Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

function cookieValue(res: request.Response, name: string): string | undefined {
  const cookie = setCookieHeader(res, name);
  return cookie ? decodeURIComponent(cookie.split(';')[0].slice(name.length + 1)) : undefined;
}

describe('Google authentication (real PostgreSQL, stubbed provider)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sendMail = vi.fn();
  const provider = new StubGoogleProvider();

  beforeAll(async () => {
    prisma = createTestPrismaClient() as unknown as PrismaService;
    ({ app } = await createAuthTestApp(prisma, sendMail, { googleProvider: provider }));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    provider.enabled = true;
    provider.throwOnExchange = false;
    provider.lastAuthorizationInput = undefined;
    provider.reset();
    provider.identity = {
      sub: 'google-sub-1',
      email: 'google@example.com',
      emailVerified: true,
    };
    sendMail.mockReset();
    sendMail.mockResolvedValue(undefined);
    await truncateAll(prisma);
  });

  const server = () => app.getHttpServer();

  async function startFlow() {
    const res = await request(server()).get('/api/auth/google').redirects(0);
    const raw = cookieValue(res, OAUTH_TXN_COOKIE_NAME);
    // Cookie value is `base64url(payload).signature`; the payload carries state.
    const payload = raw?.split('.')[0];
    const txn = payload
      ? (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { state: string })
      : null;
    return { res, state: txn?.state, cookie: raw ? `${OAUTH_TXN_COOKIE_NAME}=${raw}` : undefined };
  }

  function callback(state?: string, cookie?: string, extra = '') {
    const req = request(server()).get(`/api/auth/google/callback?code=test-code${extra}`);
    if (state) {
      req.query({ state });
    }
    return cookie ? req.set('Cookie', cookie) : req;
  }

  describe('start', () => {
    it('redirects to Google and sets a hardened short-lived transaction cookie', async () => {
      const { res, cookie } = await startFlow();

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('accounts.google.com');

      const txnCookie = setCookieHeader(res, OAUTH_TXN_COOKIE_NAME)!;
      expect(txnCookie).toContain('HttpOnly');
      expect(txnCookie).toContain('SameSite=Lax');
      expect(txnCookie).toContain('Path=/api/auth/google');
      expect(txnCookie).toContain('Max-Age=600');
      expect(txnCookie).not.toContain('Secure'); // non-production test env

      expect(provider.lastAuthorizationInput?.codeChallenge).toEqual(expect.any(String));
      expect(cookie).toBeDefined();
    });

    it('returns 503 when Google is disabled', async () => {
      provider.enabled = false;
      const res = await request(server()).get('/api/auth/google').redirects(0);
      expect(res.status).toBe(503);
    });
  });

  describe('capabilities', () => {
    it('reports Google as available when configured', async () => {
      const res = await request(server()).get('/api/auth/capabilities');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ google: true });
    });

    it('reports Google as unavailable when disabled', async () => {
      provider.enabled = false;
      const res = await request(server()).get('/api/auth/capabilities');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ google: false });
    });
  });

  describe('callback success', () => {
    it('creates a new Google-backed User, session, and refresh cookie', async () => {
      const { state, cookie } = await startFlow();

      const res = await callback(state, cookie).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');
      // The success URL never carries token material.
      expect(res.headers.location).not.toContain('token');
      expect(res.headers.location).not.toContain('code=');

      const user = await prisma.user.findUniqueOrThrow({
        where: { emailNormalized: 'google@example.com' },
      });
      expect(user.emailVerifiedAt).not.toBeNull();
      const account = await prisma.authAccount.findFirstOrThrow({ where: { userId: user.id } });
      expect(account.provider).toBe('GOOGLE');
      expect(account.providerAccountId).toBe('google-sub-1');
      expect(account.passwordHash).toBeNull();

      await expect(prisma.authSession.count({ where: { revokedAt: null } })).resolves.toBe(1);
      const refresh = setCookieHeader(res, REFRESH_COOKIE_NAME);
      expect(refresh).toBeDefined();
      expect(refresh).toContain('HttpOnly');
      // Transaction cookie is cleared.
      const cleared = setCookieHeader(res, OAUTH_TXN_COOKIE_NAME);
      expect(cleared).toContain(`${OAUTH_TXN_COOKIE_NAME}=;`);
    });

    it('logs in an existing Google sub without creating a second identity', async () => {
      await prisma.user.create({
        data: {
          email: 'old@example.com',
          emailNormalized: 'old@example.com',
          emailVerifiedAt: new Date(),
          accounts: { create: { provider: 'GOOGLE', providerAccountId: 'google-sub-1' } },
        },
      });
      // Same sub, changed email; must still map to the same User and not rewrite the email.
      provider.identity = { sub: 'google-sub-1', email: 'new@example.com', emailVerified: true };

      const { state, cookie } = await startFlow();
      const res = await callback(state, cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');
      await expect(prisma.user.count()).resolves.toBe(1);
      await expect(prisma.authAccount.count()).resolves.toBe(1);
      const user = await prisma.user.findFirstOrThrow();
      expect(user.email).toBe('old@example.com');
    });

    it('revokes a prior active session on Google login (single active session)', async () => {
      const existing = await prisma.user.create({
        data: {
          email: 'old@example.com',
          emailNormalized: 'old@example.com',
          emailVerifiedAt: new Date(),
          accounts: { create: { provider: 'GOOGLE', providerAccountId: 'google-sub-1' } },
        },
      });
      await prisma.authSession.create({
        data: {
          userId: existing.id,
          refreshTokenHash: 'a'.repeat(64),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const { state, cookie } = await startFlow();
      await callback(state, cookie).redirects(0);

      await expect(prisma.authSession.count({ where: { revokedAt: null } })).resolves.toBe(1);
    });
  });

  describe('collision and rejections', () => {
    it('rejects a Google identity without a verified email', async () => {
      provider.identity = { sub: 'google-sub-2', email: 'x@example.com', emailVerified: false };

      const { state, cookie } = await startFlow();
      const res = await callback(state, cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
      await expect(prisma.user.count()).resolves.toBe(0);
      await expect(prisma.authSession.count()).resolves.toBe(0);
    });

    it('rejects a Google identity without an email', async () => {
      provider.identity = { sub: 'google-sub-3', emailVerified: true };

      const { state, cookie } = await startFlow();
      const res = await callback(state, cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
      await expect(prisma.user.count()).resolves.toBe(0);
    });

    it('rejects a mismatched state', async () => {
      const { cookie } = await startFlow();

      const res = await callback('wrong-state', cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
      await expect(prisma.user.count()).resolves.toBe(0);
    });

    it('rejects a callback without a transaction cookie', async () => {
      const res = await callback('some-state', undefined).redirects(0);
      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
    });

    it('rejects a tampered transaction cookie before using its state/verifier/nonce', async () => {
      const { state } = await startFlow();
      // Forge a valid-looking but unsigned payload with an attacker-chosen verifier/nonce.
      const forged = Buffer.from(
        JSON.stringify({ state, codeVerifier: 'attacker-verifier', nonce: 'attacker-nonce' }),
        'utf8',
      ).toString('base64url');
      const tampered = `${OAUTH_TXN_COOKIE_NAME}=${forged}.AAAAforgedsignature`;

      const res = await callback(state, tampered).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
      await expect(prisma.user.count()).resolves.toBe(0);
      await expect(prisma.authSession.count()).resolves.toBe(0);
    });

    it('rejects a signature-tampered transaction cookie', async () => {
      const { state, cookie } = await startFlow();
      const value = cookie!.split('=').slice(1).join('=');
      const [payload] = value.split('.');
      const tampered = `${OAUTH_TXN_COOKIE_NAME}=${payload}.AAAAforgedsignature`;

      const res = await callback(state, tampered).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
      await expect(prisma.user.count()).resolves.toBe(0);
    });

    it('handles provider denial safely', async () => {
      const res = await request(server())
        .get('/api/auth/google/callback?error=access_denied')
        .redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
      await expect(prisma.authSession.count()).resolves.toBe(0);
    });

    it('handles an exchange failure safely', async () => {
      provider.throwOnExchange = true;
      const { state, cookie } = await startFlow();

      const res = await callback(state, cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
      await expect(prisma.user.count()).resolves.toBe(0);
    });

    it('rejects a replayed callback (single-use transaction)', async () => {
      const { state, cookie } = await startFlow();
      const first = await callback(state, cookie).redirects(0);
      expect(first.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');

      const second = await callback(state, cookie).redirects(0);
      expect(second.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
    });
  });

  describe('automatic linking on login', () => {
    async function seedVerifiedCredentialsUser(email = 'google@example.com') {
      return prisma.user.create({
        data: {
          email,
          emailNormalized: email,
          emailVerifiedAt: new Date(),
          accounts: {
            create: { provider: 'CREDENTIALS', providerAccountId: email, passwordHash: 'hash' },
          },
        },
      });
    }

    it('auto-links a verified credentials email and logs into the same user', async () => {
      const user = await seedVerifiedCredentialsUser('google@example.com');

      const { state, cookie } = await startFlow();
      const res = await callback(state, cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');
      await expect(prisma.user.count()).resolves.toBe(1);
      await expect(prisma.authAccount.count()).resolves.toBe(2);
      const google = await prisma.authAccount.findFirstOrThrow({
        where: { userId: user.id, provider: 'GOOGLE' },
      });
      expect(google.providerAccountId).toBe('google-sub-1');
      expect(setCookieHeader(res, REFRESH_COOKIE_NAME)).toBeDefined();
      await expect(
        prisma.authSession.count({ where: { userId: user.id, revokedAt: null } }),
      ).resolves.toBe(1);
    });

    it('keeps mapping to the same user on subsequent Google logins', async () => {
      const user = await seedVerifiedCredentialsUser('google@example.com');

      const first = await startFlow();
      await callback(first.state, first.cookie).redirects(0);

      const second = await startFlow();
      const res = await callback(second.state, second.cookie, '-again').redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');
      await expect(prisma.user.count()).resolves.toBe(1);
      await expect(prisma.authAccount.count()).resolves.toBe(2);
      await expect(
        prisma.authSession.count({ where: { userId: user.id, revokedAt: null } }),
      ).resolves.toBe(1);
    });

    // Regression for the real Google-first failure: the chosen Google email had
    // an existing but *unverified* credentials account. Google proved the email,
    // so it must link, verify, and log in — not reject.
    it('links and verifies an existing unverified application account', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'google@example.com',
          emailNormalized: 'google@example.com',
          emailVerifiedAt: null,
          accounts: {
            create: {
              provider: 'CREDENTIALS',
              providerAccountId: 'google@example.com',
              passwordHash: 'hash',
            },
          },
        },
      });

      const { state, cookie } = await startFlow();
      const res = await callback(state, cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');
      await expect(prisma.user.count()).resolves.toBe(1);
      const google = await prisma.authAccount.findFirstOrThrow({
        where: { userId: user.id, provider: 'GOOGLE' },
      });
      expect(google.providerAccountId).toBe('google-sub-1');
      const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(refreshed.emailVerifiedAt).not.toBeNull();
      await expect(
        prisma.authSession.count({ where: { userId: user.id, revokedAt: null } }),
      ).resolves.toBe(1);
    });

    it('does not link a Google email to an unrelated account; it creates a new user', async () => {
      await seedVerifiedCredentialsUser('a@example.com');
      provider.identity = {
        sub: 'google-sub-9',
        email: 'different@example.com',
        emailVerified: true,
      };

      const { state, cookie } = await startFlow();
      const res = await callback(state, cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');
      await expect(prisma.user.count()).resolves.toBe(2);
      const unrelated = await prisma.user.findUniqueOrThrow({
        where: { emailNormalized: 'a@example.com' },
      });
      await expect(
        prisma.authAccount.count({ where: { userId: unrelated.id, provider: 'GOOGLE' } }),
      ).resolves.toBe(0);
      const created = await prisma.user.findUniqueOrThrow({
        where: { emailNormalized: 'different@example.com' },
      });
      const createdGoogle = await prisma.authAccount.findFirstOrThrow({
        where: { userId: created.id, provider: 'GOOGLE' },
      });
      expect(createdGoogle.providerAccountId).toBe('google-sub-9');
    });

    it('never reassigns a Google sub that already belongs to another user', async () => {
      const owner = await prisma.user.create({
        data: {
          email: 'owner@example.com',
          emailNormalized: 'owner@example.com',
          emailVerifiedAt: new Date(),
          accounts: { create: { provider: 'GOOGLE', providerAccountId: 'google-sub-1' } },
        },
      });
      const credentials = await seedVerifiedCredentialsUser('google@example.com');

      const { state, cookie } = await startFlow();
      const res = await callback(state, cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');
      await expect(
        prisma.authAccount.count({ where: { providerAccountId: 'google-sub-1' } }),
      ).resolves.toBe(1);
      const linked = await prisma.authAccount.findFirstOrThrow({
        where: { providerAccountId: 'google-sub-1' },
      });
      expect(linked.userId).toBe(owner.id);
      await expect(
        prisma.authAccount.count({ where: { userId: credentials.id, provider: 'GOOGLE' } }),
      ).resolves.toBe(0);
    });

    it('does not attach a second Google identity to a user that already has one', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'google@example.com',
          emailNormalized: 'google@example.com',
          emailVerifiedAt: new Date(),
          accounts: {
            create: [
              {
                provider: 'CREDENTIALS',
                providerAccountId: 'google@example.com',
                passwordHash: 'hash',
              },
              { provider: 'GOOGLE', providerAccountId: 'google-sub-existing' },
            ],
          },
        },
      });
      provider.identity = {
        sub: 'google-sub-new',
        email: 'google@example.com',
        emailVerified: true,
      };

      const { state, cookie } = await startFlow();
      const res = await callback(state, cookie).redirects(0);

      expect(res.headers.location).toBe('http://localhost:3101/prisijungti?oauth=failed');
      const google = await prisma.authAccount.findFirstOrThrow({
        where: { userId: user.id, provider: 'GOOGLE' },
      });
      expect(google.providerAccountId).toBe('google-sub-existing');
      await expect(prisma.authSession.count()).resolves.toBe(0);
    });

    it('keeps credentials login working after Google auto-linking', async () => {
      const email = 'google@example.com';
      const password = 'a-very-strong-passphrase';
      const registerRes = await request(server())
        .post('/api/auth/register')
        .send({ email, password });
      expect(registerRes.status).toBe(201);
      await prisma.user.update({
        where: { emailNormalized: email },
        data: { emailVerifiedAt: new Date() },
      });

      const google = await startFlow();
      await callback(google.state, google.cookie).redirects(0);

      const login = await request(server()).post('/api/auth/login').send({ email, password });
      expect(login.status).toBe(200);
      expect(login.body.user.email).toBe(email);
      expect(login.body.user.googleLinked).toBe(true);
    });

    it('remains safe under concurrent auto-link attempts', async () => {
      await seedVerifiedCredentialsUser('google@example.com');

      const first = await startFlow();
      const second = await startFlow();
      const [a, b] = await Promise.all([
        callback(first.state, first.cookie, '-race-a').redirects(0),
        callback(second.state, second.cookie, '-race-b').redirects(0),
      ]);

      expect(a.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');
      expect(b.headers.location).toBe('http://localhost:3101/prisijungti?oauth=success');
      await expect(prisma.user.count()).resolves.toBe(1);
      await expect(prisma.authAccount.count({ where: { provider: 'GOOGLE' } })).resolves.toBe(1);
    });
  });

  describe('session integration after Google login', () => {
    it('supports refresh and /me, then logout revokes the session', async () => {
      const { state, cookie } = await startFlow();
      const callbackRes = await callback(state, cookie).redirects(0);
      const refreshValue = cookieValue(callbackRes, REFRESH_COOKIE_NAME) as string;
      const refreshCookie = `${REFRESH_COOKIE_NAME}=${refreshValue}`;

      const refreshRes = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie);
      expect(refreshRes.status).toBe(200);
      const accessToken = refreshRes.body.accessToken as string;
      const rotated = cookieValue(refreshRes, REFRESH_COOKIE_NAME) as string;

      const me = await request(server())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(me.status).toBe(200);
      expect(me.body.emailVerified).toBe(true);

      const logout = await request(server())
        .post('/api/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${rotated}`);
      expect(logout.status).toBe(204);
      await expect(prisma.authSession.count({ where: { revokedAt: null } })).resolves.toBe(0);

      const afterLogout = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${rotated}`);
      expect(afterLogout.status).toBe(401);
    });

    it('does not send a verification email for a new Google user', async () => {
      const { state, cookie } = await startFlow();
      await callback(state, cookie).redirects(0);
      expect(sendMail).not.toHaveBeenCalled();
    });
  });
});
