import fastifyCookie from '@fastify/cookie';
import { RequestMethod } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * Shared Fastify/Nest bootstrap for both `main.ts` and the HTTP test harness, so
 * tests exercise the same cookie/CORS/prefix configuration as production.
 */
export async function configureFastifyApp(
  app: NestFastifyApplication,
  webOrigin: string,
): Promise<void> {
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health/ready', method: RequestMethod.GET }],
  });
  await app.register(fastifyCookie);
  app.enableCors({ origin: webOrigin, credentials: true });
}
