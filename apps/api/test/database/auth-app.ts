import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { MAIL_TRANSPORT, type MailTransport } from '../../src/modules/mail/mail.transport.js';

export interface AuthTestApp {
  app: INestApplication;
  /** Spy for the mail transport's `send`; default resolves successfully. */
  sendMail: (message: unknown) => Promise<void>;
}

/**
 * Builds the real AppModule over the test Prisma client with the mail transport
 * replaced by a controllable stub, so no test ever contacts real SMTP.
 */
export async function createAuthTestApp(
  prisma: PrismaService,
  sendMail: (message: unknown) => Promise<void>,
): Promise<AuthTestApp> {
  const mailTransport: MailTransport = {
    send: (message) => sendMail(message),
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mailTransport)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health/ready', method: RequestMethod.GET }],
  });
  await app.init();
  await (app.getHttpAdapter().getInstance() as unknown as { ready: () => Promise<void> }).ready();

  return { app, sendMail };
}
