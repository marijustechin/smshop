import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { RequestMethod } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/** Maximum accepted upload size for a single product image (10 MB). */
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Shared Fastify/Nest bootstrap for both `main.ts` and the HTTP test harness, so
 * tests exercise the same cookie/CORS/multipart/prefix configuration as
 * production.
 *
 * `@fastify/cors` defaults `Access-Control-Allow-Methods` to `GET,HEAD,POST`,
 * which silently blocks the browser preflight for the admin API's `PATCH`
 * (role change) and `DELETE` (user deletion). The methods are listed explicitly
 * so the allowed cross-origin client can call every route the API exposes.
 *
 * `/media/*` is intentionally *not* under the `/api` prefix: stored images are
 * served from the same public `GET /media/products/:filename` URL that a
 * reverse proxy may serve directly in production.
 */
export async function configureFastifyApp(
  app: NestFastifyApplication,
  webOrigin: string,
): Promise<void> {
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'media/products/:filename', method: RequestMethod.GET },
    ],
  });
  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES, files: 1 },
  });
  app.enableCors({
    origin: webOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
  });
}
