import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureFastifyApp } from '../src/app.setup.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

/**
 * CORS preflight contract for the API. `@fastify/cors` defaults the allowed
 * methods to GET/HEAD/POST, which the browser enforces for cross-origin
 * requests carrying an Authorization header. The admin API uses PATCH and
 * DELETE, so the preflight must advertise them or the browser blocks the
 * request before it reaches the server.
 */
describe('CORS preflight (HTTP)', () => {
  let app: NestFastifyApplication;
  const origin = 'http://localhost:3101';
  const prisma = { $queryRaw: vi.fn(), user: { findUnique: vi.fn() } };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureFastifyApp(app, origin);
    await app.init();
    await (app.getHttpAdapter().getInstance() as unknown as { ready: () => Promise<void> }).ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'])(
    'allows %s for the configured origin',
    async (method) => {
      const res = await request(app.getHttpServer())
        .options('/api/admin/users/00000000-0000-7000-8000-000000000000')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', method)
        .set('Access-Control-Request-Headers', 'authorization');

      expect(res.status).toBeLessThan(400);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-methods'] ?? '').toContain(method);
    },
  );
});
