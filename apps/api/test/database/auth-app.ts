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

export interface AuthTestApp {
  app: INestApplication;
  /** Spy for the mail transport's `send`; default resolves successfully. */
  sendMail: (message: unknown) => Promise<void>;
}

export interface AuthTestAppOptions {
  /** Replaces the Google OIDC provider boundary; tests never contact Google. */
  googleProvider?: GoogleOidcProvider;
}

/**
 * Builds the real AppModule over the test Prisma client with the mail transport
 * replaced by a controllable stub (no real SMTP) and, when supplied, the Google
 * OIDC provider replaced by a stub (no real Google). Runs the same
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
    .useValue(mailTransport);

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
