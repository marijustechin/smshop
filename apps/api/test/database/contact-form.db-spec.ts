import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@smshop/db';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import type {
  RateLimitDecision,
  RateLimiter,
} from '../../src/modules/auth/security/rate-limit/rate-limiter.js';
import type {
  TurnstileOutcome,
  TurnstileVerifier,
} from '../../src/modules/auth/security/turnstile/turnstile-verifier.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

const GROUPS = {
  administracija: 'administracija@example.test',
  uzsakymai: 'uzsakymai@example.test',
  'e-parduotuve': 'parduotuve@example.test',
} as const;

const VALID_BODY = {
  topic: 'general',
  email: 'visitor@example.test',
  message: 'Sveiki, turiu klausimą.',
};

describe('Public contact form (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const sendMail = vi.fn();

  let limiterDecision: RateLimitDecision;
  let turnstileEnabled: boolean;
  let turnstileOutcome: TurnstileOutcome;

  const rateLimiter: RateLimiter = {
    consume: vi.fn(() => limiterDecision),
  };
  const turnstileVerifier: TurnstileVerifier = {
    isEnabled: () => turnstileEnabled,
    verify: vi.fn(async () => turnstileOutcome),
  };

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    ({ app } = await createAuthTestApp(prisma as unknown as PrismaService, sendMail, {
      rateLimiter,
      turnstileVerifier,
    }));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    sendMail.mockReset();
    sendMail.mockResolvedValue(undefined);
    limiterDecision = { allowed: true, retryAfterSeconds: 0 };
    turnstileEnabled = false;
    turnstileOutcome = 'ok';
    await truncateAll(prisma);
  });

  async function seedGroups(overrides: Partial<Record<keyof typeof GROUPS, string>> = {}) {
    const emails = { ...GROUPS, ...overrides };
    let order = 0;
    for (const [key, email] of Object.entries(emails)) {
      await prisma.contactGroup.create({
        data: {
          key,
          title: key,
          phone: '+370 600 00000',
          email,
          hours: '8:00–18:00',
          displayOrder: order++,
        },
      });
    }
  }

  function submit(body: unknown) {
    return request(app.getHttpServer())
      .post('/api/public/contact')
      .send(body as object);
  }

  const lastMail = () =>
    sendMail.mock.calls.at(-1)?.[0] as {
      to: string;
      replyTo?: string;
      subject: string;
      text: string;
    };

  describe('recipient routing and current database lookup', () => {
    it('routes each topic to its contact group and sets To/Reply-To/subject/body', async () => {
      await seedGroups();

      const res = await submit({
        ...VALID_BODY,
        topic: 'order',
        name: 'Jonas',
        phone: '+370 600 11111',
      });

      expect(res.status).toBe(202);
      const mail = lastMail();
      expect(mail.to).toBe(GROUPS.uzsakymai);
      expect(mail.replyTo).toBe('visitor@example.test');
      expect(mail.subject).toBe('Svetainės užklausa: Užsakymas');
      expect(mail.text).toContain('Tema: Užsakymas');
      expect(mail.text).toContain('El. paštas: visitor@example.test');
      expect(mail.text).toContain('Vardas: Jonas');
      expect(mail.text).toContain('Telefonas: +370 600 11111');
      expect(mail.text).toContain('Sveiki, turiu klausimą.');
    });

    it('maps general→administration and shop→e-shop, and omits empty optional fields', async () => {
      await seedGroups();

      await submit({ ...VALID_BODY, topic: 'general', name: '', phone: '' });
      expect(lastMail().to).toBe(GROUPS.administracija);
      expect(lastMail().text).not.toContain('Vardas:');

      await submit({ ...VALID_BODY, topic: 'shop' });
      expect(lastMail().to).toBe(GROUPS['e-parduotuve']);
    });

    it('resolves the recipient at submission time (admin email change, no redeploy)', async () => {
      await seedGroups();
      await submit({ ...VALID_BODY, topic: 'general' });
      expect(lastMail().to).toBe(GROUPS.administracija);

      await prisma.contactGroup.update({
        where: { key: 'administracija' },
        data: { email: 'naujas@example.test' },
      });

      await submit({ ...VALID_BODY, topic: 'general' });
      expect(lastMail().to).toBe('naujas@example.test');
    });
  });

  describe('validation before sending', () => {
    it('rejects an unknown topic and never sends', async () => {
      await seedGroups();
      const res = await submit({ ...VALID_BODY, topic: 'nope' });
      expect(res.status).toBe(400);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('rejects invalid email, empty message, oversized message and unknown fields', async () => {
      await seedGroups();
      expect((await submit({ ...VALID_BODY, email: 'not-an-email' })).status).toBe(400);
      expect((await submit({ ...VALID_BODY, message: '   ' })).status).toBe(400);
      expect((await submit({ ...VALID_BODY, message: 'x'.repeat(5001) })).status).toBe(400);
      expect((await submit({ ...VALID_BODY, extra: 'nope' })).status).toBe(400);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('accepts a message at the 5000-character boundary', async () => {
      await seedGroups();
      const res = await submit({ ...VALID_BODY, message: 'x'.repeat(5000) });
      expect(res.status).toBe(202);
      expect(sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('missing recipient configuration', () => {
    it('fails clearly and sends nothing when the group is missing', async () => {
      const res = await submit({ ...VALID_BODY, topic: 'general' });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('CONTACT_UNAVAILABLE');
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('fails clearly and sends nothing when the group email is invalid', async () => {
      await seedGroups({ administracija: 'not-an-email' });
      const res = await submit({ ...VALID_BODY, topic: 'general' });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('CONTACT_UNAVAILABLE');
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('Turnstile', () => {
    it('rejects a missing token when Turnstile is enabled', async () => {
      await seedGroups();
      turnstileEnabled = true;
      turnstileOutcome = 'missing';
      const res = await submit(VALID_BODY);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TURNSTILE_REQUIRED');
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('rejects a failed/expired token when Turnstile is enabled', async () => {
      await seedGroups();
      turnstileEnabled = true;
      turnstileOutcome = 'failed';
      const res = await submit({ ...VALID_BODY, turnstileToken: 'expired' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TURNSTILE_FAILED');
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('accepts a valid token', async () => {
      await seedGroups();
      turnstileEnabled = true;
      turnstileOutcome = 'ok';
      const res = await submit({ ...VALID_BODY, turnstileToken: 'valid' });
      expect(res.status).toBe(202);
      expect(sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 with Retry-After and sends nothing when the limit is exceeded', async () => {
      await seedGroups();
      limiterDecision = { allowed: false, retryAfterSeconds: 42 };
      const res = await submit(VALID_BODY);
      expect(res.status).toBe(429);
      expect(res.body.code).toBe('RATE_LIMITED');
      expect(res.headers['retry-after']).toBe('42');
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('transport failure', () => {
    it('does not report false success when the transport rejects', async () => {
      await seedGroups();
      sendMail.mockRejectedValueOnce(new Error('smtp down'));
      const res = await submit(VALID_BODY);
      expect(res.status).toBe(502);
      expect(res.body.code).toBe('CONTACT_SEND_FAILED');
      expect(JSON.stringify(res.body)).not.toContain('smtp');
    });
  });
});
