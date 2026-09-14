import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';
import { configureFastifyApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { MAIL_TRANSPORT, type MailTransport } from '../../src/modules/mail/mail.transport.js';
import {
  GOOGLE_OIDC_PROVIDER,
  type GoogleOidcProvider,
} from '../../src/modules/auth/google/google-oidc.provider.js';
import {
  TURNSTILE_VERIFIER,
  type TurnstileVerifier,
} from '../../src/modules/auth/security/turnstile/turnstile-verifier.js';
import {
  RATE_LIMITER,
  type RateLimiter,
} from '../../src/modules/auth/security/rate-limit/rate-limiter.js';

export interface AuthTestApp {
  app: INestApplication;
  /** Spy for the mail transport's `send`; default resolves successfully. */
  sendMail: (message: unknown) => Promise<void>;
}

export interface AuthTestAppOptions {
  /** Replaces the Google OIDC provider boundary; tests never contact Google. */
  googleProvider?: GoogleOidcProvider;
  /** Replaces the Turnstile verifier boundary; tests never contact Cloudflare. */
  turnstileVerifier?: TurnstileVerifier;
  /** Replaces the rate limiter; defaults to permissive so suites are unaffected. */
  rateLimiter?: RateLimiter;
}

/** Disabled Turnstile stub: behaves as if Turnstile is not configured. */
export const disabledTurnstileVerifier: TurnstileVerifier = {
  isEnabled: () => false,
  verify: async () => 'ok',
};

/** Permissive limiter: never blocks (used for suites unrelated to rate limits). */
export const permissiveRateLimiter: RateLimiter = {
  consume: () => ({ allowed: true, retryAfterSeconds: 0 }),
};

/**
 * Builds the real AppModule over the test Prisma client with external
 * boundaries replaced by controllable stubs (no real SMTP/Google/Cloudflare). By
 * default rate limiting is permissive so unrelated suites are unaffected;
 * override `rateLimiter` to exercise real 429 behaviour. Runs the same
 * cookie/CORS/prefix setup as production.
 */
export async function createAuthTestApp(
  prisma: PrismaService,
  sendMail: (message: unknown) => Promise<void>,
  options: AuthTestAppOptions = {},
): Promise<AuthTestApp> {
  const mailTransport: MailTransport = {
    send: (message) => sendMail(message),
  };

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mailTransport)
    .overrideProvider(TURNSTILE_VERIFIER)
    .useValue(options.turnstileVerifier ?? disabledTurnstileVerifier)
    .overrideProvider(RATE_LIMITER)
    .useValue(options.rateLimiter ?? permissiveRateLimiter);

  if (options.googleProvider) {
    builder = builder.overrideProvider(GOOGLE_OIDC_PROVIDER).useValue(options.googleProvider);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await configureFastifyApp(app, process.env.WEB_ORIGIN ?? 'http://localhost:3000');
  await app.init();
  await (app.getHttpAdapter().getInstance() as unknown as { ready: () => Promise<void> }).ready();

  return { app, sendMail };
}
